"use client"
import { toast } from "sonner";

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { analyzeJdAction } from "./actions"

export function AnalyzeJdButton({ positionId, hasJdAnalysis = false }: { positionId: string, hasJdAnalysis?: boolean }) {
  const [isPending, setIsPending] = useState(false)

  async function handleAnalyze() {
    setIsPending(true)
    try {
      // Force re-analyze if triggered manually
      const res = await analyzeJdAction(positionId, true)
      if (!res.success) {
        toast.error(res.error || "Operation failed")
      }
    } catch (e) {
      toast.error("Failed to analyze JD")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="shrink-0 flex items-center gap-2"
      onClick={handleAnalyze}
      disabled={isPending}
    >
      {isPending ? (
        <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m2 12 5.25 5 2.625-3"/><path d="m8.625 14 5.25 5 2.625-3"/><path d="m15.25 16 5.625 5"/></svg>
      )}
      {isPending ? "Analyzing..." : hasJdAnalysis ? "Re-Analyze JD" : "Analyze JD"}
    </Button>
  )
}
