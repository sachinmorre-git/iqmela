import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emailService } from "@/lib/email";
import { isBusinessHour } from "@/lib/poll-utils";

/**
 * Vercel Cron Job — runs every hour on the hour.
 * Configure in vercel.json:
 *   { "crons": [{ "path": "/api/cron/poll-nudge", "schedule": "0 * * * *" }] }
 *
 * Tasks:
 *  1. Flush ScheduledEmail queue (SLOT_CONFIRMED, DAY_OF, ONE_HOUR, FIFTEEN_MIN)
 *  2. Hourly nudge to non-responders (only during 9am–5pm UTC, weekdays)
 *  3. Mark expired polls as EXPIRED
 */
export async function GET(req: NextRequest) {
  // Secure with CRON_SECRET (Vercel injects this automatically in production)
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results = { flushed: 0, nudged: 0, expired: 0, errors: 0 };

  // ── Task 1: Flush ScheduledEmail queue ─────────────────────────────────────
  try {
    const due = await prisma.scheduledEmail.findMany({
      where: {
        sentAt: null,
        scheduledFor: { lte: now },
      },
      include: { poll: { include: { position: true, resume: true } } },
      take: 100,
    });

    for (const email of due) {
      try {
        const poll = email.poll;
        const candidateName =
          poll.resume.overrideName || poll.resume.candidateName || "Candidate";
        const positionTitle = poll.position.title;
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

        let subject = "";
        let heading = "";
        let body = "";
        let ctaLabel: string | undefined;
        let ctaUrl: string | undefined;

        if (email.type === "SLOT_CONFIRMED") {
          const slot = poll.confirmedSlot as Record<string, string> | null;
          const dateStr = slot
            ? new Date(`${slot.date}T${slot.startTime}:00Z`).toLocaleString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
            : "TBD";
          subject = `✅ Interview Confirmed — ${poll.roundLabel} for ${candidateName}`;
          heading = "🎉 Interview Time Confirmed!";
          body = `The <strong>${poll.roundLabel}</strong> interview for <strong>${candidateName}</strong> (${positionTitle}) has been confirmed.\n\n📅 <strong>${dateStr}</strong>\n⏱ Duration: ${poll.durationMinutes} minutes\n\nPlease add this to your calendar.`;
          ctaLabel = "View Dashboard";
          ctaUrl = `${baseUrl}/org-admin`;
        } else if (email.type === "INTERVIEW_DAY_OF") {
          subject = `📅 Interview Today — ${poll.roundLabel} with ${candidateName}`;
          heading = "📅 Interview Day Reminder";
          const slot = poll.confirmedSlot as Record<string, string> | null;
          const timeStr = slot ? `${slot.startTime}` : "";
          body = `This is your day-of reminder for the <strong>${poll.roundLabel}</strong> interview with <strong>${candidateName}</strong> for <strong>${positionTitle}</strong>.\n\n⏰ Interview time: <strong>${timeStr}</strong>\n⏱ Duration: ${poll.durationMinutes} minutes\n\nBe prepared and have a great interview!`;
        } else if (email.type === "INTERVIEW_ONE_HOUR") {
          subject = `⏰ 1 Hour Reminder — ${poll.roundLabel} with ${candidateName}`;
          heading = "⏰ Your Interview Starts in 1 Hour";
          body = `The <strong>${poll.roundLabel}</strong> interview with <strong>${candidateName}</strong> begins in <strong>1 hour</strong>.\n\nPosition: ${positionTitle}\nDuration: ${poll.durationMinutes} minutes\n\nPlease get ready and join on time.`;
        } else if (email.type === "INTERVIEW_FIFTEEN") {
          subject = `🔔 15 Min Reminder — ${poll.roundLabel} with ${candidateName}`;
          heading = "🔔 Starting in 15 Minutes!";
          body = `The <strong>${poll.roundLabel}</strong> interview with <strong>${candidateName}</strong> begins in <strong>15 minutes</strong>.\n\nJoin now and ensure your audio/video are ready.`;
        }

        if (subject) {
          await emailService.sendGenericEmail({
            to: email.recipientEmail,
            subject,
            heading,
            body,
            ctaLabel,
            ctaUrl,
          });
          await prisma.scheduledEmail.update({
            where: { id: email.id },
            data: { sentAt: now },
          });
          results.flushed++;
        }
      } catch (e) {
        console.error("[cron] Failed to send scheduled email", email.id, e);
        results.errors++;
      }
    }
  } catch (e) {
    console.error("[cron] ScheduledEmail flush failed", e);
  }

  // ── Task 2: Hourly nudge to non-responders (9am–5pm UTC weekdays only) ─────
  const dayOfWeek = now.getUTCDay(); // 0=Sun, 6=Sat
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

  if (isWeekday && isBusinessHour()) {
    try {
      // Find all pending responses where:
      // - poll is still POLLING
      // - panelist hasn't submitted yet
      // - last nudge was > 1hr ago (or never sent)
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const pendingResponses = await prisma.availabilityResponse.findMany({
        where: {
          submittedAt: null,
          poll: {
            status: "POLLING",
            deadline: { gte: now }, // Don't nudge expired polls
          },
          OR: [
            { lastNudgedAt: null },
            { lastNudgedAt: { lte: oneHourAgo } },
          ],
        },
        include: {
          poll: {
            include: {
              position: { select: { title: true } },
              resume: { select: { candidateName: true, overrideName: true } },
            },
          },
        },
        take: 200, // Safety cap per cron run
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

      for (const pr of pendingResponses) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: pr.userId },
            select: { email: true, name: true },
          });
          if (!user) continue;

          const poll = pr.poll;
          const candidateName =
            poll.resume.overrideName || poll.resume.candidateName || "Candidate";

          // Count how many others have already responded
          const allResponses = await prisma.availabilityResponse.findMany({
            where: { pollId: poll.id },
          });
          const respondedCount = allResponses.filter((r) => r.submittedAt).length;
          const totalCount = allResponses.length;

          const slotUrl = `${baseUrl}/schedule/availability/${pr.token}`;
          const deadlineStr = poll.deadline.toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          });

          await emailService.sendGenericEmail({
            to: user.email,
            subject: `⏰ Reminder: Mark your availability for ${candidateName}'s interview`,
            previewText: `${respondedCount} of ${totalCount} panelists have responded. Don't leave the team waiting!`,
            heading: "⏰ Availability Reminder",
            body: `Hi ${user.name || "there"},\n\nThis is a reminder to select your available time slots for the <strong>${poll.roundLabel}</strong> interview with <strong>${candidateName}</strong> for <strong>${poll.position.title}</strong>.\n\n📊 <strong>${respondedCount} of ${totalCount}</strong> panelists have already responded.\n⏰ Deadline: <strong>${deadlineStr}</strong>\n\nPlease mark your availability as soon as possible so we can find a common time.`,
            ctaLabel: "Mark My Availability →",
            ctaUrl: slotUrl,
          });

          await prisma.availabilityResponse.update({
            where: { id: pr.id },
            data: {
              lastNudgedAt: now,
              nudgeCount: { increment: 1 },
            },
          });

          results.nudged++;
        } catch (e) {
          console.error("[cron] Nudge failed for response", pr.id, e);
          results.errors++;
        }
      }
    } catch (e) {
      console.error("[cron] Nudge pass failed", e);
    }
  }

  // ── Task 3: Mark expired polls ─────────────────────────────────────────────
  try {
    const expired = await prisma.availabilityPoll.updateMany({
      where: {
        status: { in: ["POLLING", "READY"] },
        deadline: { lt: now },
      },
      data: { status: "EXPIRED" },
    });
    results.expired = expired.count;
  } catch (e) {
    console.error("[cron] Expiry pass failed", e);
  }

  console.log("[cron/poll-nudge] Done:", results);
  return NextResponse.json({ ok: true, ...results });
}
