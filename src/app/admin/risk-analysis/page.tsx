import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { computeRiskReport, type RawMetrics } from "./risk-engine";
import { RiskAnalysisClient } from "./RiskAnalysisClient";

export const metadata = {
  title: "Risk Analysis — IQMela Platform",
  description: "Predictive failure analysis and platform risk intelligence",
};

export default async function RiskAnalysisPage() {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");

  const sysRole = (
    sessionClaims?.publicMetadata as Record<string, unknown>
  )?.sysRole?.toString();
  if (!sysRole?.startsWith("sys:")) redirect("/select-role");

  const metrics = await gatherMetrics();
  const report = computeRiskReport(metrics);

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white tracking-tight">
          Risk Analysis
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Predictive intelligence — failure probability signals across 7
          dimensions
        </p>
      </div>

      <RiskAnalysisClient report={report} rawMetrics={metrics} />
    </div>
  );
}

// ── Data Gathering ──────────────────────────────────────────────────────────

async function gatherMetrics(): Promise<RawMetrics> {
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Build date ranges for sparkline daily buckets (last 7 days)
  const dayStarts: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    dayStarts.push(new Date(now.getTime() - i * 24 * 60 * 60 * 1000));
  }

  // ── Run all queries in parallel ───────────────────────────────────────────
  const [
    totalResumes,
    totalPositions,
    totalUsers,
    totalOrganizations,
    totalIntakeCandidates,
    resumesLast7d,
    resumesPrev7d,
    intakeLast24h,
    intakeLast7d,
    intakePrev7d,
    aiAggLast24h,
    aiAggLast7d,
    aiAggPrev7d,
    aiCallsLast24h,
    activeAiSessions,
    completedAiSessionsLast24h,
    completedAiSessionsLast7d,
    avgSessionDuration,
    healthChecksLast24h,
    healthFailuresLast24h,
    activeIncidents,
    criticalIncidents,
    publishedPositions,
    positionsAcceptingApps,
    resumesPastPurge,
    intakePastPurge,
    // Daily sparkline data
    dailyIntakeRaw,
    dailyAiCostRaw,
    dailyAiSessionsRaw,
    dailyHealthFailuresRaw,
  ] = await Promise.all([
    // Counts
    prisma.resume.count(),
    prisma.position.count({ where: { isDeleted: false } }),
    prisma.user.count(),
    prisma.organization.count(),
    prisma.intakeCandidate.count(),

    // Resume growth
    prisma.resume.count({ where: { createdAt: { gte: d7 } } }),
    prisma.resume.count({ where: { createdAt: { gte: d14, lt: d7 } } }),

    // Intake volume
    prisma.intakeCandidate.count({ where: { createdAt: { gte: h24 } } }),
    prisma.intakeCandidate.count({ where: { createdAt: { gte: d7 } } }),
    prisma.intakeCandidate.count({ where: { createdAt: { gte: d14, lt: d7 } } }),

    // AI usage
    prisma.aiUsageLog.aggregate({
      where: { createdAt: { gte: h24 } },
      _sum: { totalTokens: true, estimatedCost: true },
    }),
    prisma.aiUsageLog.aggregate({
      where: { createdAt: { gte: d7 } },
      _sum: { totalTokens: true, estimatedCost: true },
    }),
    prisma.aiUsageLog.aggregate({
      where: { createdAt: { gte: d14, lt: d7 } },
      _sum: { totalTokens: true, estimatedCost: true },
    }),
    prisma.aiUsageLog.count({ where: { createdAt: { gte: h24 } } }),

    // AI Sessions
    prisma.aiInterviewSession.count({
      where: { status: "IN_PROGRESS", isDeleted: false },
    }),
    prisma.aiInterviewSession.count({
      where: { completedAt: { gte: h24 }, isDeleted: false },
    }),
    prisma.aiInterviewSession.count({
      where: { completedAt: { gte: d7 }, isDeleted: false },
    }),
    prisma.aiInterviewSession.aggregate({
      where: { completedAt: { not: null }, isDeleted: false },
      _avg: {
        // We compute duration server-side via raw SQL below if needed
        // For now, use overallScore as proxy — we'll fix in sparklines
        overallScore: true,
      },
    }),

    // Health
    prisma.healthCheckLog.count({ where: { checkedAt: { gte: h24 } } }),
    prisma.healthCheckLog.count({
      where: { checkedAt: { gte: h24 }, status: { not: "healthy" } },
    }),
    prisma.incident.count({ where: { status: { not: "resolved" } } }),
    prisma.incident.count({
      where: { status: { not: "resolved" }, severity: "critical" },
    }),

    // Positions
    prisma.position.count({
      where: { isPublished: true, isDeleted: false },
    }),
    prisma.position.count({
      where: { isPublished: true, isDeleted: false },
      // All published positions are potentially accepting
    }),

    // Compliance — Resumes older than 90 days without extraction (stale data)
    prisma.resume.count({
      where: {
        createdAt: { lt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) },
        parsingStatus: "UPLOADED",
      },
    }).catch(() => 0),

    prisma.intakeCandidate.count({
      where: {
        purgeScheduledAt: { not: null, lt: now },
      },
    }).catch(() => 0),

    // ── Sparkline daily data (last 7 days) ──────────────────────────────
    // Intake by day
    Promise.all(
      dayStarts.map((ds, i) => {
        const end = i < 6 ? dayStarts[i + 1] : now;
        return prisma.intakeCandidate.count({
          where: { createdAt: { gte: ds, lt: end } },
        });
      })
    ),

    // AI cost by day
    Promise.all(
      dayStarts.map((ds, i) => {
        const end = i < 6 ? dayStarts[i + 1] : now;
        return prisma.aiUsageLog
          .aggregate({
            where: { createdAt: { gte: ds, lt: end } },
            _sum: { estimatedCost: true },
          })
          .then((r) => r._sum.estimatedCost || 0);
      })
    ),

    // AI sessions by day
    Promise.all(
      dayStarts.map((ds, i) => {
        const end = i < 6 ? dayStarts[i + 1] : now;
        return prisma.aiInterviewSession.count({
          where: {
            completedAt: { gte: ds, lt: end },
            isDeleted: false,
          },
        });
      })
    ),

    // Health failures by day
    Promise.all(
      dayStarts.map((ds, i) => {
        const end = i < 6 ? dayStarts[i + 1] : now;
        return prisma.healthCheckLog.count({
          where: {
            checkedAt: { gte: ds, lt: end },
            status: { not: "healthy" },
          },
        });
      })
    ),
  ]);

  // Get degraded services from recent health checks
  const latestChecks = await prisma.healthCheckLog.findMany({
    where: { checkedAt: { gte: h24 } },
    distinct: ["service"],
    orderBy: { checkedAt: "desc" },
    select: { service: true, status: true },
  });
  const degradedServices = latestChecks
    .filter((c) => c.status !== "healthy")
    .map((c) => c.service);

  // Compute average session duration from raw data
  const recentSessions = await prisma.aiInterviewSession.findMany({
    where: {
      completedAt: { not: null },
      isDeleted: false,
    },
    take: 50,
    orderBy: { completedAt: "desc" },
    select: { startedAt: true, completedAt: true },
  });

  const avgSessionDurationMs =
    recentSessions.length > 0
      ? recentSessions.reduce((sum, s) => {
          const dur =
            (s.completedAt!.getTime() - s.startedAt.getTime());
          return sum + dur;
        }, 0) / recentSessions.length
      : null;

  return {
    totalResumes,
    totalPositions,
    totalUsers,
    totalOrganizations,
    totalIntakeCandidates,
    resumesLast7d,
    resumesPrev7d,
    intakeLast24h,
    intakeLast7d,
    intakePrev7d,
    aiTokensLast24h: aiAggLast24h._sum.totalTokens || 0,
    aiTokensLast7d: aiAggLast7d._sum.totalTokens || 0,
    aiTokensPrev7d: aiAggPrev7d._sum.totalTokens || 0,
    aiCostLast24h: aiAggLast24h._sum.estimatedCost || 0,
    aiCostLast7d: aiAggLast7d._sum.estimatedCost || 0,
    aiCostPrev7d: aiAggPrev7d._sum.estimatedCost || 0,
    aiCallsLast24h,
    activeAiSessions,
    completedAiSessionsLast24h,
    completedAiSessionsLast7d,
    avgSessionDurationMs,
    healthChecksLast24h,
    healthFailuresLast24h,
    activeIncidents,
    criticalIncidents,
    degradedServices,
    resumesPastPurge,
    intakePastPurge,
    publishedPositions,
    positionsAcceptingApps,
    dailyIntake7d: dailyIntakeRaw,
    dailyAiCost7d: dailyAiCostRaw,
    dailyAiSessions7d: dailyAiSessionsRaw,
    dailyHealthFailures7d: dailyHealthFailuresRaw,
  };
}
