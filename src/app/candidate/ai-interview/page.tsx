import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Bot, CheckCircle, Clock, ChevronRight } from "lucide-react";
import { StartNewSessionForm } from "./StartNewSessionForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Interviews | IQMela",
  description: "Your AI-powered interview sessions.",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "COMPLETED") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
        <CheckCircle className="w-3 h-3" /> Completed
      </span>
    );
  }
  if (status === "IN_PROGRESS") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
        <Clock className="w-3 h-3" /> In Progress
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-zinc-800 text-zinc-400 border border-zinc-700">
      {status}
    </span>
  );
}

function recommendationLabel(rec: string | null) {
  if (!rec) return null;
  const map: Record<string, { label: string; cls: string }> = {
    STRONG_HIRE: { label: "Strong Hire", cls: "text-emerald-600 dark:text-emerald-400" },
    HIRE: { label: "Hire", cls: "text-blue-600 dark:text-blue-400" },
    MAYBE: { label: "Maybe", cls: "text-amber-600 dark:text-amber-400" },
    NO_HIRE: { label: "No Hire", cls: "text-red-600 dark:text-red-400" },
  };
  const entry = map[rec];
  if (!entry) return null;
  return <span className={`font-bold text-xs ${entry.cls}`}>{entry.label}</span>;
}

export default async function CandidateAiInterviewPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const sessions = await prisma.aiInterviewSession.findMany({
    where: { candidateId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      position: { select: { title: true } },
      _count: { select: { turns: true } },
    },
  });

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              AI Interviews
            </h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
            Practice or complete an AI-powered interview session.
          </p>
        </div>
        <StartNewSessionForm />
      </div>

      {/* Session list */}
      {sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-6">
          <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl flex items-center justify-center border border-indigo-100 dark:border-indigo-800/30">
            <Bot className="w-10 h-10 text-indigo-500 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              No AI Interview Sessions Yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm text-sm">
              Start a practice AI interview below, or wait for an organisation to include one in your invitation.
            </p>
          </div>
          <StartNewSessionForm />
        </div>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/ai-interview/${session.id}`}
              className="group block"
            >
              <div className="flex items-center justify-between p-5 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl shadow-sm hover:border-indigo-200 dark:hover:border-indigo-800/60 hover:shadow-md transition-all duration-200">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center shrink-0">
                    <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 dark:text-white text-sm">
                      {session.position?.title ?? "General AI Interview"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {session._count.turns} question{session._count.turns !== 1 ? "s" : ""} ·{" "}
                      {new Date(session.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <StatusBadge status={session.status} />
                      {session.overallScore !== null && (
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                          Score:{" "}
                          <span className="text-gray-900 dark:text-white font-bold">
                            {session.overallScore}/100
                          </span>
                        </span>
                      )}
                      {recommendationLabel(session.recommendation)}
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors shrink-0" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
