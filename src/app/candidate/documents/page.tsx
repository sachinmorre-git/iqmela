import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { COUNTRY_CHECKLISTS } from "@/lib/document-checklist";
import { DocumentChecklistWrapper } from "./DocumentChecklistWrapper";

export const metadata = {
  title: "Documents | Candidate Portal",
  description: "Upload your compliance documents for hiring verification.",
};

export default async function CandidateDocumentsPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Ensure CandidateProfile exists (upsert)
  let profile = await prisma.candidateProfile.findUnique({
    where: { userId },
    include: {
      documents: {
        orderBy: { createdAt: "desc" },
      },
      user: { select: { name: true } },
    },
  });

  if (!profile) {
    profile = await prisma.candidateProfile.create({
      data: { userId },
      include: {
        documents: true,
        user: { select: { name: true } },
      },
    });
  }

  const uploadedDocs = profile.documents.map((d) => ({
    id: d.id,
    docType: d.docType,
    label: d.label,
    originalFileName: d.originalFileName,
    aiStatus: d.aiStatus,
    aiConfidence: d.aiConfidence,
    aiWarnings: d.aiWarnings as string[] | null,
    verificationStatus: d.verificationStatus,
    createdAt: d.createdAt.toISOString(),
    countryCode: d.countryCode,
  }));

  return (
    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-zinc-800 pb-6 mt-2">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Documents
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1.5 text-base">
            Upload your compliance documents. These travel with you across all positions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {uploadedDocs.length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              {uploadedDocs.length} uploaded
            </span>
          )}
        </div>
      </div>

      {/* Cross-position notice */}
      <div className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-r from-rose-50 to-indigo-50 dark:from-rose-900/10 dark:to-indigo-900/10 border border-rose-100 dark:border-rose-800/30">
        <span className="text-lg mt-0.5">📋</span>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Your documents are portable
          </p>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
            Documents you upload here will be available across all positions you apply to within the same organization. Upload once, use everywhere.
          </p>
        </div>
      </div>

      {/* Checklist */}
      <DocumentChecklistWrapper
        profileId={profile.id}
        uploadedDocs={uploadedDocs}
      />
    </div>
  );
}
