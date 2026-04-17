import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * Sends a 'speak' text command to an active D-ID session.
 * This is a shell/stub route ready for the real D-ID API implementation.
 * POST /api/visual/did/speak
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, text } = await req.json();
    if (!sessionId || !text) {
      return NextResponse.json({ error: "Missing sessionId or text" }, { status: 400 });
    }

    console.log(`[D-ID] Speak stub called for ${sessionId}: "${text.substring(0, 30)}..."`);

    // In a real implementation, this would POST to D-ID's /talks API endpoint
    // using the stream_id to trigger the avatar animation.

    return NextResponse.json({ success: true, simulated: true });

  } catch (error) {
    console.error("[D-ID Speak Stub Error]", error);
    return NextResponse.json(
      { error: "Failed to send D-ID speak command" },
      { status: 500 }
    );
  }
}
