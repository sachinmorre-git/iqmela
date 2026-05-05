"use client"

import { useState } from "react"
import { testAiProviderAction } from "./actions"

export function AiTestButton() {
  const [isPending, setIsPending] = useState(false)
  const [result, setResult] = useState<{ success: boolean; msg: string; provider?: string } | null>(null)

  async function handleTest() {
    setIsPending(true)
    setResult(null)
    
    try {
      const res = await testAiProviderAction()
      if (res.success) {
        setResult({ success: true, msg: "Connected successfully. Preview: " + res.dataPreview, provider: res.provider })
      } else {
        setResult({ success: false, msg: res.error || "Failed." })
      }
    } catch {
      setResult({ success: false, msg: "Network error." })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="mt-4 flex flex-col items-start gap-3">
      <button
        onClick={handleTest}
        disabled={isPending}
        className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
      >
        {isPending ? "Testing..." : "Test AI Connection"}
      </button>

      {result && (
        <div className={`text-sm px-3 py-2 rounded-md border ${result.success ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          <span className="font-semibold">{result.success ? "Success:" : "Error:"}</span> {result.msg}
          {result.provider && <span className="block text-xs mt-1 opacity-80">Provider hit: {result.provider}</span>}
        </div>
      )}
    </div>
  )
}
