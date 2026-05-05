import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { markAsRead, markAllAsRead, archiveNotification } from "@/lib/notification-service";

// ── GET: Fetch notifications ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "30");
  const includeRead = url.searchParams.get("includeRead") === "true";

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId,
        isArchived: false,
        ...(includeRead ? {} : { isRead: false }),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 100),
    }),
    prisma.notification.count({
      where: { userId, isRead: false, isArchived: false },
    }),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

// ── PATCH: Mark as read / archive ───────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (body.action === "markRead" && body.notificationId) {
    await markAsRead(body.notificationId);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "markAllRead") {
    await markAllAsRead(userId);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "archive" && body.notificationId) {
    await archiveNotification(body.notificationId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
