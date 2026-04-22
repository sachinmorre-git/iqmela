import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SlotCards } from "./SlotCards";

export const metadata = {
  title: "Pick Your Interview Time — IQMela",
  description: "Choose an interview time slot that works for you",
};

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PickSlotPage({ params }: Props) {
  const { token } = await params;

  const poll = await prisma.availabilityPoll.findUnique({
    where: { candidateToken: token },
    include: {
      position: { select: { title: true } },
      resume: { select: { candidateName: true, overrideName: true } },
    },
  });

  if (!poll) return notFound();

  const candidateName = poll.resume.overrideName || poll.resume.candidateName || "Candidate";

  // Already confirmed
  if (poll.status === "CONFIRMED" && poll.confirmedSlot) {
    const slot = poll.confirmedSlot as { date: string; startTime: string; endTime: string };
    const confirmedDate = new Date(`${slot.date}T${slot.startTime}:00`);
    const formattedDate = confirmedDate.toLocaleString("en-US", {
      weekday: "long", month: "long", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });

    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-emerald-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-8 shadow-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Interview Confirmed!</h1>
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
            <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400">📅 {formattedDate}</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">{poll.roundLabel} • {poll.durationMinutes} min</p>
          </div>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            A confirmation email has been sent to you. See you there!
          </p>
        </div>
      </div>
    );
  }

  // Canceled or expired
  if (poll.status === "CANCELED" || poll.status === "EXPIRED") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-red-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-red-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Link Expired</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            This scheduling link is no longer active. Please contact the recruiter.
          </p>
        </div>
      </div>
    );
  }

  // Not ready yet (still polling)
  if (poll.status === "POLLING" || !poll.commonSlotsJson) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-violet-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-violet-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto animate-pulse">
            <svg className="w-8 h-8 text-violet-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Almost There!</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400">
            We&apos;re still waiting for your interview panel to submit their availability. You&apos;ll receive an email when time slots are ready.
          </p>
        </div>
      </div>
    );
  }

  // Ready — show slots!
  const commonSlots = poll.commonSlotsJson as { date: string; startTime: string; endTime: string }[];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-teal-50/30 dark:from-zinc-950 dark:via-zinc-900 dark:to-teal-950/20">
      {/* Header */}
      <div className="border-b border-gray-100 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm">
              IQ
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900 dark:text-white">🗓️ Pick Your Interview Time</h1>
              <p className="text-xs text-gray-500 dark:text-zinc-400">
                {poll.roundLabel} • {poll.position.title}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-6 py-8 space-y-6">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5 shadow-sm">
          <p className="text-sm text-gray-600 dark:text-zinc-400">
            Hi <strong className="text-gray-900 dark:text-white">{candidateName}</strong>! We found{" "}
            <strong className="text-teal-600 dark:text-teal-400">{commonSlots.length} time slot{commonSlots.length > 1 ? "s" : ""}</strong>{" "}
            that work for your interview panel. Pick the one that works best for you.
          </p>
          <p className="text-xs text-gray-400 mt-2">⏱ {poll.durationMinutes} min interview</p>
        </div>

        <SlotCards
          slots={commonSlots}
          durationMinutes={poll.durationMinutes}
          candidateToken={token}
        />
      </div>
    </div>
  );
}
