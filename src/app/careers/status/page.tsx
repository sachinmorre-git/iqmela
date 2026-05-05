import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Application Status | IQMela Careers",
  description: "Check the status of your job application on IQMela.",
};

/**
 * /careers/status?token=<intakeCandidateId>
 *
 * Candidate-facing status page — lightweight, no auth required.
 * Shows tier1/tier2 progress and current pipeline stage.
 * PII-safe: only shows the candidate's own data identified by the intake token.
 */
export default async function ApplicationStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <StatusShell>
        <div className="text-center py-16">
          <h2 className="text-xl font-bold text-white mb-3">Check Your Application Status</h2>
          <p className="text-zinc-400 text-sm mb-8 max-w-md mx-auto">
            Enter the application token from your confirmation email to view your current status.
          </p>
          <form className="flex flex-col sm:flex-row items-center gap-3 max-w-md mx-auto">
            <input
              type="text"
              name="token"
              placeholder="Paste your application token"
              className="flex-1 w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder:text-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
              required
            />
            <button
              type="submit"
              className="shrink-0 px-6 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm transition-all shadow-lg shadow-rose-600/20"
            >
              Check Status
            </button>
          </form>
        </div>
      </StatusShell>
    );
  }

  // Look up the intake candidate by the token (which is the intakeCandidateId)
  const intake = await prisma.intakeCandidate.findUnique({
    where: { id: token },
    select: {
      id: true,
      candidateName: true,
      candidateEmail: true,
      tier1Score: true,
      tier1Status: true,
      tier2Score: true,
      finalStatus: true,
      createdAt: true,
      position: {
        select: {
          title: true,
          location: true,
          department: true,
        },
      },
    },
  });

  if (!intake) {
    return (
      <StatusShell>
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">❌</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Application Not Found</h2>
          <p className="text-zinc-400 text-sm max-w-md mx-auto">
            We couldn&apos;t find an application with this token. Please check your confirmation email for the correct link.
          </p>
        </div>
      </StatusShell>
    );
  }

  const tier1Passed = intake.tier1Status === "TIER1_PASS" || intake.tier1Status === "TIER2_SCORING" || intake.tier1Status === "TIER2_SCORED" || intake.tier1Status === "SHORTLISTED" || intake.tier1Status === "PROMOTED";
  const tier1Failed = intake.tier1Status === "TIER1_FAIL";

  // Determine visual progress
  const stages = [
    {
      label: "Application Received",
      icon: "📥",
      complete: true,
      detail: `Submitted on ${new Date(intake.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
    },
    {
      label: "Initial Screening",
      icon: "⚡",
      complete: intake.tier1Score !== null,
      detail: tier1Passed
        ? "Passed initial screening"
        : tier1Failed
          ? "Did not meet initial criteria"
          : "Under review",
    },
    {
      label: "AI Analysis",
      icon: "🧠",
      complete: intake.tier2Score !== null,
      detail: intake.tier2Score !== null
        ? `Compatibility score: ${intake.tier2Score}%`
        : tier1Failed
          ? "Not applicable"
          : "Pending deep analysis",
    },
    {
      label: "Team Review",
      icon: "👥",
      complete: intake.finalStatus === "PROMOTED" || intake.finalStatus === "ARCHIVED",
      detail: intake.finalStatus === "PROMOTED"
        ? "Selected for interview process"
        : intake.finalStatus === "ARCHIVED"
          ? "Application archived"
          : "Awaiting recruiter review",
    },
  ];

  const firstName = intake.candidateName?.split(" ")[0] || "there";

  return (
    <StatusShell>
      <div className="py-10">
        {/* Header */}
        <div className="mb-10">
          <h2 className="text-2xl font-extrabold text-white mb-2">
            Hi {firstName} 👋
          </h2>
          <p className="text-zinc-400 text-sm">
            Here&apos;s the current status of your application for{" "}
            <strong className="text-white">{intake.position.title}</strong>
            {intake.position.location && (
              <span className="text-zinc-500"> · {intake.position.location}</span>
            )}
          </p>
        </div>

        {/* Status Badge */}
        <div className="mb-8">
          <span
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold border ${
              intake.finalStatus === "PROMOTED"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : intake.finalStatus === "ARCHIVED"
                  ? "bg-red-500/10 border-red-500/30 text-red-400"
                  : tier1Failed
                    ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                    : "bg-blue-500/10 border-blue-500/30 text-blue-400"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            {intake.finalStatus === "PROMOTED"
              ? "Moving to Interview"
              : intake.finalStatus === "ARCHIVED"
                ? "Not Moving Forward"
                : tier1Failed
                  ? "Under Review"
                  : "In Progress"}
          </span>
        </div>

        {/* Timeline */}
        <div className="flex flex-col gap-0">
          {stages.map((stage, i) => {
            const isLast = i === stages.length - 1;
            const isActive = stage.complete && (isLast || !stages[i + 1]?.complete);

            return (
              <div key={stage.label} className="flex gap-4">
                {/* Timeline line + dot */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg border transition-all ${
                      stage.complete
                        ? isActive
                          ? "bg-rose-500/20 border-rose-500/40 shadow-lg shadow-rose-500/10"
                          : "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-zinc-800 border-zinc-700"
                    }`}
                  >
                    {stage.complete ? (isActive ? stage.icon : "✓") : stage.icon}
                  </div>
                  {!isLast && (
                    <div
                      className={`w-0.5 flex-1 min-h-[32px] ${
                        stage.complete ? "bg-emerald-500/30" : "bg-zinc-700"
                      }`}
                    />
                  )}
                </div>

                {/* Content */}
                <div className="pb-8 pt-1">
                  <p
                    className={`text-sm font-bold ${
                      stage.complete ? "text-white" : "text-zinc-500"
                    }`}
                  >
                    {stage.label}
                  </p>
                  <p className="text-xs text-zinc-400 mt-0.5">{stage.detail}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="mt-6 p-4 rounded-xl bg-zinc-800/50 border border-zinc-700/50 text-xs text-zinc-400 leading-relaxed">
          <strong className="text-zinc-300">ℹ️ Note:</strong> This page updates automatically as your application progresses.
          Average review time is 48 hours. For any questions, please reach out to the hiring team directly.
        </div>
      </div>
    </StatusShell>
  );
}

function StatusShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Top Bar */}
      <div className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/careers" className="flex items-center gap-2 group">
            <span className="text-lg font-black bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent">
              IQMela
            </span>
            <span className="text-xs text-zinc-500 font-medium group-hover:text-zinc-300 transition-colors">
              Careers
            </span>
          </Link>
          <Link
            href="/careers"
            className="text-xs text-zinc-400 hover:text-white transition-colors font-medium"
          >
            ← View All Jobs
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6">{children}</div>
    </div>
  );
}
