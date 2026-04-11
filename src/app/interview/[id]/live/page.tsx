import { auth } from "@clerk/nextjs/server"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { PreJoinClient } from "./PreJoinClient"
import { Lock } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: 'Live Room | IQMela',
}

export default async function LiveRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { userId } = await auth();
  
  if (!userId) redirect("/sign-in");

  const interview = await prisma.interview.findUnique({
    where: { id },
    select: { title: true, candidateId: true, interviewerId: true, status: true, notes: true }
  });

  if (!interview) notFound();

  // Strict Authorization
  if (interview.candidateId !== userId && interview.interviewerId !== userId) {
    return (
      <div className="flex-1 w-full flex items-center justify-center bg-gray-50 dark:bg-black min-h-screen p-4">
        <div className="max-w-md w-full bg-white dark:bg-zinc-950 border border-red-200 dark:border-red-900/50 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
            <Lock className="w-10 h-10 text-red-600 dark:text-red-500" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white mb-4">Access Denied</h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8 font-medium">
            You do not have the required authorization to view or join this live room. Only the specifically assigned candidate and interviewer are permitted entry.
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

  // Prevent accessing live room of canceled interview
  if (interview.status === "CANCELED") {
    redirect(`/interview/${id}`);
  }

  return (
    <div className="flex-1 w-full bg-gray-50/50 dark:bg-black min-h-screen flex items-center justify-center">
       <PreJoinClient 
         interviewId={id} 
         roomTitle={interview.title} 
         isInterviewer={interview.interviewerId === userId}
         initialNotes={interview.notes || ""}
       />
    </div>
  )
}
