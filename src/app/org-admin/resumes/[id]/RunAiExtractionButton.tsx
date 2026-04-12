"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { runAiExtractionAction } from "./actions"

export function RunAiExtractionButton({
  resumeId,
  disabled,
}: {
  resumeId: string
  disabled?: boolean
}) {
  const [isPending, startTransition] = useTransition()

  const handleClick = () => {
    startTransition(async () => {
      const result = await runAiExtractionAction(resumeId)
      if (!result.success) {
        alert(result.error)
      }
    })
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isPending || disabled}
      size="sm"
      className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-sm shadow-violet-500/30 border-0 transition-all rounded-lg"
    >
      {isPending ? (
        <>
          <svg
            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Running AI...
        </>
      ) : (
        <>
          <svg className="mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a10 10 0 1 0 10 10" /><path d="M12 8v4l2 2" /><path d="M18 2v4h4" /><path d="M22 2 18 6" />
          </svg>
          Run AI Extraction
        </>
      )}
    </Button>
  )
}
