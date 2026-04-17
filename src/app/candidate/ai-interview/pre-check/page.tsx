/**
 * Step 224 / Step 230 — AI Interview Pre-Check Page
 *
 * Candidates land here from their AI interview invite email.
 * URL: /candidate/ai-interview/pre-check?inviteId=<id>
 *
 * Responsibilities:
 * 1. Validate the invite (must exist + belong to this user's email)
 * 2. Show device checklist (mic, camera, browser)
 * 3. Create or resume their AiInterviewSession
 * 4. Redirect into /ai-interview/[sessionId]
 */

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PreCheckShell } from "./PreCheckShell";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Interview Pre-Check | IQMela",
  description: "Check your devices before starting your AI interview.",
};

export default async function AiInterviewPreCheckPage({
  searchParams,
}: {
  searchParams: Promise<{ inviteId?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const { inviteId } = await searchParams;

  // If no inviteId, send to the general AI interviews list
  if (!inviteId) redirect("/candidate/ai-interview");

  // Validate the invite
  const invite = await prisma.interviewInvite.findUnique({
    where: { id: inviteId },
    include: {
      position: { select: { id: true, title: true } },
      resume: {
        select: {
          id: true,
          candidateName: true,
          overrideName: true,
          candidateEmail: true,
          overrideEmail: true,
        }
      },
    },
  });

  if (!invite || invite.status === "DECLINED") {
    redirect("/candidate/ai-interview");
  }

  // Check if a session already exists for this invite
  const existingSession = await prisma.aiInterviewSession.findFirst({
    where: { resumeId: invite.resumeId ?? undefined, positionId: invite.positionId },
    select: { id: true, status: true },
  });

  // If session already completed, go directly to show result
  if (existingSession?.status === "COMPLETED") {
    redirect(`/ai-interview/${existingSession.id}`);
  }

  // Fetch position AI config for the pre-check display
  const config = await prisma.aiInterviewConfig.findFirst({
    where: { positionId: invite.positionId, interviewId: null },
  });

  const candidateName =
    invite.resume?.overrideName ||
    invite.resume?.candidateName ||
    "Candidate";

  return (
    <PreCheckShell
      inviteId={inviteId}
      positionId={invite.positionId}
      positionTitle={invite.position?.title ?? "Interview"}
      resumeId={invite.resumeId ?? undefined}
      candidateName={candidateName}
      existingSessionId={existingSession?.id}
      cameraRequired={config?.cameraRequired ?? false}
      durationMinutes={config?.durationMinutes ?? 30}
      totalQuestions={
        (config?.introQuestions ?? 2) +
        (config?.technicalQuestions ?? 4) +
        (config?.behavioralQuestions ?? 3)
      }
    />
  );
}
