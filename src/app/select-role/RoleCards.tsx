"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { saveUserRole } from "./actions";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { Role } from "@prisma/client";

export function RoleCards() {
  const { user, isLoaded } = useUser();
  const { openSignUp } = useClerk();
  const router = useRouter();
  const [loadingRole, setLoadingRole] = useState<string | null>(null);

  // Auto-resume role selection if user just completed the sign-up flow
  useEffect(() => {
    if (isLoaded && user) {
      const pendingRole = localStorage.getItem("pending_iqmela_role") as Role | null;
      if (pendingRole && !loadingRole) {
        localStorage.removeItem("pending_iqmela_role");
        handleRoleSelect(pendingRole);
      }
    }
  }, [isLoaded, user]);

  async function handleRoleSelect(role: Role) {
    if (loadingRole) return;
    setLoadingRole(role);

    // If the user isn't logged in yet, queue the role and force them through the auth gate!
    if (isLoaded && !user) {
      localStorage.setItem("pending_iqmela_role", role);
      openSignUp({ fallbackRedirectUrl: "/select-role" });
      setLoadingRole(null); // Stop spinner, wait for Clerk modal
      return;
    }

    try {
      // 1. Tell backend to update DB and Clerk APIs
      await saveUserRole(role);
      
      // 2. 🔥 THE CRITICAL FIX: The backend updated Clerk, but our browser cookie is stale!
      // This forces the Clerk Client to wipe the old token and fetch the brand new one containing our role.
      await user?.reload();

      // 3. Now it is completely safe to navigate!
      // We use window.location.href instead of router.push to force a HARD navigation.
      // This forces Next.js to bypass the App Router cache and hit middleware.ts fresh, guaranteeing it reads our new cookie!
      const ROLE_TO_URL: Record<string, string> = {
        PUBLIC_CANDIDATE: "candidate",
        PUBLIC_INTERVIEWER: "interviewer",
        ADMIN: "org-admin",
      };
      const urlSegment = ROLE_TO_URL[role] ?? role.toLowerCase();
      window.location.href = `/${urlSegment}/dashboard`;
    } catch (error) {
      console.error(error);
      setLoadingRole(null);
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10 w-full max-w-6xl">
      {/* Candidate Card */}
      <button 
        type="button" 
        onClick={() => handleRoleSelect("PUBLIC_CANDIDATE")} 
        className="w-full text-left group outline-none h-full focus:ring-2 focus:ring-rose-500 rounded-xl"
        disabled={!!loadingRole}
      >
        <Card className={`w-full h-full flex flex-col items-center text-center p-10 transition-all duration-300 ${loadingRole === "PUBLIC_CANDIDATE" ? 'opacity-50 scale-95' : 'hover:bg-rose-50/50 dark:hover:bg-rose-950/20 hover:shadow-2xl shadow-lg hover:-translate-y-2 border-2 border-gray-100 dark:border-zinc-800 hover:border-rose-400 dark:hover:border-rose-600'}`}>
          <div className="w-24 h-24 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center mb-8 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform duration-500 ease-out">
            {loadingRole === "PUBLIC_CANDIDATE" ? (
                <div className="w-8 h-8 rounded-full border-4 border-rose-600 border-t-transparent animate-spin"></div>
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
        onClick={() => handleRoleSelect("PUBLIC_INTERVIEWER")} 
        className="w-full text-left group outline-none h-full focus:ring-2 focus:ring-purple-500 rounded-xl"
        disabled={!!loadingRole}
      >
        <Card className={`w-full h-full flex flex-col items-center text-center p-10 transition-all duration-300 ${loadingRole === "PUBLIC_INTERVIEWER" ? 'opacity-50 scale-95' : 'hover:bg-purple-50/50 dark:hover:bg-purple-950/20 hover:shadow-2xl shadow-lg hover:-translate-y-2 border-2 border-gray-100 dark:border-zinc-800 hover:border-purple-400 dark:hover:border-purple-600'}`}>
          <div className="w-24 h-24 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center mb-8 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform duration-500 ease-out">
            {loadingRole === "PUBLIC_INTERVIEWER" ? (
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

      {/* Admin Card */}
      <button 
        type="button" 
        onClick={() => {
          setLoadingRole("ADMIN");
          window.location.href = "/create-org";
        }} 
        className="w-full text-left group outline-none h-full focus:ring-2 focus:ring-rose-500 rounded-xl"
        disabled={!!loadingRole}
      >
        <Card className={`w-full h-full flex flex-col items-center text-center p-10 transition-all duration-300 ${loadingRole === "ADMIN" ? 'opacity-50 scale-95' : 'hover:bg-rose-50/50 dark:hover:bg-rose-950/20 hover:shadow-2xl shadow-lg hover:-translate-y-2 border-2 border-gray-100 dark:border-zinc-800 hover:border-rose-400 dark:hover:border-rose-600'}`}>
          <div className="w-24 h-24 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center mb-8 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform duration-500 ease-out">
            {loadingRole === "ADMIN" ? (
                <div className="w-8 h-8 rounded-full border-4 border-rose-600 border-t-transparent animate-spin"></div>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            )}
          </div>
          <CardTitle className="text-2xl sm:text-3xl mb-4 font-bold">I&apos;m an Org Admin</CardTitle>
          <CardContent className="px-0 pb-0">
            <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
              I want to set up my company&apos;s hiring workspace — manage positions, teams, and the recruitment pipeline.
            </p>
          </CardContent>
        </Card>
      </button>
    </div>
  );
}
