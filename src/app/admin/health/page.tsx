import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { HealthDashboardClient } from "./HealthDashboardClient";

export const metadata = {
  title: "Platform Health | IQMela Admin",
  description: "Live health monitoring for all IQMela services and dependencies.",
};

export default async function HealthPage() {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString();
  if (!sysRole?.startsWith("sys:")) redirect("/select-role");

  // Fetch incidents (active first, then recent resolved)
  const incidents = await prisma.incident.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 50,
  });

  // Fetch recent health check logs
  const recentLogs = await prisma.healthCheckLog.findMany({
    orderBy: { checkedAt: "desc" },
    take: 50,
    select: {
      service: true,
      status: true,
      latencyMs: true,
      checkedAt: true,
    },
  });

  return (
    <div className="flex-1 w-full p-8 max-w-6xl mx-auto space-y-8">
      <div className="border-b border-zinc-800 pb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-3">
          🏥 Platform Health Monitor
        </h1>
        <p className="text-zinc-400 mt-2 max-w-2xl text-sm">
          Live health probing for all IQMela services — Database, Auth, AI providers, Video, and Code Execution.
          Auto-detects outages, creates incidents, and tracks service history.
        </p>
      </div>

      <HealthDashboardClient
        incidents={incidents.map((i) => ({
          id: i.id,
          title: i.title,
          service: i.service,
          severity: i.severity,
          status: i.status,
          description: i.description,
          autoDetected: i.autoDetected,
          resolvedAt: i.resolvedAt?.toISOString() ?? null,
          resolvedBy: i.resolvedBy,
          createdAt: i.createdAt.toISOString(),
        }))}
        recentLogs={recentLogs.map((l) => ({
          service: l.service,
          status: l.status,
          latencyMs: l.latencyMs,
          checkedAt: l.checkedAt.toISOString(),
        }))}
      />
    </div>
  );
}
