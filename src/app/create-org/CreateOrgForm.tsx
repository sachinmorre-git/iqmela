"use client"

import { useState } from "react"
import { useClerk } from "@clerk/nextjs"
import { handleCreateOrg } from "./actions"
import { Building2, Sparkles, AlertCircle, Loader2, ArrowRight } from "lucide-react"

export function CreateOrgForm() {
  const { setActive } = useClerk()
  const [orgName, setOrgName] = useState("")
  const [state, setState] = useState<"idle" | "creating" | "success" | "error">("idle")
  const [error, setError] = useState("")
  const [createdOrg, setCreatedOrg] = useState<{ orgId: string; orgName: string } | null>(null)

  const isValid = orgName.trim().length >= 2 && orgName.trim().length <= 50

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isValid || state === "creating") return

    setState("creating")
    setError("")

    try {
      const result = await handleCreateOrg(orgName.trim())

      if (!result.success) {
        setState("error")
        setError(result.error || "Something went wrong.")
        return
      }

      // Success! Set the org as active in Clerk session
      setState("success")
      setCreatedOrg({ orgId: result.orgId!, orgName: result.orgName! })

      // Activate the org in Clerk (this updates the session)
      await setActive({ organization: result.orgId! })

      // Hard navigate to force middleware re-evaluation
      setTimeout(() => {
        window.location.href = "/org-admin/dashboard"
      }, 1500) // Brief delay to show success animation
    } catch (err: any) {
      setState("error")
      setError(err.message || "An unexpected error occurred.")
    }
  }

  // ── Success State ──────────────────────────────────────────────────────
  if (state === "success" && createdOrg) {
    return (
      <div className="bg-zinc-900/80 border border-rose-500/30 rounded-2xl p-8 text-center backdrop-blur-sm animate-in fade-in-0 zoom-in-95 duration-300">
        <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto mb-5">
          <Sparkles className="w-7 h-7 text-rose-400 animate-pulse" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {createdOrg.orgName} is ready!
        </h2>
        <p className="text-zinc-400 text-sm mb-4">
          Your workspace has been created. Redirecting to your dashboard...
        </p>
        <div className="flex items-center justify-center gap-2 text-rose-400 text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Setting up your workspace...</span>
        </div>
      </div>
    )
  }

  // ── Form ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm">
        {/* Input */}
        <label className="block mb-2">
          <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Company Name
          </span>
        </label>
        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600">
            <Building2 className="w-4.5 h-4.5" />
          </div>
          <input
            type="text"
            value={orgName}
            onChange={(e) => {
              setOrgName(e.target.value)
              if (state === "error") setState("idle")
            }}
            placeholder="e.g., Acme Inc."
            maxLength={50}
            autoFocus
            autoComplete="organization"
            disabled={state === "creating"}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-zinc-950/80 border border-zinc-700 text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-rose-500/40 focus:border-rose-500/50 transition-all text-sm font-medium disabled:opacity-50"
          />
          {/* Character count */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <span className={`text-[10px] font-mono ${orgName.length > 40 ? "text-amber-400" : "text-zinc-700"}`}>
              {orgName.length}/50
            </span>
          </div>
        </div>

        {/* Validation hint */}
        {orgName.length > 0 && orgName.trim().length < 2 && (
          <p className="text-[11px] text-amber-400 mt-1.5 pl-1">
            Name must be at least 2 characters
          </p>
        )}

        {/* Error */}
        {state === "error" && error && (
          <div className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={!isValid || state === "creating"}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl bg-gradient-to-r from-rose-600 to-emerald-600 text-white font-bold text-sm shadow-lg shadow-rose-600/20 hover:shadow-rose-600/30 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none"
      >
        {state === "creating" ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating workspace...
          </>
        ) : (
          <>
            Create My Workspace
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      {/* Starter plan badge */}
      <div className="flex items-center justify-center gap-2 text-[11px] text-zinc-600">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold">
          FREE
        </span>
        <span>Starter plan · 3 positions · 3 team members · Upgrade anytime</span>
      </div>
    </form>
  )
}
