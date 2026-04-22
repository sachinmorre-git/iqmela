import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SmartPollGrid } from "./SmartPollGrid";
import type { TimeSlot } from "@/lib/poll-utils";

export const dynamic = "force-dynamic"; // Always fetch fresh poll state

export const metadata = {
  title: "Mark Your Availability — IQMela Smart Poll",
  description:
    "Select your available time slots for the interview panel. See who else is available and find the best common time.",
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function AvailabilityPage({ params }: Props) {
  const { token } = await params;

  // Load the response including all sibling responses (for the transparency grid)
  const response = await prisma.availabilityResponse.findUnique({
    where: { token },
    include: {
      poll: {
        include: {
          position: { select: { title: true } },
          resume: { select: { candidateName: true, overrideName: true } },
          responses: {
            include: {
              profile: { select: { id: true, title: true, avatarUrl: true } },
            },
          },
        },
      },
    },
  });

  if (!response) return notFound();

  const poll = response.poll;

  // ── Canceled / Expired ───────────────────────────────────────────────────
  if (poll.status === "CANCELED") {
    return <StatusPage icon="❌" title="Poll Canceled" body="This scheduling poll has been canceled by the organizer. Contact the recruiter for a new link." color="red" />;
  }
  if (new Date() > poll.deadline && poll.status !== "CONFIRMED") {
    return <StatusPage icon="⏰" title="Deadline Passed" body="The deadline for this availability poll has passed. Contact the recruiter if you still need to schedule." color="amber" />;
  }

  // ── Confirmed ─────────────────────────────────────────────────────────────
  if (poll.status === "CONFIRMED") {
    const slot = poll.confirmedSlot as unknown as TimeSlot | null;
    const dateStr = slot
      ? new Date(`${slot.date}T${slot.startTime}:00`).toLocaleString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      : "";
    return (
      <StatusPage
        icon="✅"
        title="Interview Confirmed!"
        body={`The interview has been confirmed for ${dateStr}. You'll receive a calendar invite and reminders.`}
        color="green"
      />
    );
  }

  // ── Already submitted (my response) ──────────────────────────────────────
  const iAlreadySubmitted = response.submittedAt != null;

  // Load display names for all participants
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

  const candidateName = poll.resume.overrideName || poll.resume.candidateName || "Candidate";
  const submittedCount = participants.filter((p) => p.hasSubmitted).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-teal-50/20 dark:from-zinc-950 dark:via-zinc-900 dark:to-teal-950/10">
      {/* ── Sticky Header ─────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border-b border-gray-100 dark:border-zinc-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-sm">
            IQ
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-gray-900 dark:text-white truncate">
              📅 {poll.roundLabel} — {candidateName}
            </h1>
            <p className="text-[10px] text-gray-400 dark:text-zinc-500 truncate">
              {poll.position.title} · {poll.durationMinutes} min · {submittedCount}/{participants.length} responded
            </p>
          </div>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Context card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-4 shadow-sm">
          <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
            You've been selected to interview{" "}
            <strong className="text-gray-900 dark:text-white">{candidateName}</strong> for the{" "}
            <strong className="text-gray-900 dark:text-white">{poll.roundLabel}</strong> round.{" "}
            <span className="text-gray-500 dark:text-zinc-500">
              Select your available slots below. The grid shows what everyone else has picked — aim for the 🔥 hot slots where your team already agrees.
            </span>
          </p>
          <div className="flex flex-wrap gap-3 mt-3">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
              ⏱ {poll.durationMinutes} min interview
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
              📅 {new Date(poll.dateRangeStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {" → "}
              {new Date(poll.dateRangeEnd + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-800 px-2.5 py-1 rounded-lg">
              🕘 9AM – 5PM slots
            </span>
          </div>
        </div>

        {/* Already submitted banner */}
        {iAlreadySubmitted && (
          <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
            You've already submitted. You can view the grid below but can't change your selection.
          </div>
        )}

        {/* The interactive grid */}
        <SmartPollGrid
          token={token}
          initialPoll={{
            id: poll.id,
            roundLabel: poll.roundLabel,
            positionTitle: poll.position.title,
            candidateName,
            durationMinutes: poll.durationMinutes,
            minSlotsRequired: poll.minSlotsRequired,
            dateRangeStart: poll.dateRangeStart.toISOString().split("T")[0],
            dateRangeEnd: poll.dateRangeEnd.toISOString().split("T")[0],
            deadline: poll.deadline.toISOString(),
            status: poll.status,
            commonSlots: (poll.commonSlotsJson as unknown as TimeSlot[]) || [],
          }}
          initialParticipants={participants}
        />
      </div>
    </div>
  );
}

// ── Reusable status page ─────────────────────────────────────────────────────

function StatusPage({
  icon,
  title,
  body,
  color,
}: {
  icon: string;
  title: string;
  body: string;
  color: "red" | "amber" | "green";
}) {
  const bg = {
    red: "from-red-50 to-rose-50 dark:from-zinc-950 dark:to-red-950/20",
    amber: "from-amber-50 to-yellow-50 dark:from-zinc-950 dark:to-amber-950/20",
    green: "from-emerald-50 to-teal-50 dark:from-zinc-950 dark:to-teal-950/20",
  }[color];
  const iconBg = {
    red: "bg-red-100 dark:bg-red-900/30",
    amber: "bg-amber-100 dark:bg-amber-900/30",
    green: "bg-emerald-100 dark:bg-emerald-900/30",
  }[color];

  return (
    <div className={`min-h-screen bg-gradient-to-br ${bg} flex items-center justify-center p-6`}>
      <div className="max-w-sm w-full text-center space-y-5">
        <div className={`w-20 h-20 rounded-full ${iconBg} flex items-center justify-center mx-auto text-4xl`}>
          {icon}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{title}</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-2 leading-relaxed">{body}</p>
        </div>
        <div className="text-xs text-gray-400 dark:text-zinc-600 pt-4 border-t border-gray-100 dark:border-zinc-800">
          IQMela · Intelligent Hiring Platform
        </div>
      </div>
    </div>
  );
}
