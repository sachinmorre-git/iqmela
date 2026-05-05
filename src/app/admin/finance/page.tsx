import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { clerkClient } from "@clerk/nextjs/server";
import { FinanceClient } from "./FinanceClient";

export const metadata = {
  title: "Economics & Cost Tracking | IQMela Admin",
};

export default async function FinancePage() {
  const { sessionClaims } = await auth();
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString();
  if (!sysRole?.startsWith("sys:")) redirect("/select-role");

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  // ── Aggregate AI usage costs ────────────────────────────────────────────
  const [
    totalAllTime,
    totalToday,
    totalWeek,
    totalMonth,
    totalPrevMonth,
    costByProvider,
    costByTask,
    costByOrg,
    recentLogs,
    manualEntries,
  ] = await Promise.all([
    prisma.aiUsageLog.aggregate({ _sum: { estimatedCost: true, totalTokens: true }, _count: true }),
    prisma.aiUsageLog.aggregate({ _sum: { estimatedCost: true }, where: { createdAt: { gte: todayStart } } }),
    prisma.aiUsageLog.aggregate({ _sum: { estimatedCost: true }, where: { createdAt: { gte: weekStart } } }),
    prisma.aiUsageLog.aggregate({ _sum: { estimatedCost: true, totalTokens: true }, where: { createdAt: { gte: monthStart } } }),
    prisma.aiUsageLog.aggregate({ _sum: { estimatedCost: true }, where: { createdAt: { gte: prevMonthStart, lt: monthStart } } }),
    prisma.aiUsageLog.groupBy({ by: ["provider"], _sum: { estimatedCost: true, totalTokens: true }, _count: true }),
    prisma.aiUsageLog.groupBy({ by: ["taskType"], _sum: { estimatedCost: true, totalTokens: true }, _count: true }),
    // Per-org cost (using positionId → position → orgId since orgId may be null on older records)
    prisma.$queryRaw<Array<{ organizationId: string; totalCost: number; totalTokens: bigint; callCount: bigint }>>`
      SELECT 
        COALESCE(a."organizationId", p."organizationId") as "organizationId",
        SUM(a."estimatedCost")::float as "totalCost",
        SUM(a."totalTokens")::bigint as "totalTokens",
        COUNT(a.id)::bigint as "callCount"
      FROM "AiUsageLog" a
      LEFT JOIN "Position" p ON a."positionId" = p.id
      WHERE COALESCE(a."organizationId", p."organizationId") IS NOT NULL
      GROUP BY COALESCE(a."organizationId", p."organizationId")
      ORDER BY "totalCost" DESC
      LIMIT 50
    `,
    prisma.aiUsageLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, provider: true, model: true, taskType: true, totalTokens: true, estimatedCost: true, createdAt: true },
    }),
    prisma.manualCostEntry.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
  ]);

  // Fetch org names for the per-org table
  const orgIds = costByOrg.map((o) => o.organizationId).filter(Boolean);
  let orgNameMap: Record<string, string> = {};
  if (orgIds.length > 0) {
    const prismaOrgs = await prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, domain: true },
    });
    orgNameMap = Object.fromEntries(prismaOrgs.map((o) => [o.id, o.domain || o.id.slice(0, 16)]));
  }

  // Calculate forecasting
  const daysInMonth = now.getDate();
  const monthCost = totalMonth._sum.estimatedCost || 0;
  const dailyAvg = daysInMonth > 0 ? monthCost / daysInMonth : 0;
  const daysInFullMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projectedMonthly = dailyAvg * daysInFullMonth;
  const prevMonthCost = totalPrevMonth._sum.estimatedCost || 0;
  const monthOverMonth = prevMonthCost > 0 ? ((monthCost - prevMonthCost) / prevMonthCost) * 100 : 0;

  return (
    <div className="flex-1 w-full p-6 sm:p-8 max-w-7xl mx-auto space-y-8 z-10 relative">
      <div className="border-b border-zinc-800 pb-6 mt-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Economics & Cost Tracking</h1>
        <p className="text-zinc-400 mt-2">AI usage costs, per-client breakdown, and forecasting.</p>
      </div>

      <FinanceClient
        summary={{
          allTime: totalAllTime._sum.estimatedCost || 0,
          today: totalToday._sum.estimatedCost || 0,
          week: totalWeek._sum.estimatedCost || 0,
          month: monthCost,
          totalTokens: Number(totalAllTime._sum.totalTokens || 0),
          totalCalls: totalAllTime._count,
          projectedMonthly,
          monthOverMonth,
          prevMonthCost,
          dailyAvg,
        }}
        costByProvider={costByProvider.map((p) => ({
          provider: p.provider,
          cost: p._sum.estimatedCost || 0,
          tokens: Number(p._sum.totalTokens || 0),
          calls: p._count,
        }))}
        costByTask={costByTask.map((t) => ({
          taskType: t.taskType,
          cost: t._sum.estimatedCost || 0,
          tokens: Number(t._sum.totalTokens || 0),
          calls: t._count,
        }))}
        costByOrg={costByOrg.map((o) => ({
          orgId: o.organizationId,
          orgName: orgNameMap[o.organizationId] || o.organizationId?.slice(0, 16) || "Unknown",
          cost: o.totalCost,
          tokens: Number(o.totalTokens),
          calls: Number(o.callCount),
        }))}
        recentLogs={recentLogs.map((l) => ({
          ...l,
          estimatedCost: l.estimatedCost,
          createdAt: l.createdAt.toISOString(),
        }))}
        manualEntries={manualEntries.map((e) => ({
          ...e,
          periodStart: e.periodStart.toISOString(),
          periodEnd: e.periodEnd.toISOString(),
          createdAt: e.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
