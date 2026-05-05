import { getCallerPermissions } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { QuestionBrowseClient } from "./QuestionBrowseClient";

export const metadata = { title: "Question Bank — IQMela" };

export default async function InterviewerQuestionBankPage() {
  const perms = await getCallerPermissions();
  if (!perms?.orgId) redirect("/");

  const questions = await prisma.interviewQuestion.findMany({
    where: { organizationId: perms.orgId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, type: true, title: true, description: true,
      difficulty: true, category: true, tags: true, language: true,
      starterCode: true, sampleInput: true, expectedOutput: true,
      options: true, explanation: true, attachmentUrl: true,
      attachmentName: true, usageCount: true, isFromSeedBank: true,
    },
  });

  return <QuestionBrowseClient questions={questions} />;
}
