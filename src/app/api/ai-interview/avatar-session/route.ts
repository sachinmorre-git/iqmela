/**
 * POST /api/ai-interview/avatar-session
 *
 * Persists the provider-generated session ID (e.g., Tavus conversation_id or HeyGen session_id)
 * to the AiInterviewSession record for correlation and management.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { sessionId, avatarSessionId } = await req.json();

    if (!sessionId || !avatarSessionId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify session
    const session = await prisma.aiInterviewSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.candidateId !== userId) {
      return NextResponse.json({ error: "Session not found or unauthorized" }, { status: 404 });
    }

    // Update session
    await prisma.aiInterviewSession.update({
      where: { id: sessionId },
      data: { avatarSessionId: avatarSessionId as string },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/ai-interview/avatar-session]", err);
    return NextResponse.json({ error: "Failed to persist avatar session" }, { status: 500 });
  }
}
