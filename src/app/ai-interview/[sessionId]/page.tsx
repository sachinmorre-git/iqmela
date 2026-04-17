import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { AiInterviewShell } from "./AiInterviewShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Interview Room | IQMela",
  description: "AI-powered interview session. Answer each question out loud.",
};

export default async function AiInterviewRoomPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const { userId } = await auth();

  if (!userId) redirect("/sign-in");

  const session = await prisma.aiInterviewSession.findUnique({
    where: { id: sessionId },
    include: {
      turns: { orderBy: { turnIndex: "asc" } },
      position: {
        include: {
          aiInterviewConfigs: {
            where: { interviewId: null },
            take: 1,
          },
        },
      },
    },
  });

  if (!session) notFound();

  // Only the owning candidate can access their session
  if (session.candidateId !== userId) {
    redirect("/candidate/dashboard");
  }

  // If already completed, redirect to results view
  // (The shell handles results display too, so we pass the stored data)
  const questions = session.turns.map((t: any) => ({
    category: t.category as "INTRO" | "TECHNICAL" | "BEHAVIORAL" | "CLOSING",
    question: t.question,
  }));

  const config = session.position?.aiInterviewConfigs?.[0];
  const retriesAllowed  = config?.retriesAllowed  ?? false;
  const avatarProvider  = config?.avatarProvider  ?? undefined;
  // voiceProvider on config is the STT (candidate mic) provider
  // ttsProvider is the AI speech engine — stored as scoringProvider field for now
  // or falls back to env var TTS_PROVIDER
  const ttsProvider = process.env.TTS_PROVIDER ?? "browser";
  const visualMode = config?.visualMode ?? process.env.VISUAL_MODE ?? "orb";

  return (
    <AiInterviewShell
      sessionId={session.id}
      initialQuestions={questions}
      retriesAllowed={retriesAllowed}
      avatarProvider={avatarProvider}
      ttsProvider={ttsProvider}
      visualMode={visualMode}
    />
  );
}
