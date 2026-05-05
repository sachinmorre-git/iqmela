import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// /api/health — Master Health Probe Endpoint
// Pings every critical service and returns structured status.
// This is completely decoupled from user-facing traffic.
// ─────────────────────────────────────────────────────────────────────────────

type ServiceStatus = {
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs: number;
  error?: string;
};

async function probeService(
  name: string,
  fn: () => Promise<void>,
  degradedThresholdMs: number = 2000,
): Promise<ServiceStatus> {
  const start = Date.now();
  try {
    await fn();
    const latencyMs = Date.now() - start;
    return {
      status: latencyMs > degradedThresholdMs ? "degraded" : "healthy",
      latencyMs,
    };
  } catch (e: any) {
    return {
      status: "unhealthy",
      latencyMs: Date.now() - start,
      error: e?.message?.slice(0, 200) ?? "Unknown error",
    };
  }
}

// ── Individual Service Probes ──────────────────────────────────────────────

async function probeDatabase(): Promise<ServiceStatus> {
  return probeService("database", async () => {
    await prisma.$queryRaw`SELECT 1`;
  }, 500);
}

async function probeClerk(): Promise<ServiceStatus> {
  return probeService("clerk", async () => {
    const res = await fetch("https://api.clerk.com/v1/health", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok && res.status !== 401) throw new Error(`Clerk returned ${res.status}`);
  }, 1000);
}

async function probeGemini(): Promise<ServiceStatus> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { status: "unhealthy", latencyMs: 0, error: "GEMINI_API_KEY not configured" };

  return probeService("gemini", async () => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) throw new Error(`Gemini returned ${res.status}`);
  }, 3000);
}

async function probeDeepSeek(): Promise<ServiceStatus> {
  const key = process.env.DEEPSEEK_API_KEY;
  const base = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
  if (!key) return { status: "unhealthy", latencyMs: 0, error: "DEEPSEEK_API_KEY not configured" };

  return probeService("deepseek", async () => {
    const res = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`DeepSeek returned ${res.status}`);
  }, 3000);
}

async function probeLiveKit(): Promise<ServiceStatus> {
  const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
  if (!url) return { status: "unhealthy", latencyMs: 0, error: "LIVEKIT_URL not configured" };

  // Convert wss:// to https:// for HTTP health check
  const httpUrl = url.replace("wss://", "https://").replace("ws://", "http://");

  return probeService("livekit", async () => {
    const res = await fetch(httpUrl, { signal: AbortSignal.timeout(5000) });
    // LiveKit returns various status codes on its root, a response = reachable
    if (res.status >= 500) throw new Error(`LiveKit returned ${res.status}`);
  }, 2000);
}

async function probeTavus(): Promise<ServiceStatus> {
  const key = process.env.TAVUS_API_KEY;
  if (!key) return { status: "unhealthy", latencyMs: 0, error: "TAVUS_API_KEY not configured" };

  return probeService("tavus", async () => {
    const res = await fetch("https://tavusapi.com/v2/personas", {
      headers: { "x-api-key": key },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`Tavus returned ${res.status}`);
  }, 3000);
}

async function probePiston(): Promise<ServiceStatus> {
  const pistonUrl = process.env.PISTON_API_URL
    ? `${process.env.PISTON_API_URL.replace(/\/$/, "")}/api/v2/piston/runtimes`
    : "https://emkc.org/api/v2/piston/runtimes";

  return probeService("piston", async () => {
    const res = await fetch(pistonUrl, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`Piston returned ${res.status}`);
  }, 3000);
}

// ── Main Handler ──────────────────────────────────────────────────────────

export async function GET() {
  try {
    const [database, clerk, gemini, deepseek, livekit, tavus, piston] =
      await Promise.all([
        probeDatabase(),
        probeClerk(),
        probeGemini(),
        probeDeepSeek(),
        probeLiveKit(),
        probeTavus(),
        probePiston(),
      ]);

    const services = { database, clerk, gemini, deepseek, livekit, tavus, piston };

    // Compute overall status
    const statuses = Object.values(services).map((s) => s.status);
    const hasUnhealthy = statuses.includes("unhealthy");
    const hasDegraded = statuses.includes("degraded");

    // Critical services: database, clerk — if these are down, platform is critical
    const criticalDown = database.status === "unhealthy" || clerk.status === "unhealthy";
    const overallStatus = criticalDown ? "critical" : hasUnhealthy ? "impaired" : hasDegraded ? "degraded" : "healthy";

    // Persist health checks asynchronously (fire-and-forget — never blocks response)
    const logEntries = Object.entries(services).map(([service, result]) => ({
      service,
      status: result.status,
      latencyMs: result.latencyMs,
      error: result.error ?? null,
    }));

    // Non-blocking: don't await this
    prisma.healthCheckLog
      .createMany({ data: logEntries })
      .catch(() => {}); // Silently fail if logging fails — don't bring down health endpoint

    // Auto-create incidents for unhealthy services (non-blocking)
    const incidentPromises = Object.entries(services).map(async ([service, result]) => {
      if (result.status === "unhealthy") {
        const isCritical = service === "database" || service === "clerk";
        try {
          const incident = await prisma.incident.create({
            data: {
              title: `${service.charAt(0).toUpperCase() + service.slice(1)} Service Unhealthy`,
              service,
              severity: isCritical ? "critical" : "high",
              status: "open",
              description: result.error ?? "Service did not respond",
              autoDetected: true,
            },
          });

          // Notify all Super Admins
          const superAdmins = await prisma.user.findMany({
            where: { roles: { has: "INTERNAL_GOD_MODE" } },
            select: { id: true, organizationId: true },
          });

          if (superAdmins.length > 0) {
            const { createBulkNotifications } = await import("@/lib/notification-service");
            await createBulkNotifications(
              superAdmins.map((admin) => ({
                organizationId: admin.organizationId ?? "GLOBAL",
                userId: admin.id,
                type: "PLATFORM_INCIDENT",
                title: "Platform Incident Auto-Detected",
                body: `Service '${service}' is down. Auto-created incident: ${incident.title}`,
                link: "/admin/health",
              }))
            );
          }
        } catch (e) {
          console.error("Failed to auto-create incident or notification", e);
        }
      }
    });
    
    // Fire-and-forget
    Promise.all(incidentPromises).catch(() => {});

    return NextResponse.json(
      {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        services,
      },
      {
        status: overallStatus === "healthy" ? 200 : overallStatus === "degraded" ? 200 : 503,
        headers: { "Cache-Control": "no-store, max-age=0" },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "error",
        timestamp: new Date().toISOString(),
        error: error?.message ?? "Health check handler crashed",
      },
      { status: 500 },
    );
  }
}
