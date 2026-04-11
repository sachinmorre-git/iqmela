"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveUserRole } from "./actions";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { Role } from "@prisma/client";

export function RoleCards() {
  const { user } = useUser();
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  async function handleRoleSelect(role: Role) {
    if (loadingRole) return;
    setLoadingRole(role);

    try {
      // 1. Tell backend to update DB and Clerk APIs
      await saveUserRole(role);
      
      // 2. 🔥 THE CRITICAL FIX: The backend updated Clerk, but our browser cookie is stale!
      // This forces the Clerk Client to wipe the old token and fetch the brand new one containing our role.
      await user?.reload();

      // 3. Now it is completely safe to navigate!
      // We use window.location.href instead of router.push to force a HARD navigation.
      // This forces Next.js to bypass the App Router cache and hit middleware.ts fresh, guaranteeing it reads our new cookie!
      window.location.href = `/${role.toLowerCase()}/dashboard`;
    } catch (error) {
      console.error(error);
      setLoadingRole(null);
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-10 w-full max-w-4xl">
      {/* Candidate Card */}
      <button 
        type="button" 
        onClick={() => handleRoleSelect("CANDIDATE")} 
        className="w-full text-left group outline-none h-full focus:ring-2 focus:ring-indigo-500 rounded-xl"
        disabled={!!loadingRole}
      >
        <Card className={`w-full h-full flex flex-col items-center text-center p-10 transition-all duration-300 ${loadingRole === "CANDIDATE" ? 'opacity-50 scale-95' : 'hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20 hover:shadow-2xl shadow-lg hover:-translate-y-2 border-2 border-gray-100 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600'}`}>
          <div className="w-24 h-24 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mb-8 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform duration-500 ease-out">
            {loadingRole === "CANDIDATE" ? (
                <div className="w-8 h-8 rounded-full border-4 border-indigo-600 border-t-transparent animate-spin"></div>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            )}
          </div>
          <CardTitle className="text-2xl sm:text-3xl mb-4 font-bold">I&apos;m a Candidate</CardTitle>
          <CardContent className="px-0 pb-0">
            <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
              I want to practice coding problems, take technical assessments, and ace my next interview.
            </p>
          </CardContent>
        </Card>
      </button>

      {/* Interviewer Card */}
      <button 
        type="button" 
        onClick={() => handleRoleSelect("INTERVIEWER")} 
        className="w-full text-left group outline-none h-full focus:ring-2 focus:ring-purple-500 rounded-xl"
        disabled={!!loadingRole}
      >
        <Card className={`w-full h-full flex flex-col items-center text-center p-10 transition-all duration-300 ${loadingRole === "INTERVIEWER" ? 'opacity-50 scale-95' : 'hover:bg-purple-50/50 dark:hover:bg-purple-950/20 hover:shadow-2xl shadow-lg hover:-translate-y-2 border-2 border-gray-100 dark:border-zinc-800 hover:border-purple-400 dark:hover:border-purple-600'}`}>
          <div className="w-24 h-24 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center mb-8 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform duration-500 ease-out">
            {loadingRole === "INTERVIEWER" ? (
                <div className="w-8 h-8 rounded-full border-4 border-purple-600 border-t-transparent animate-spin"></div>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 7h10"/><path d="M7 12h10"/><path d="M7 17h10"/></svg>
            )}
          </div>
          <CardTitle className="text-2xl sm:text-3xl mb-4 font-bold">I&apos;m an Interviewer</CardTitle>
          <CardContent className="px-0 pb-0">
            <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
              I want to source engineering talent, construct technical evaluations, and conduct live coding sessions.
            </p>
          </CardContent>
        </Card>
      </button>
    </div>
  );
}
