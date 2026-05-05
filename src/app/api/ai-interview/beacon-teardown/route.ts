import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const bodyText = await req.text();
    if (!bodyText) return new NextResponse("Empty body", { status: 400 });

    const { sessionId, status = "ABANDONED" } = JSON.parse(bodyText);

    if (!sessionId) {
      return new NextResponse("Missing sessionId", { status: 400 });
    }

    // Only update if it's currently IN_PROGRESS
    const session = await prisma.aiInterviewSession.findUnique({
      where: { id: sessionId },
      select: { status: true }
    });

    if (session?.status === "IN_PROGRESS") {
      await prisma.aiInterviewSession.update({
        where: { id: sessionId },
        data: { status }
      });
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[Beacon Teardown Error]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
