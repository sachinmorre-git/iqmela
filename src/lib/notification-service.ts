"use server";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// ── Notification Types ──────────────────────────────────────────────────────
export type NotificationType =
  | "RESUME_UPLOADED"
  | "AI_INTERVIEW_COMPLETED"
  | "PANEL_FEEDBACK_SUBMITTED"
  | "OFFER_APPROVED"
  | "OFFER_DECLINED"
  | "OFFER_ACCEPTED"
  | "CANDIDATE_QUESTION"
  | "BGV_COMPLETED"
  | "BGV_DISPUTE"
  | "CANDIDATE_ADVANCED"
  | "CANDIDATE_REJECTED"
  | "TEAM_MEMBER_JOINED"
  | "POSITION_DISPATCHED"
  | "POLL_COMPLETED"
  | "PROCTOR_ALERT"
  | "BILLING_THRESHOLD"
  | "INTERVIEW_REMINDER"
  | "POSITION_CLOSED"
  | "INTAKE_APPLICATION_RECEIVED"
  | "POSITION_STALE_DISTRIBUTION"
  | "WEEKLY_DIGEST"
  | "PLATFORM_INCIDENT";

// ── Icon mapping for each type ──────────────────────────────────────────────
const NOTIFICATION_ICONS: Record<string, string> = {
  RESUME_UPLOADED: "📄",
  AI_INTERVIEW_COMPLETED: "🤖",
  PANEL_FEEDBACK_SUBMITTED: "📝",
  OFFER_APPROVED: "✅",
  OFFER_DECLINED: "❌",
  OFFER_ACCEPTED: "🎉",
  CANDIDATE_QUESTION: "❓",
  BGV_COMPLETED: "🔍",
  BGV_DISPUTE: "⚠️",
  CANDIDATE_ADVANCED: "⬆️",
  CANDIDATE_REJECTED: "🚫",
  TEAM_MEMBER_JOINED: "👤",
  POSITION_DISPATCHED: "🏢",
  POLL_COMPLETED: "📅",
  PROCTOR_ALERT: "🚨",
  BILLING_THRESHOLD: "💰",
  INTERVIEW_REMINDER: "🔔",
  POSITION_CLOSED: "🔒",
  INTAKE_APPLICATION_RECEIVED: "📩",
  POSITION_STALE_DISTRIBUTION: "⏰",
  WEEKLY_DIGEST: "📊",
  PLATFORM_INCIDENT: "🔥",
};

// ── Create a notification ───────────────────────────────────────────────────
export async function createNotification(input: {
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    return await prisma.notification.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        icon: NOTIFICATION_ICONS[input.type] || "🔔",
        link: input.link,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (e) {
    console.error("[NotificationService] Failed to create:", e);
    return null;
  }
}

// ── Batch create for multiple recipients ────────────────────────────────────
export async function createBulkNotifications(
  inputs: Array<{
    organizationId: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    link?: string;
    metadata?: Record<string, unknown>;
  }>
) {
  try {
    return await prisma.notification.createMany({
      data: inputs.map((input) => ({
        organizationId: input.organizationId,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        icon: NOTIFICATION_ICONS[input.type] || "🔔",
        link: input.link,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      })),
    });
  } catch (e) {
    console.error("[NotificationService] Bulk create failed:", e);
    return null;
  }
}

// ── Fetch notifications for a user ──────────────────────────────────────────
export async function getNotifications(
  userId: string,
  options?: { limit?: number; includeRead?: boolean }
) {
  const limit = options?.limit ?? 30;
  return prisma.notification.findMany({
    where: {
      userId,
      isArchived: false,
      ...(options?.includeRead ? {} : { isRead: false }),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ── Get unread count ────────────────────────────────────────────────────────
export async function getUnreadCount(userId: string) {
  return prisma.notification.count({
    where: { userId, isRead: false, isArchived: false },
  });
}

// ── Mark single as read ─────────────────────────────────────────────────────
export async function markAsRead(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

// ── Mark all as read ────────────────────────────────────────────────────────
export async function markAllAsRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}

// ── Archive a notification ──────────────────────────────────────────────────
export async function archiveNotification(notificationId: string) {
  return prisma.notification.update({
    where: { id: notificationId },
    data: { isArchived: true },
  });
}
