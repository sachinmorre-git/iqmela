import { prisma } from "@/lib/prisma";
import { createInterview } from "./actions";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

export const metadata = {
  title: "Schedule Interview | IQMela",
};

export default async function ScheduleInterviewPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Fetch all candidates from the database
  const candidates = await prisma.user.findMany({
    where: { roles: { has: "PUBLIC_CANDIDATE" } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true },
  });

  return (
    <div className="flex-1 w-full max-w-3xl mx-auto py-12 px-4 sm:px-6">
      
      <div className="mb-8">
        <Link href="/interviewer/dashboard" className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mb-4 inline-block">&larr; Back to Dashboard</Link>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">Schedule New Interview</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">Fill out the details below to initiate a technical session with a candidate.</p>
      </div>

      <div className="bg-white dark:bg-zinc-900/50 rounded-2xl shadow-sm border border-gray-200 dark:border-zinc-800 p-6 md:p-8">
        <form action={createInterview} className="space-y-6">
          
          {/* Title Area */}
          <div>
            <label htmlFor="title" className="block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-2">Interview Title</label>
            <input 
              required
              id="title"
              name="title" 
              type="text" 
              placeholder="e.g. Senior Frontend Engineer - Technical Screen"
              className="w-full rounded-lg border-gray-300 dark:border-zinc-700 bg-transparent px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Date Picker */}
            <div className="md:col-span-1">
              <label htmlFor="date" className="block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-2">Date</label>
              <input 
                required
                id="date"
                name="date" 
                type="date" 
                className="w-full rounded-lg border-gray-300 dark:border-zinc-700 bg-transparent px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:text-white"
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            
            {/* Time Picker */}
            <div className="md:col-span-1">
              <label htmlFor="time" className="block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-2">Time (UTC)</label>
              <input 
                required
                id="time"
                name="time" 
                type="time" 
                className="w-full rounded-lg border-gray-300 dark:border-zinc-700 bg-transparent px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:text-white"
              />
            </div>

            {/* Duration */}
            <div className="md:col-span-1">
              <label htmlFor="duration" className="block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-2">Duration (mins)</label>
              <select 
                id="duration"
                name="duration" 
                className="w-full rounded-lg border-gray-300 dark:border-zinc-700 bg-transparent px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:text-white"
                defaultValue="60"
              >
                <option value="30" className="dark:bg-zinc-800">30 minutes</option>
                <option value="45" className="dark:bg-zinc-800">45 minutes</option>
                <option value="60" className="dark:bg-zinc-800">60 minutes</option>
                <option value="90" className="dark:bg-zinc-800">90 minutes</option>
                <option value="120" className="dark:bg-zinc-800">120 minutes</option>
              </select>
            </div>
          </div>

          {/* Candidate Selector */}
          <div>
            <label htmlFor="candidateId" className="block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-2">Select Candidate</label>
            <select 
              required
              id="candidateId"
              name="candidateId" 
              defaultValue=""
              className="w-full rounded-lg border-gray-300 dark:border-zinc-700 bg-transparent px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:text-white"
            >
              <option value="" disabled className="dark:bg-zinc-800">-- Choose a registered candidate --</option>
              {candidates.length === 0 && (
                 <option disabled className="text-red-500">No candidates available</option>
              )}
              {candidates.map(candidate => (
                <option key={candidate.id} value={candidate.id} className="dark:bg-zinc-800">
                  {candidate.name ? `${candidate.name} (${candidate.email})` : candidate.email}
                </option>
              ))}
            </select>
          </div>

          {/* Notes Area */}
          <div>
            <label htmlFor="notes" className="block text-sm font-semibold text-gray-900 dark:text-gray-200 mb-2">Internal Notes (Optional)</label>
            <textarea 
              id="notes"
              name="notes" 
              rows={4}
              placeholder="E.g. Focus on algorithms arrays and dynamic programming. Ask about their previous role at X company."
              className="w-full rounded-lg border-gray-300 dark:border-zinc-700 bg-transparent px-4 py-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:text-white"
            ></textarea>
          </div>

          {/* Action Row */}
          <div className="pt-4 flex justify-end">
            <Button type="submit" size="lg" className="w-full sm:w-auto px-10">
              Schedule Interview
            </Button>
          </div>
          
        </form>
      </div>

    </div>
  );
}
