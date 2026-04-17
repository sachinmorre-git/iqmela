import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * Sends a 'speak' text command to an active Simli session.
 * This is a shell/stub route ready for the real Simli API implementation.
 * POST /api/visual/simli/speak
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

    console.log(`[Simli] Speak stub called for ${sessionId}: "${text.substring(0, 30)}..."`);

    // In a real implementation, this streams to the Simli WebRTC client.

    return NextResponse.json({ success: true, simulated: true });

  } catch (error) {
    console.error("[Simli Speak Stub Error]", error);
    return NextResponse.json(
      { error: "Failed to send Simli speak command" },
      { status: 500 }
    );
  }
}
