"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getCallerPermissions } from "@/lib/rbac";
import { emailService } from "@/lib/email";
import {
  addWeekdays,
  computeSlotIntersection,
  rankCommonSlots,
  type TimeSlot,
} from "@/lib/poll-utils";

// ── Create Availability Poll ─────────────────────────────────────────────────

export async function createAvailabilityPollAction(input: {
  positionId: string;
  resumeId: string;
  stageIndex: number;
  roundLabel: string;
  durationMinutes: number;
  dateRangeStart: string; // ISO date
  dateRangeEnd: string;   // ISO date
  interviewerIds: string[];
  deadlineWeekdays?: number; // Default 5 if omitted
}): Promise<{ success: boolean; pollId?: string; error?: string }> {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canManageInvites) return { success: false, error: "Unauthorized" };

    const position = await prisma.position.findUnique({ where: { id: input.positionId } });
    if (!position || position.organizationId !== perms.orgId) {
      return { success: false, error: "Position not found" };
    }

    const resume = await prisma.resume.findUnique({ where: { id: input.resumeId } });
    if (!resume) return { success: false, error: "Resume not found" };

    if (input.interviewerIds.length === 0) {
      return { success: false, error: "Select at least one interviewer" };
    }

    // Cancel any existing active poll for the same stage + candidate
    await prisma.availabilityPoll.updateMany({
      where: {
        positionId: input.positionId,
        resumeId: input.resumeId,
        stageIndex: input.stageIndex,
        status: { in: ["POLLING", "READY"] },
      },
      data: { status: "CANCELED" },
    });

    // Compute deadline: N weekdays from now (configurable, default 5)
    const weekdayCount = input.deadlineWeekdays ?? 5;
    const deadline = addWeekdays(new Date(), weekdayCount);
    deadline.setUTCHours(17, 0, 0, 0); // Deadline at 5pm UTC

    // Create the poll
    const poll = await prisma.availabilityPoll.create({
      data: {
        positionId: input.positionId,
        resumeId: input.resumeId,
        stageIndex: input.stageIndex,
        roundLabel: input.roundLabel,
        durationMinutes: input.durationMinutes,
        dateRangeStart: new Date(input.dateRangeStart),
        dateRangeEnd: new Date(input.dateRangeEnd),
        deadline,
        deadlineWeekdays: weekdayCount,
        createdById: perms.userId,
        responses: {
          create: input.interviewerIds.map((userId) => ({
            userId,
            // slotsJson stays null until they submit
          })),
        },
      },
      include: { responses: true },
    });

    // Send email to each panelist with their unique token
    const interviewerUsers = await prisma.user.findMany({
      where: { id: { in: input.interviewerIds } },
    });

    const candidateName = resume.overrideName || resume.candidateName || "Candidate";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    for (const response of poll.responses) {
      const user = interviewerUsers.find((u) => u.id === response.userId);
      if (!user) continue;

      const slotPickerUrl = `${baseUrl}/schedule/availability/${response.token}`;

      try {
        await emailService.sendGenericEmail({
          to: user.email,
          subject: `📅 Mark your availability — ${input.roundLabel} for ${candidateName}`,
          previewText: `Pick your available time slots for the ${input.roundLabel} interview. See what the rest of the panel has selected!`,
          heading: `📅 Availability Request`,
          body: `You've been selected to interview <strong>${candidateName}</strong> for the <strong>${position.title}</strong> position.<br/><br/>Please mark your available time slots so we can find a common time that works for everyone. <strong>You can see what other panelists have selected</strong> to help align on the best windows.<br/><br/>⏰ Deadline: ${deadline.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}`,
          ctaLabel: "Mark My Availability →",
          ctaUrl: slotPickerUrl,
        });
      } catch (emailErr) {
        console.error("[createAvailabilityPollAction] Email failed for", user.email, emailErr);
      }
    }

    revalidatePath(`/org-admin/positions/${input.positionId}`);
    return { success: true, pollId: poll.id };
  } catch (err) {
    console.error("[createAvailabilityPollAction]", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to create poll" };
  }
}

// ── Submit Availability Slots (panelist) ─────────────────────────────────────

export async function submitAvailabilitySlotsAction(
  token: string,
  slots: TimeSlot[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (slots.length === 0) return { success: false, error: "Select at least one time slot" };

    const response = await prisma.availabilityResponse.findUnique({
      where: { token },
      include: { poll: true },
    });

    if (!response) return { success: false, error: "Invalid or expired link" };
    if (response.poll.status === "CANCELED") return { success: false, error: "This scheduling poll has been canceled" };
    if (response.poll.status === "CONFIRMED") return { success: false, error: "Interview already confirmed" };
    if (new Date() > response.poll.deadline) return { success: false, error: "The deadline has passed" };

    // Save the slots
    await prisma.availabilityResponse.update({
      where: { id: response.id },
      data: {
        slotsJson: slots as unknown as Prisma.InputJsonValue,
        submittedAt: new Date(),
      },
    });

    // Check if all panelists have submitted — if yes, compute intersection
    const allResponses = await prisma.availabilityResponse.findMany({
      where: { pollId: response.pollId },
    });

      const allSubmitted = allResponses.every((r) => r.submittedAt != null);

      if (allSubmitted) {
        // Compute common slots using shared utility
        const commonSlots = rankCommonSlots(
          computeSlotIntersection(
            allResponses.map((r) => (r.slotsJson as unknown as TimeSlot[]) || []),
            response.poll.durationMinutes
          )
        );

        await prisma.availabilityPoll.update({
          where: { id: response.pollId },
          data: {
            commonSlotsJson: commonSlots as unknown as Prisma.InputJsonValue,
            status: commonSlots.length > 0 ? "READY" : "POLLING",
          },
        });

        // Notify candidate if common slots found
        if (commonSlots.length > 0) {
          const poll = response.poll;
          const resume = await prisma.resume.findUnique({ where: { id: poll.resumeId } });
          const candidateEmail = resume?.overrideEmail || resume?.candidateEmail;

          if (candidateEmail) {
            const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            const pickSlotUrl = `${baseUrl}/schedule/pick-slot/${poll.candidateToken}`;
            const position = await prisma.position.findUnique({ where: { id: poll.positionId } });

            try {
              await emailService.sendGenericEmail({
                to: candidateEmail,
                subject: `Pick your interview time — ${position?.title || "Interview"}`,
                previewText: `Select a time slot for your ${poll.roundLabel} interview`,
                heading: `🗓️ Choose Your Interview Time`,
                body: `Great news! Your <strong>${poll.roundLabel}</strong> interview for <strong>${position?.title || "the position"}</strong> is ready to be scheduled.<br/><br/>We've found <strong>${commonSlots.length} time slot${commonSlots.length > 1 ? "s" : ""}</strong> that work for the entire interview panel. Please pick the one that works best for you.`,
                ctaLabel: "Pick My Time Slot →",
                ctaUrl: pickSlotUrl,
              });
            } catch (emailErr) {
              console.error("[submitAvailabilitySlotsAction] Candidate email failed", emailErr);
            }
          }
        }
      }

    if (response.poll.positionId) {
      revalidatePath(`/org-admin/positions/${response.poll.positionId}`);
    }

    return { success: true };
  } catch (err) {
    console.error("[submitAvailabilitySlotsAction]", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to submit" };
  }
}

// ── Candidate Confirms a Slot ────────────────────────────────────────────────

export async function confirmSlotAction(
  candidateToken: string,
  selectedSlot: TimeSlot
): Promise<{ success: boolean; error?: string }> {
  try {
    const poll = await prisma.availabilityPoll.findUnique({
      where: { candidateToken },
      include: {
        responses: true,
        position: true,
        resume: true,
      },
    });

    if (!poll) return { success: false, error: "Invalid or expired link" };
    if (poll.status === "CONFIRMED") return { success: false, error: "Already confirmed" };
    if (poll.status === "CANCELED") return { success: false, error: "Poll canceled" };

    // Build scheduledAt datetime from the selected slot
    const scheduledAt = new Date(`${selectedSlot.date}T${selectedSlot.startTime}:00`);

    // Resolve candidate user
    const candidateEmail = poll.resume.overrideEmail || poll.resume.candidateEmail;
    const candidateUser = candidateEmail
      ? await prisma.user.findUnique({ where: { email: candidateEmail } })
      : null;

    if (!candidateUser) {
      return { success: false, error: "Candidate account not found" };
    }

    // Get interviewer user IDs from responses
    const interviewerIds = poll.responses.map((r) => r.userId);
    const interviewers = await prisma.user.findMany({
      where: { id: { in: interviewerIds } },
    });

    const candidateName = poll.resume.overrideName || poll.resume.candidateName || "Candidate";

    // Create the interview record
    const interview = await prisma.interview.create({
      data: {
        title: `${poll.roundLabel} — ${candidateName}`,
        scheduledAt,
        durationMinutes: poll.durationMinutes,
        status: "SCHEDULED",
        interviewMode: "HUMAN",
        candidateId: candidateUser.id,
        interviewerId: interviewers[0]?.id || null,
        positionId: poll.positionId,
        organizationId: poll.position.organizationId || undefined,
        scheduledById: poll.createdById,
        resumeId: poll.resumeId,
        stageIndex: poll.stageIndex,
        roundLabel: poll.roundLabel,
        panelists: interviewers.length > 0
          ? { create: interviewers.map((u) => ({ interviewerId: u.id })) }
          : undefined,
      },
    });

    // Mark poll as confirmed
    await prisma.availabilityPoll.update({
      where: { id: poll.id },
      data: {
        status: "CONFIRMED",
        confirmedSlot: selectedSlot as unknown as Prisma.InputJsonValue,
        confirmedAt: new Date(),
        notifiedConfirm: true,
      },
    });

    // ── Enqueue timed notification emails ──────────────────────────────
    // Collect all recipient emails
    const allEmails: { email: string; name: string }[] = [];
    if (candidateEmail) allEmails.push({ email: candidateEmail, name: candidateName });
    for (const u of interviewers) allEmails.push({ email: u.email, name: u.name || u.email });

    const interviewEnd = new Date(scheduledAt.getTime() + poll.durationMinutes * 60 * 1000);

    // Day-of reminder at 9:00 AM UTC on the interview day
    const dayOf = new Date(scheduledAt);
    dayOf.setUTCHours(9, 0, 0, 0);

    // 1 hour before
    const oneHourBefore = new Date(scheduledAt.getTime() - 60 * 60 * 1000);

    // 15 minutes before
    const fifteenMinBefore = new Date(scheduledAt.getTime() - 15 * 60 * 1000);

    const emailQueue = allEmails.flatMap(({ email, name }) => [
      { type: "SLOT_CONFIRMED" as const,     scheduledFor: new Date(), recipientEmail: email, recipientName: name },
      { type: "INTERVIEW_DAY_OF" as const,   scheduledFor: dayOf,          recipientEmail: email, recipientName: name },
      { type: "INTERVIEW_ONE_HOUR" as const, scheduledFor: oneHourBefore,  recipientEmail: email, recipientName: name },
      { type: "INTERVIEW_FIFTEEN" as const,  scheduledFor: fifteenMinBefore, recipientEmail: email, recipientName: name },
    ]);

    await prisma.scheduledEmail.createMany({
      data: emailQueue.map((e) => ({ ...e, pollId: poll.id })),
    });

    revalidatePath(`/org-admin/positions/${poll.positionId}`);
    return { success: true };
  } catch (err) {
    console.error("[confirmSlotAction]", err);
    return { success: false, error: err instanceof Error ? err.message : "Failed to confirm" };
  }
}

// ── Get Poll Status ──────────────────────────────────────────────────────────

export async function getPollStatusAction(
  positionId: string,
  resumeId: string,
  stageIndex: number
): Promise<{
  poll: {
    id: string;
    status: string;
    totalPanelists: number;
    submittedCount: number;
    commonSlots: TimeSlot[];
    confirmedSlot: TimeSlot | null;
    deadline: string;
  } | null;
}> {
  try {
    const poll = await prisma.availabilityPoll.findFirst({
      where: {
        positionId,
        resumeId,
        stageIndex,
        status: { not: "CANCELED" },
      },
      orderBy: { createdAt: "desc" },
      include: { responses: true },
    });

    if (!poll) return { poll: null };

    return {
      poll: {
        id: poll.id,
        status: poll.status,
        totalPanelists: poll.responses.length,
        submittedCount: poll.responses.filter((r) => r.submittedAt != null).length,
        commonSlots: (poll.commonSlotsJson as unknown as TimeSlot[]) || [],
        confirmedSlot: (poll.confirmedSlot as unknown as TimeSlot) || null,
        deadline: poll.deadline.toISOString(),
      },
    };
  } catch (err) {
    console.error("[getPollStatusAction]", err);
    return { poll: null };
  }
}

// ── Cancel Poll ──────────────────────────────────────────────────────────────

export async function cancelPollAction(pollId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canManageInvites) return { success: false, error: "Unauthorized" };

    const poll = await prisma.availabilityPoll.findUnique({ where: { id: pollId } });
    if (!poll) return { success: false, error: "Poll not found" };

    await prisma.availabilityPoll.update({
      where: { id: pollId },
      data: { status: "CANCELED" },
    });

    revalidatePath(`/org-admin/positions/${poll.positionId}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Failed" };
  }
}


