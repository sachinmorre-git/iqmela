import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { AccessToken } from "livekit-server-sdk";
import { LIVEKIT_CONFIG } from "@/lib/livekit";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Attempt to grab the requested room ID from the URL query params
    const { searchParams } = new URL(req.url);
    const room = searchParams.get("room");

    if (!room) {
      return NextResponse.json({ error: "Missing 'room' query parameter" }, { status: 400 });
    }

    // Safety check against unconfigured API keys
    if (!LIVEKIT_CONFIG.apiKey || !LIVEKIT_CONFIG.apiSecret || LIVEKIT_CONFIG.apiKey.includes('placeholder')) {
      return NextResponse.json({ error: "LiveKit server credentials are not fully configured." }, { status: 500 });
    }

    // Validate the requested room securely against our Database
    const interview = await prisma.interview.findUnique({
      where: { id: room },
      select: { candidateId: true, interviewerId: true, status: true }
    });

    if (!interview) {
      return NextResponse.json({ error: "Room not found in database" }, { status: 404 });
    }

    if (interview.status === "CANCELED") {
      return NextResponse.json({ error: "Forbidden: This interview has been permanently canceled" }, { status: 403 });
    }

    // Strict WebRTC Authorization: Is this user actually invited to this exact room?
    if (interview.candidateId !== userId && interview.interviewerId !== userId) {
      return NextResponse.json({ error: "Forbidden: You are not an assigned participant for this interview" }, { status: 403 });
    }

    // Identify role for the WebRTC interface mapping later
    const isInterviewer = interview.interviewerId === userId;
    const roleString = isInterviewer ? "Interviewer" : "Candidate";

    // Generate the incredibly secure Short-Lived Access Token for this user using the Official SDK
    const at = new AccessToken(LIVEKIT_CONFIG.apiKey, LIVEKIT_CONFIG.apiSecret, {
      identity: userId,
      name: roleString,
    });

    // Grant very specific WebRTC permissions bounded strictly to this one isolated Interview Room
    at.addGrant({
      roomJoin: true,
      room: room,
      canPublish: true,
      canSubscribe: true,
    });

    // Convert into a signed JWT string
    const token = await at.toJwt();

    return NextResponse.json({ token });

  } catch (error: any) {
    console.error("LiveKit Advanced Token Generation Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
