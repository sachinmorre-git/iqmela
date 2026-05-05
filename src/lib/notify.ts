"use server";

import { createNotification, createBulkNotifications, type NotificationType } from "./notification-service";
import { sendPushToUser, isPushConfigured } from "./push-service";

/**
 * Central notification dispatcher — fires in-app notification + browser push simultaneously.
 * Use this from server actions instead of calling createNotification + sendPush separately.
 */
export async function dispatchNotification(input: {
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
  /** Set to true to also send a browser push (for high-urgency events) */
  sendPush?: boolean;
}) {
  // 1. Write to DB (in-app bell)
  const notification = await createNotification({
    organizationId: input.organizationId,
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link,
    metadata: input.metadata,
  });

  // 2. Optionally send browser push
  if (input.sendPush && isPushConfigured()) {
    await sendPushToUser(input.userId, {
      title: input.title,
      body: input.body,
      url: input.link,
    }).catch((e) => console.error("[dispatch] Push failed:", e));
  }

  return notification;
}

/**
 * Dispatch to multiple users (e.g. all approvers, all panelists).
 */
export async function dispatchBulkNotifications(
  inputs: Array<{
    organizationId: string;
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    link?: string;
    metadata?: Record<string, unknown>;
    sendPush?: boolean;
  }>
) {
  // 1. Batch write to DB
  await createBulkNotifications(inputs);

  // 2. Send push for those that requested it
  if (isPushConfigured()) {
    const pushTargets = inputs.filter((i) => i.sendPush);
    await Promise.allSettled(
      pushTargets.map((t) =>
        sendPushToUser(t.userId, {
          title: t.title,
          body: t.body,
          url: t.link,
        })
      )
    );
  }
}
