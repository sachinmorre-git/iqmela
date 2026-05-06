import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";
import { redirect, notFound } from "next/navigation";
import { IntelligenceHubClient } from "./IntelligenceHubClient";

export async function generateMetadata({ params }: { params: Promise<{ resumeId: string }> }) {
  const { resumeId } = await params;
  const resume = await prisma.resume.findUnique({ where: { id: resumeId }, select: { candidateName: true } });
  return { title: `${resume?.candidateName ?? "Candidate"} — Intelligence Hub | IQMela` };
}

export default async function CandidateIntelligencePage({ 
  params,
  searchParams
}: { 
  params: Promise<{ resumeId: string }>;
  searchParams?: Promise<{ focus?: string }>;
}) {
  const { resumeId } = await params;
  const sp = searchParams ? await searchParams : {};
  const focusedRoundId = sp.focus;
  const perms = await getCallerPermissions();
  if (!perms) redirect("/select-role");

  // Fetch the resume with all intelligence data
  const resume = await prisma.resume.findUnique({
    where: { id: resumeId, isDeleted: false },
    include: {
      position: {
        include: {
          interviewPlan: { include: { stages: { orderBy: { stageIndex: "asc" } } } },
        },
      },
      interviews: {
        orderBy: { stageIndex: "asc" },
        include: {
          panelists:        { include: { interviewer: { select: { id: true, name: true, email: true } } } },
          panelistFeedbacks: { include: { interviewer: { select: { id: true, name: true, email: true } } } },
          feedback:   true,
          aiAnalysis: true,
          behaviorReport: true,  // Phase 6 — AI Behavioral Intelligence Report
        },
        // recordingUrl + transcriptionUrl are scalar fields on Interview, returned automatically
      },
      aiInterviewSessions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { candidate: { select: { name: true, email: true } } },
      },
      panelistFeedbacks: {
        include: { interviewer: { select: { id: true, name: true, email: true } } },
        orderBy: { submittedAt: "asc" },
      },
      hiringDecisions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { decidedBy: { select: { name: true, email: true } } },
      },
    },
  });

  if (!resume) notFound();

  // Org scope check
  if (perms.orgId && resume.organizationId !== perms.orgId) redirect("/org-admin/positions");

  const isHiringManager = perms.roles?.some((r: string) =>
    ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER"].includes(r)
  );

  return (
    <IntelligenceHubClient
      resume={resume as any}
      canReject={isHiringManager}
      canOffer={isHiringManager}
      userRoles={perms.roles ?? []}
      focusedRoundId={focusedRoundId}
    />
  );
}
