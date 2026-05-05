"use server";

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

async function requireInternalRole() {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString();
  if (!sysRole?.startsWith("sys:")) redirect("/select-role");
  return { userId, sysRole };
}

// ── Fetch paginated audit logs ─────────────────────────────────────────────

export async function fetchAuditLogs(opts: {
  page?: number;
  limit?: number;
  action?: string;
  resourceType?: string;
  userId?: string;
  orgId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}) {
  await requireInternalRole();

  const page = opts.page ?? 1;
  const limit = Math.min(opts.limit ?? 50, 100);
  const skip = (page - 1) * limit;

  // Build where clause
  const where: any = {};

  if (opts.action) where.action = opts.action;
  if (opts.resourceType) where.resourceType = opts.resourceType;
  if (opts.userId) where.userId = { contains: opts.userId, mode: "insensitive" };
  if (opts.orgId) where.organizationId = opts.orgId;

  if (opts.startDate || opts.endDate) {
    where.createdAt = {};
    if (opts.startDate) where.createdAt.gte = new Date(opts.startDate);
    if (opts.endDate) where.createdAt.lte = new Date(opts.endDate);
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map((l) => ({
      id: l.id,
      organizationId: l.organizationId,
      userId: l.userId,
      action: l.action,
      resourceType: l.resourceType,
      resourceId: l.resourceId,
      metadata: l.metadata as Record<string, any> | null,
      createdAt: l.createdAt.toISOString(),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// ── Fetch aggregate stats for the summary bar ──────────────────────────────

export async function fetchAuditStats() {
  await requireInternalRole();

  const now = new Date();
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [total, last24hCount, last7dCount, actionBreakdown] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.count({ where: { createdAt: { gte: last24h } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: last7d } } }),
    prisma.auditLog.groupBy({
      by: ["action"],
      _count: true,
      orderBy: { _count: { action: "desc" } },
      take: 10,
    }),
  ]);

  return {
    total,
    last24h: last24hCount,
    last7d: last7dCount,
    actionBreakdown: actionBreakdown.map((a) => ({
      action: a.action,
      count: a._count,
    })),
  };
}

// ── Fetch distinct filter values ───────────────────────────────────────────

export async function fetchAuditFilterOptions() {
  await requireInternalRole();

  const [actions, resourceTypes] = await Promise.all([
    prisma.auditLog.findMany({ distinct: ["action"], select: { action: true }, take: 50 }),
    prisma.auditLog.findMany({ distinct: ["resourceType"], select: { resourceType: true }, take: 50 }),
  ]);

  return {
    actions: actions.map((a) => a.action),
    resourceTypes: resourceTypes.map((r) => r.resourceType),
  };
}

// ── Export audit logs as CSV ───────────────────────────────────────────────

export async function exportAuditLogsCsv(opts: {
  action?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
}) {
  await requireInternalRole();

  const where: any = {};
  if (opts.action) where.action = opts.action;
  if (opts.resourceType) where.resourceType = opts.resourceType;
  if (opts.startDate || opts.endDate) {
    where.createdAt = {};
    if (opts.startDate) where.createdAt.gte = new Date(opts.startDate);
    if (opts.endDate) where.createdAt.lte = new Date(opts.endDate);
  }

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const header = "ID,Timestamp,User ID,Organization ID,Action,Resource Type,Resource ID,Metadata\n";
  const rows = logs
    .map((l) => {
      const meta = l.metadata ? JSON.stringify(l.metadata).replace(/"/g, '""') : "";
      return `${l.id},${l.createdAt.toISOString()},${l.userId},${l.organizationId ?? ""},${l.action},${l.resourceType},${l.resourceId},"${meta}"`;
    })
    .join("\n");

  return header + rows;
}
