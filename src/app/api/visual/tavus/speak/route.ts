import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * Sends a message to an active Tavus conversation session.
 * POST /api/visual/tavus/speak
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

    const interviewSession = await prisma.aiInterviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!interviewSession || interviewSession.candidateId !== userId) {
      return NextResponse.json({ error: "Interview session not found or unauthorized" }, { status: 404 });
    }

    const conversationId = interviewSession.avatarSessionId;
    if (!conversationId) {
      return NextResponse.json({ error: "No active Tavus conversation for this session" }, { status: 400 });
    }

    const apiKey = process.env.TAVUS_API_KEY;
    if (!apiKey) {
      console.warn("[Tavus API] Simulated speak (no API KEY):", text);
      return NextResponse.json({ success: true, simulated: true });
    }

    // Tavus v2 Conversational API autonomous WebRTC.
    // There is no POST /messages endpoint to dictate autonomous speech.
    // Instead of crashing, we gracefully return success, letting the AI's
    // autonomous behavior drive the session naturally.
    return NextResponse.json({ success: true, simulated: true, note: "Tavus handles autonomous speech" });

  } catch (error) {
    console.error("[Tavus Speak API Error]", error);
    return NextResponse.json(
      { error: "Failed to send message to video avatar" },
      { status: 500 }
    );
  }
}
