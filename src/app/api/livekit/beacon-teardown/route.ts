import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { RoomServiceClient } from "livekit-server-sdk";

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    if (!bodyText) return new NextResponse("Empty body", { status: 400 });

    const { interviewId, isInterviewer } = JSON.parse(bodyText);
    if (!interviewId) return new NextResponse("Missing id", { status: 400 });

    // Only close the room globally if the Interviewer left
    if (isInterviewer) {
      const roomService = new RoomServiceClient(
        process.env.NEXT_PUBLIC_LIVEKIT_URL || "",
        process.env.LIVEKIT_API_KEY || "",
        process.env.LIVEKIT_API_SECRET || ""
      );

      try {
        // Kick everyone out of the room to stop billing and recording
        await roomService.deleteRoom(interviewId);
      } catch (err) {
        console.warn("Could not delete LiveKit room", err);
      }

      // Mark DB as COMPLETED
      await prisma.interview.updateMany({
        where: { id: interviewId },
        data: { status: "COMPLETED" }
      });
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[LiveKit Beacon Error]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
