"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  manualBlock,
  unblock,
  getActiveBlocks,
} from "@/lib/security-block";

async function requireSysAdmin() {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString();
  if (!sysRole?.startsWith("sys:")) redirect("/select-role");
  return { userId };
}

// ── Fetch all active blocks ─────────────────────────────────────────────────

export async function fetchActiveBlocks() {
  await requireSysAdmin();
  const blocks = await getActiveBlocks();
  return blocks.map((b) => ({
    id: b.id,
    targetType: b.targetType,
    targetValue: b.targetValue,
    reason: b.reason,
    severity: b.severity,
    isActive: b.isActive,
    expiresAt: b.expiresAt?.toISOString() ?? null,
    createdBy: b.createdBy,
    createdAt: b.createdAt.toISOString(),
  }));
}

// ── Fetch all blocks (including expired/inactive) ───────────────────────────

export async function fetchBlockHistory() {
  await requireSysAdmin();
  const blocks = await prisma.securityBlock.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return blocks.map((b) => ({
    id: b.id,
    targetType: b.targetType,
    targetValue: b.targetValue,
    reason: b.reason,
    severity: b.severity,
    isActive: b.isActive,
    expiresAt: b.expiresAt?.toISOString() ?? null,
    createdBy: b.createdBy,
    createdAt: b.createdAt.toISOString(),
  }));
}

// ── Manual block action ─────────────────────────────────────────────────────

export async function createManualBlock(formData: FormData) {
  const admin = await requireSysAdmin();
  const targetType = formData.get("targetType") as string;
  const targetValue = formData.get("targetValue") as string;
  const reason = formData.get("reason") as string;
  const durationHours = parseInt(formData.get("durationHours") as string) || 0;

  if (!targetType || !targetValue || !reason) {
    return { error: "Target type, value, and reason are required" };
  }

  if (!["IP", "USER"].includes(targetType)) {
    return { error: "Target type must be IP or USER" };
  }

  await manualBlock({
    targetType: targetType as "IP" | "USER",
    targetValue: targetValue.trim(),
    reason: reason.trim(),
    durationMs: durationHours > 0 ? durationHours * 60 * 60 * 1000 : undefined,
    createdBy: admin.userId,
  });

  return { success: true };
}

// ── Unblock action ──────────────────────────────────────────────────────────

export async function removeBlock(blockId: string) {
  await requireSysAdmin();

  const block = await prisma.securityBlock.findUnique({
    where: { id: blockId },
  });

  if (!block) return { error: "Block not found" };

  await unblock(block.targetType as "IP" | "USER", block.targetValue);
  return { success: true };
}
