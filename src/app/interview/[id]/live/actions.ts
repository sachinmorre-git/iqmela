"use server"

import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { hiringAi } from "@/lib/ai";

export async function saveInterviewNotes(interviewId: string, notes: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  
  // Verify strictly that the user is the explicit interviewer for this room
  const interview = await prisma.interview.findUnique({ where: { id: interviewId } });
  if (!interview || interview.interviewerId !== userId) {
    throw new Error("Forbidden: Only the assigned interviewer can edit private notes.");
  }

  await prisma.interview.update({
    where: { id: interviewId },
    data: { notes }
  });
}

export async function generateInterviewerQuestions(interviewId: string) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const interview = await prisma.interview.findUnique({ 
    where: { id: interviewId },
    include: {
      position: true,
      candidate: true,
    }
  });

  if (!interview || !interview.positionId || !interview.position) {
    throw new Error("Unable to resolve Interview or Position context.");
  }

  // Authorize
  const isAuthorized = interview.interviewerId === userId || await prisma.interviewPanelist.findFirst({ where: { interviewId, interviewerId: userId } });
  if (!isAuthorized) throw new Error("Forbidden: Not assigned to panel.");

  // Resolve Explicit Resume mapped to Candidate Email
  const resolvedEmail = interview.candidate?.email || interview.candidateEmail;
  if (!resolvedEmail) {
    throw new Error("Candidate email is not available for this interview.");
  }
  const resume = await prisma.resume.findFirst({
    where: {
      positionId: interview.positionId,
      candidateEmail: resolvedEmail
    }
  });

  if (!resume || !resume.extractedText) {
    throw new Error("Candidate Resume data is missing or has not been extracted by AI.");
  }

  if (!interview.position?.jdText) {
    throw new Error("Position is missing active Job Description text to analyze against.");
  }

  // Construct Extracted Data Schema from DB JSON dumps
  // Note: PII fields (email, phone, LinkedIn) are intentionally excluded
  // to prevent exposure to interviewers during the live session.
  const extracted = {
    candidateName: resume.candidateName,
    candidateEmail: null as string | null,  // redacted — not needed for question generation
    phoneNumber: null as string | null,     // redacted
    linkedinUrl: null as string | null,     // redacted
    location: resume.location,
    summary: (resume.aiSummaryJson as Record<string,any>)?.overallProfile || null,
    skills: resume.skillsJson as string[] || [],
    experienceYears: resume.experienceYears,
    education: resume.educationJson as any[] || [],
    companies: resume.companiesJson as any[] || []
  };

  const ranking = {
    matchScore: resume.jdMatchScore || resume.matchScore || 0,
    matchLabel: resume.jdMatchLabel || resume.matchLabel || "UNKNOWN",
    jdMatchScore: resume.jdMatchScore || 0,
    jdMatchLabel: resume.jdMatchLabel || "UNKNOWN",
    matchedSkills: resume.matchedSkillsJson as string[] || [],
    missingSkills: resume.missingSkillsJson as string[] || [],
    rankingExplanation: resume.rankingExplanation || "",
    notableStrengths: resume.notableStrengthsJson as string[] || [],
    possibleGaps: resume.possibleGapsJson as string[] || []
  };

  // Dispatch to Gemini/DeepSeek
  const prep = await hiringAi.generateInterviewPrep(extracted, ranking, interview.position!.jdText!);
  
  return { prep, ranking };
}
