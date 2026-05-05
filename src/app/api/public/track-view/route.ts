import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/public/track-view
 *
 * Lightweight beacon to track views & clicks on careers pages.
 * Increments viewCount/clickCount on the matching JobDistribution record.
 *
 * Body: { positionId: string, event: "view" | "click" }
 *
 * Security:
 * - No auth required (public endpoint)
 * - Fire-and-forget from client
 * - Rate limiting via IP dedup (same IP can only count once per hour)
 */

const IP_DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const recentViews = new Map<string, number>(); // key: `${ip}:${positionId}:${event}` → timestamp

// Periodic cleanup of stale entries (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of recentViews) {
    if (now - ts > IP_DEDUP_WINDOW_MS) recentViews.delete(key);
  }
}, 5 * 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { positionId, event } = body;

    if (!positionId || !event || !["view", "click"].includes(event)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // IP-based dedup — same IP can only count once per hour per event type
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const dedupKey = `${ip}:${positionId}:${event}`;
    const lastSeen = recentViews.get(dedupKey);
    const now = Date.now();

    if (lastSeen && now - lastSeen < IP_DEDUP_WINDOW_MS) {
      // Duplicate within dedup window — silently succeed
      return NextResponse.json({ success: true, deduped: true });
    }

    recentViews.set(dedupKey, now);

    // Increment the appropriate counter on all LIVE distributions for this position
    const field = event === "view" ? "viewCount" : "clickCount";
    await prisma.jobDistribution.updateMany({
      where: { positionId, status: "LIVE" },
      data: { [field]: { increment: 1 } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    // Non-blocking — tracking should never break the candidate experience
    console.error("[track-view] Error (non-blocking):", error);
    return NextResponse.json({ success: true });
  }
}
