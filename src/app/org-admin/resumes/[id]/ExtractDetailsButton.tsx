"use client"
import { toast } from "sonner";

import { Button } from "@/components/ui/button"
import { useTransition } from "react"
import { extractCandidateDetailsAction } from "./actions"

export function ExtractDetailsButton({ resumeId, disabled }: { resumeId: string, disabled?: boolean }) {
  const [isPending, startTransition] = useTransition()

  const handleExtract = () => {
    startTransition(async () => {
      const result = await extractCandidateDetailsAction(resumeId)
      if (!result.success) {
        toast.error(result.error || "Operation failed")
      }
    })
  }

  return (
    <Button
      onClick={handleExtract}
      disabled={isPending || disabled}
      variant="outline"
      size="sm"
      className="bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900/50 shadow-sm transition-all rounded-lg"
    >
      {isPending ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-emerald-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          Mining Data...
        </>
      ) : (
        <>
          <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          Extract Candidate Info
        </>
      )}
    </Button>
  )
}
