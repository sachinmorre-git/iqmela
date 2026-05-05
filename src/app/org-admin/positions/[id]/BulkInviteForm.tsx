"use client"

import { useTransition, useState } from "react"
import { bulkCreateInviteDraftsAction, bulkSendInvitesAction } from "./actions"

export function BulkInviteForm({
  positionId,
  children
}: {
  positionId: string
  children: React.ReactNode
}) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ type: "DRAFT" | "SEND", summary: string, details?: string, failedLog?: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSendInvites = (formData: FormData) => {
    const selectedIds = formData.getAll("resumeIds") as string[]
    if (selectedIds.length === 0) {
      setError("Please select at least one candidate first.")
      setTimeout(() => setError(null), 3000)
      return
    }

    setError(null)
    setResult(null)

    startTransition(async () => {
      const res = await bulkSendInvitesAction(positionId, selectedIds)
      if (res.success && res.result) {
        setResult({
          type: "SEND",
          summary: `Successfully sent ${res.result.sent} Invitation(s).`,
          details: res.result.skipped > 0 ? `Skipped ${res.result.skipped} candidate(s). Email missing or already sent.` : undefined,
          failedLog: res.result.failedLog
        })
      } else {
        setError(res.error || "Failed to send invites")
      }
    })
  }

  return (
    <form className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
         <h3 className="font-bold text-gray-900 dark:text-white text-base">Shortlisted Candidates</h3>
         <div className="flex items-center gap-2">
           <button
             formAction={handleSendInvites}
             disabled={isPending}
             className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 transition-all shadow-sm disabled:opacity-50"
             title="Send invites to selected candidates"
           >
             {isPending ? (
               <>
                  <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg>
                  Sending...
               </>
             ) : (
               <>
                 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2z"/></svg>
                 Send Invites
               </>
             )}
           </button>
         </div>
      </div>

      {(result || error) && (
        <div className={`p-4 rounded-xl border flex flex-col gap-2 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300 ${
          error ? "bg-red-50 border-red-100 text-red-700 dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-400" :
          "bg-rose-50 border-rose-100 text-rose-800 dark:bg-rose-900/20 dark:border-rose-900/30 dark:text-rose-300"
        }`}>
          {error && <p className="text-sm font-bold">{error}</p>}
          {result && (
            <>
              <p className="text-sm font-bold">✓ {result.summary}</p>
              {result.details && <p className="text-xs opacity-90 mt-1">{result.details}</p>}
              {result.failedLog && result.failedLog.length > 0 && (
                <div className="mt-2 flex flex-col gap-1 max-h-32 overflow-y-auto bg-black/5 dark:bg-black/20 p-2 rounded-lg">
                  {result.failedLog.map((log, index) => (
                    <p key={index} className="text-[11px] leading-tight opacity-80">{log}</p>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="w-full">
        {children}
      </div>
    </form>
  )
}
