"use client"

import { useState, useEffect } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Sparkles, X, Loader2 } from "lucide-react"
import { IntelligenceHubClient } from "../../candidates/[resumeId]/intelligence/IntelligenceHubClient"
import { getFullResumeData } from "./actions"

export function DeepAiDrawer({ resume, userRoles, compactMode = false, children, openProp, onOpenChangeProp, focusedRoundId }: { resume: any; userRoles: string[]; compactMode?: boolean; children?: React.ReactNode; openProp?: boolean; onOpenChangeProp?: (open: boolean) => void; focusedRoundId?: string; }) {
  const isHiringManager = userRoles.some((r) => ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER"].includes(r));
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp !== undefined ? openProp : internalOpen;
  const setOpen = onOpenChangeProp || setInternalOpen;
  const [fullResume, setFullResume] = useState(resume);
  const [loading, setLoading] = useState(false);
  const isFailed = resume?.parsingStatus === "FAILED";

  useEffect(() => {
    // If the drawer opens and we don't have nested relations (like interviews), fetch them lazily
    if (open && !fullResume.interviews) {
      setLoading(true);
      getFullResumeData(resume.id).then((data) => {
        if (data) setFullResume(data);
        setLoading(false);
      }).catch(err => {
        console.error("Failed to fetch full resume", err);
        setLoading(false);
      });
    }
  }, [open, resume.id, fullResume.interviews]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        {children ? children : compactMode ? (
          <button
            type="button"
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 hover:scale-110 active:scale-95 transition-all shadow-sm cursor-pointer ${isFailed ? "bg-red-100 dark:bg-red-900/30 text-red-400" :
                resume.candidateName ? "bg-gradient-to-br from-rose-500 to-indigo-600 text-white" :
                  "bg-gray-100 dark:bg-zinc-800 text-gray-400"
              }`}
            title="Open Deep AI Intelligence"
          >
            {resume.candidateName ? (
              <Sparkles className="w-3.5 h-3.5" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
            )}
          </button>
        ) : (
          <button 
            className="group relative flex items-center justify-center p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/40 transition-all hover:scale-105 active:scale-95 shadow-sm overflow-hidden"
            title="Open Deep AI Intelligence"
          >
            {/* Subtle animated background glow */}
            <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/0 via-pink-400/20 to-blue-400/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            <Sparkles className="w-7 h-7 text-white drop-shadow-sm group-hover:animate-pulse relative z-10" />
          </button>
        )}
      </DialogPrimitive.Trigger>
      
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 h-full w-full sm:w-[540px] md:w-[700px] lg:w-[800px] max-w-[100vw] border-l border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-950 shadow-2xl transition-transform duration-300 ease-in-out data-[state=closed]:translate-x-full data-[state=open]:translate-x-0 flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 shrink-0 shadow-sm z-10 relative">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-rose-500 to-indigo-600 text-white shadow-md rounded-xl">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <DialogPrimitive.Title className="text-xl font-bold text-gray-900 dark:text-white">
                  Deep AI Intelligence
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest mt-0.5">
                  Candidate Fit Analysis & Insights
                </DialogPrimitive.Description>
              </div>
            </div>
            <DialogPrimitive.Close className="rounded-xl p-2.5 text-gray-400 hover:text-gray-600 dark:text-zinc-500 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500">
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </DialogPrimitive.Close>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
            <div className="max-w-4xl mx-auto pb-20">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-64 text-rose-500">
                  <Loader2 className="w-8 h-8 animate-spin mb-4" />
                  <p className="text-sm font-medium text-gray-500 dark:text-zinc-400">Loading Intelligence Data...</p>
                </div>
              ) : (
                <IntelligenceHubClient
                  resume={fullResume}
                  canReject={isHiringManager}
                  canOffer={isHiringManager}
                  userRoles={userRoles}
                  embeddedMode={true}
                  focusedRoundId={focusedRoundId}
                />
              )}
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
