import webpush from "web-push";
import { prisma } from "@/lib/prisma";

// ── Configure VAPID keys ────────────────────────────────────────────────────
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@iqmela.com";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// ── Save a push subscription ────────────────────────────────────────────────
export async function savePushSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string
) {
  return prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: { userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, userAgent },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    },
  });
}

// ── Remove a push subscription ──────────────────────────────────────────────
export async function removePushSubscription(endpoint: string) {
  return prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

// ── Send push to a specific user ────────────────────────────────────────────
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; icon?: string; url?: string; badge?: string }
) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn("[PushService] VAPID keys not configured, skipping push");
    return { sent: 0, failed: 0 };
  }

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let sent = 0;
  let failed = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || "/brand/icon/iq-icon-192.png",
          badge: payload.badge || "/brand/icon/iq-icon-48.png",
          data: { url: payload.url || "/" },
        })
      );
      sent++;
    } catch (err: unknown) {
      // Clean up expired/invalid subscriptions
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      }
      failed++;
    }
  }

  return { sent, failed };
}

// ── Check if VAPID is configured ────────────────────────────────────────────
export function isPushConfigured() {
  return !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

export { VAPID_PUBLIC_KEY };
