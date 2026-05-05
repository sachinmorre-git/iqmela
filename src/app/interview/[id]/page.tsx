import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { CancelButton } from "./CancelButton"
import { RescheduleButton } from "./RescheduleButton"
import { Lock } from "lucide-react"
import { maskName } from "@/lib/pii-redact"
import { formatDate, formatTime } from "@/lib/locale-utils"

export const metadata = {
  title: 'Interview Details | IQMela',
}

export default async function InterviewDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  
  if (!userId) redirect("/sign-in");

  // Fetch interview with all relational data
  const interview = await prisma.interview.findUnique({
    where: { id },
    include: {
      candidate: { select: { id: true, name: true } },
      interviewer: { select: { id: true, name: true, email: true } },
    }
  });

  if (!interview) notFound();

  // Strict Authorization: Only the assigned candidate and assigned interviewer can view this room
  const isParticipant = interview.candidateId === userId || interview.interviewerId === userId;
  
  if (!isParticipant) {
    return (
      <div className="flex-1 w-full flex items-center justify-center bg-gray-50 dark:bg-black min-h-screen p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-950 border border-red-200 dark:border-red-900/50 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
            <Lock className="w-10 h-10 text-red-600 dark:text-red-500" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-4">Access Denied</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">
            You do not have the required authorization to view or join this interview session. Only the specifically assigned candidate and interviewer are permitted entry.
          </p>
          <Link href="/select-role" className="w-full">
            <Button size="lg" className="w-full h-14 text-lg font-bold rounded-2xl bg-gray-900 hover:bg-gray-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white transition-all">
              Return to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const isInterviewer = interview.interviewerId === userId;
  const backHref = isInterviewer ? "/interviewer/dashboard" : "/candidate/dashboard";
  const themeAccent = isInterviewer ? "purple" : "indigo";

  // Formatting strings
  const formattedDate = formatDate(interview.scheduledAt, { style: "long" });
  const formattedTime = formatTime(interview.scheduledAt);

  return (
    <div className="flex-1 w-full max-w-4xl mx-auto py-10 px-4 sm:px-6">
      
      {/* Navigation */}
      <Link href={backHref} className={`text-sm tracking-wide font-medium text-${themeAccent}-600 dark:text-${themeAccent}-400 hover:text-${themeAccent}-800 dark:hover:text-${themeAccent}-300 transition-colors mb-6 inline-block`}>
        &larr; Back to Dashboard
      </Link>

      {/* Header Card */}
      <div className={`relative overflow-hidden bg-white dark:bg-zinc-900 border-2 ${isInterviewer ? 'border-purple-100 dark:border-purple-900/40' : 'border-rose-100 dark:border-rose-900/40'} rounded-3xl shadow-xl shadow-${themeAccent}-900/5 dark:shadow-${themeAccent}-900/10 p-8 sm:p-12 mb-8`}>
        {/* Abstract Background Blob */}
        <div className={`absolute -top-32 -right-32 w-96 h-96 bg-${themeAccent}-400/10 dark:bg-${themeAccent}-600/10 rounded-full blur-3xl`}></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full ${interview.status === 'CANCELED' ? 'bg-red-100 text-red-700 ring-red-500/20' : `bg-${themeAccent}-100 dark:bg-${themeAccent}-900/50 text-${themeAccent}-700 dark:text-${themeAccent}-300 ring-1 ring-inset ring-${themeAccent}-500/20`}`}>
                {interview.status}
              </span>
              <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                {interview.durationMinutes} Minutes
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
              {interview.title}
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 font-medium">
              {formattedDate} at {formattedTime}
            </p>
          </div>

          <div className="shrink-0 mt-4 md:mt-0 flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
             {isInterviewer && (
                <>
                  <RescheduleButton interviewId={interview.id} />
                  {interview.status === "SCHEDULED" && <CancelButton interviewId={interview.id} />}
                </>
             )}
             {interview.status === 'CANCELED' ? (
               <Button size="lg" disabled className={`h-14 px-8 text-lg font-bold rounded-2xl shadow-lg border-transparent bg-gray-300 text-gray-500`}>
                 {isInterviewer ? 'Open Interview Room' : 'Join Interview Room'}
               </Button>
             ) : (
               <Link href={`/interview/${interview.id}/live`}>
                 <Button size="lg" className={`h-14 px-8 text-lg font-bold rounded-2xl shadow-lg border-transparent shadow-${themeAccent}-600/20 bg-${themeAccent}-600 hover:bg-${themeAccent}-700 hover:-translate-y-1 transition-all`}>
                   {isInterviewer ? 'Open Interview Room' : 'Join Interview Room'}
                 </Button>
               </Link>
             )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Participants Panel */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-gray-100 dark:border-zinc-800 p-8 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            Participants
          </h3>
          
          <div className="space-y-6">
            {/* Interviewer */}
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg bg-${themeAccent}-100 dark:bg-${themeAccent}-900/50 text-${themeAccent}-700 dark:text-${themeAccent}-300`}>
                {interview?.interviewer?.name ? interview.interviewer.name.charAt(0) : 'I'}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Interviewer</p>
                <p className="font-bold text-gray-900 dark:text-white">{interview?.interviewer?.name || interview?.interviewer?.email || "TBD"}</p>
              </div>
            </div>

            <div className="w-full h-px bg-gray-100 dark:bg-zinc-800"></div>

            {/* Candidate */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400">
                {(interview.candidate?.name || interview.candidateName || "").charAt(0) || 'C'}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-0.5">Candidate</p>
                <p className="font-bold text-gray-900 dark:text-white">{maskName(interview.candidate?.name || interview.candidateName)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Secure Notes Panel */}
        {isInterviewer ? (
          <div className="bg-amber-50/50 dark:bg-amber-950/10 rounded-3xl border border-amber-100 dark:border-amber-900/30 p-8 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-10">
               <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
             </div>
             <h3 className="text-xl font-bold text-amber-900 dark:text-amber-400 mb-4 flex items-center gap-2 relative z-10">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
               Private Notes
             </h3>
             <p className="text-xs font-bold text-amber-700/60 dark:text-amber-500/50 uppercase tracking-wider mb-4 relative z-10">Visible only to you</p>
             <div className="relative z-10 text-amber-900/80 dark:text-amber-200/80 font-medium whitespace-pre-wrap leading-relaxed">
               {interview.notes || "No internal notes were attached to this interview."}
             </div>
          </div>
        ) : (
          <div className="bg-gray-50/50 dark:bg-zinc-900/30 rounded-3xl border border-gray-100 dark:border-zinc-800 p-8 shadow-sm flex flex-col items-center justify-center text-center min-h-[200px]">
            <div className="w-16 h-16 bg-gray-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-gray-400 mb-4">
               <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
            </div>
            <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Ready to shine?</h4>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-[250px]">
              Review your basics, take a deep breath, and click join when the interviewer opens the room.
            </p>
          </div>
        )}
      </div>

    </div>
  )
}
