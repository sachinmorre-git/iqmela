"use client"

import { Button } from "@/components/ui/button"
import { useTransition } from "react"
import { extractResumeTextAction } from "./actions"

export function ExtractTextButton({ resumeId, disabled }: { resumeId: string, disabled?: boolean }) {
  const [isPending, startTransition] = useTransition()

  const handleExtract = () => {
    startTransition(async () => {
      const result = await extractResumeTextAction(resumeId)
      if (!result.success) {
        alert(result.error)
      }
    })
  }

  return (
    <Button
      onClick={handleExtract}
      disabled={isPending || disabled}
      variant="outline"
      size="sm"
      className="bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-900/50 shadow-sm transition-all rounded-lg"
    >
      {isPending ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          Extracting...
        </>
      ) : (
        <>
          <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
          Extract Resume Text
        </>
      )}
    </Button>
  )
}
