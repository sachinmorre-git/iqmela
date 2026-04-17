import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * Creates a new Tavus conversation session and associates it with our DB.
 * POST /api/visual/tavus/session
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    // Verify session
    const interviewSession = await prisma.aiInterviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!interviewSession || interviewSession.candidateId !== userId) {
      return NextResponse.json({ error: "Interview session not found or unauthorized" }, { status: 404 });
    }

    const apiKey = process.env.TAVUS_API_KEY;
    const personaId = process.env.TAVUS_PERSONA_ID;

    if (!apiKey || !personaId) {
      console.warn("[Tavus API] Missing TAVUS_API_KEY or TAVUS_PERSONA_ID, returning simulated session for dev.");
      // Return a simulated URL and ID for local dev when missing keys
      return NextResponse.json({
        conversationId: "simulated-tavus-session-id",
        conversationUrl: "", // blank URL will just show the placeholder
      });
    }

    // Real Tavus API call
    const res = await fetch("https://tavusapi.com/v2/conversations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({
        persona_id: personaId,
        conversation_name: `Interview_${sessionId}`,
        // Tavus also accepts a generic welcome message or callback URLs
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[Tavus API] Create session failed:", errorText);
      throw new Error(`Tavus API failed: ${res.status}`);
    }

    const data = await res.json();
    console.log("[Tavus API] Session Response:", JSON.stringify(data));
    
    // Store correlation ID in our DB
    await prisma.aiInterviewSession.update({
      where: { id: sessionId },
      data: { avatarSessionId: data.conversation_id },
    });

    return NextResponse.json({
      conversationId: data.conversation_id,
      conversationUrl: data.conversation_url, // web client embed URL
    });

  } catch (error) {
    console.error("[Tavus Session API Error]", error);
    return NextResponse.json(
      { error: "Failed to create video avatar session" },
      { status: 500 }
    );
  }
}
