import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { computeSlotIntersection, rankCommonSlots, TimeSlot } from "@/lib/poll-utils";

// ── GET /api/poll/[token]/slots ───────────────────────────────────────────────
// Returns the complete poll state:
//  - poll metadata (deadline, duration, min slots, round label)
//  - all participants with their slots (for the transparency grid)
//  - the current user's own slots (if any already saved)
// No auth required — secured by the opaque token.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const response = await prisma.availabilityResponse.findUnique({
    where: { token },
    include: {
      poll: {
        include: {
          position: { select: { title: true } },
          resume: { select: { candidateName: true, overrideName: true } },
          responses: {
            include: {
              profile: {
                select: { id: true, title: true, avatarUrl: true },
              },
            },
          },
        },
      },
    },
  });

  if (!response) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const poll = response.poll;

  // Build participant list — include display name + slots
  const userIds = poll.responses.map((r) => r.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });

  const participants = poll.responses.map((r) => {
    const user = users.find((u) => u.id === r.userId);
    return {
      userId: r.userId,
      isMe: r.token === token,
      name: user?.name || user?.email || "Panelist",
      email: user?.email ?? "",
      avatarUrl: r.profile?.avatarUrl ?? null,
      title: r.profile?.title ?? null,
      slots: (r.slotsJson as unknown as TimeSlot[]) || [],
      hasSubmitted: r.submittedAt != null,
      overrideMinSlots: r.overrideMinSlots,
      nudgeCount: r.nudgeCount,
    };
  });

  return NextResponse.json({
    poll: {
      id: poll.id,
      roundLabel: poll.roundLabel,
      positionTitle: poll.position.title,
      candidateName: poll.resume.overrideName || poll.resume.candidateName || "Candidate",
      durationMinutes: poll.durationMinutes,
      minSlotsRequired: poll.minSlotsRequired,
      dateRangeStart: poll.dateRangeStart.toISOString().split("T")[0],
      dateRangeEnd: poll.dateRangeEnd.toISOString().split("T")[0],
      deadline: poll.deadline.toISOString(),
      status: poll.status,
      commonSlots: (poll.commonSlotsJson as unknown as TimeSlot[]) || [],
    },
    myToken: token,
    participants,
  });
}

// ── POST /api/poll/[token]/slots ──────────────────────────────────────────────
// Saves the current user's slot selections (can be called multiple times — upsert).
// On final submission, checks if all have responded → runs intersection → notifies.

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await req.json() as {
      slots: TimeSlot[];
      overrideMinSlots?: boolean;
      isFinal?: boolean; // true when the user presses "Submit My Availability"
    };

    const response = await prisma.availabilityResponse.findUnique({
      where: { token },
      include: { poll: true },
    });

    if (!response) return NextResponse.json({ error: "Invalid link" }, { status: 404 });
    const poll = response.poll;

    if (poll.status === "CANCELED") {
      return NextResponse.json({ error: "This poll has been canceled" }, { status: 400 });
    }
    if (poll.status === "CONFIRMED") {
      return NextResponse.json({ error: "Interview already confirmed" }, { status: 400 });
    }
    if (new Date() > poll.deadline) {
      return NextResponse.json({ error: "This poll has expired" }, { status: 400 });
    }

    // Save/update slots (allow multiple saves before final submit)
    await prisma.availabilityResponse.update({
      where: { id: response.id },
      data: {
        slotsJson: body.slots as unknown as Prisma.InputJsonValue,
        overrideMinSlots: body.overrideMinSlots ?? false,
        submittedAt: body.isFinal ? new Date() : null,
      },
    });

    const allResponses = await prisma.availabilityResponse.findMany({
      where: { pollId: poll.id },
    });
    const allSubmitted = allResponses.every((r) => r.submittedAt != null);

    if (allSubmitted) {
      const commonSlots = rankCommonSlots(
        computeSlotIntersection(
          allResponses.map((r) => (r.slotsJson as unknown as TimeSlot[]) || []),
          poll.durationMinutes
        )
      );

      await prisma.availabilityPoll.update({
        where: { id: poll.id },
        data: {
          commonSlotsJson: commonSlots as unknown as Prisma.InputJsonValue,
          status: commonSlots.length > 0 ? "READY" : "POLLING",
        },
      });
    } else if (poll.status === "READY") {
      // Revert to POLLING if someone un-submitted to edit
      await prisma.availabilityPoll.update({
        where: { id: poll.id },
        data: { status: "POLLING" },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/poll/[token]/slots]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
