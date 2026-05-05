import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { savePushSubscription, removePushSubscription } from "@/lib/push-service";

// ── POST: Subscribe to push ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (!body.subscription?.endpoint || !body.subscription?.keys) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }

  await savePushSubscription(userId, body.subscription, body.userAgent);
  return NextResponse.json({ ok: true });
}

// ── DELETE: Unsubscribe from push ───────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (body.endpoint) {
    await removePushSubscription(body.endpoint);
  }
  return NextResponse.json({ ok: true });
}
