"use client"

import { useState, useTransition } from "react"
import { updateOrgPlanTier, ensureOrgRecord, updateOrgAiStrategy } from "./actions"
import { OrgPlanTier } from "@prisma/client"
import { Shield, Check, Loader2, Sparkles, Lock, Unlock } from "lucide-react"

const TIERS: { tier: OrgPlanTier; label: string; description: string; color: string; accent: string }[] = [
  {
    tier: "VENDOR_FREE",
    label: "Vendor",
    description: "Vendor portal access only. No hiring pipeline.",
    color: "border-rose-500/30 bg-rose-500/5",
    accent: "text-rose-400",
  },
  {
    tier: "FREE",
    label: "Free",
    description: "Basic access. Limited positions and no AI features.",
    color: "border-zinc-500/30 bg-zinc-500/5",
    accent: "text-zinc-400",
  },
  {
    tier: "PLUS",
    label: "Plus — $49/mo",
    description: "AI pipeline, interviews, up to 5 team members.",
    color: "border-rose-500/30 bg-rose-500/5",
    accent: "text-rose-400",
  },
  {
    tier: "ULTRA",
    label: "Ultra — $500/mo",
    description: "Full AI + behavioral intelligence, unlimited positions.",
    color: "border-pink-500/30 bg-pink-500/5",
    accent: "text-pink-400",
  },
  {
    tier: "ENTERPRISE",
    label: "Enterprise",
    description: "Custom pricing. Unlimited seats, dedicated CSM.",
    color: "border-amber-500/30 bg-amber-500/5",
    accent: "text-amber-400",
  },
]

interface Feature {
  key: string
  label: string
  description: string
  enabled: boolean
}

interface OrgManagementPanelProps {
  orgId: string
  orgName: string
  currentTier: OrgPlanTier | null
  features: Feature[]
  defaultAiGenerationStrategy?: string
}

export function OrgManagementPanel({ orgId, orgName, currentTier, features, defaultAiGenerationStrategy }: OrgManagementPanelProps) {
  const [isPending, startTransition] = useTransition()
  const [activeTier, setActiveTier] = useState(currentTier)
  const [activeAiStrategy, setActiveAiStrategy] = useState(defaultAiGenerationStrategy ?? "STANDARDIZED")
  const [successMsg, setSuccessMsg] = useState("")

  function handleTierChange(newTier: OrgPlanTier) {
    if (newTier === activeTier) return

    startTransition(async () => {
      try {
        // First ensure the org record exists
        if (!currentTier) {
          await ensureOrgRecord(orgId, orgName)
        }
        const result = await updateOrgPlanTier(orgId, newTier)
        if (result.success) {
          setActiveTier(newTier)
          setSuccessMsg(`Plan updated to ${TIERS.find(t => t.tier === newTier)?.label}`)
          setTimeout(() => setSuccessMsg(""), 3000)
        }
      } catch (err: any) {
        console.error("Failed to update tier:", err)
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Success toast */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium animate-in fade-in-0 slide-in-from-top-2 duration-200">
          <Check className="w-4 h-4" />
          {successMsg}
        </div>
      )}

      {/* ── Plan Tier Selector ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-bold text-white">Plan Tier</h3>
          {isPending && <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" />}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TIERS.map(({ tier, label, description, color, accent }) => {
            const isActive = tier === activeTier
            return (
              <button
                key={tier}
                type="button"
                disabled={isPending}
                onClick={() => handleTierChange(tier)}
                className={`relative text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                  isActive
                    ? `${color} border-current ring-1 ring-current/20 shadow-lg`
                    : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900"
                } ${isPending ? "opacity-60 cursor-wait" : "cursor-pointer"}`}
              >
                {isActive && (
                  <div className="absolute top-3 right-3">
                    <div className={`w-5 h-5 rounded-full ${accent} bg-current/20 flex items-center justify-center`}>
                      <Check className="w-3 h-3 text-current" />
                    </div>
                  </div>
                )}
                <div className={`text-sm font-bold ${isActive ? accent : "text-zinc-300"}`}>
                  {label}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed pr-8">{description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Feature Flags ──────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="text-lg font-bold text-white">Feature Access</h3>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 ml-2">
            Determined by plan tier
          </span>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="divide-y divide-zinc-800/60">
            {features.map((f) => (
              <div key={f.key} className="flex items-center justify-between px-5 py-3.5 hover:bg-zinc-800/20 transition-colors">
                <div className="flex items-center gap-3">
                  {f.enabled ? (
                    <Unlock className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Lock className="w-4 h-4 text-zinc-600" />
                  )}
                  <div>
                    <p className={`text-sm font-medium ${f.enabled ? "text-white" : "text-zinc-500"}`}>
                      {f.label}
                    </p>
                    <p className="text-[10px] text-zinc-600">{f.description}</p>
                  </div>
                </div>
                <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                  f.enabled
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-zinc-800 text-zinc-600 border border-zinc-700"
                }`}>
                  {f.enabled ? "Enabled" : "Locked"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── AI Config Management ───────────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-pink-400" />
          <h3 className="text-lg font-bold text-white">Default AI Generation Strategy</h3>
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 ml-2">
            Applied to all new positions
          </span>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <select
            value={activeAiStrategy}
            disabled={isPending}
            onChange={(e) => {
              const val = e.target.value;
              startTransition(async () => {
                try {
                  if (!currentTier) await ensureOrgRecord(orgId, orgName)
                  const result = await updateOrgAiStrategy(orgId, val)
                  if (result.success) {
                    setActiveAiStrategy(val)
                    setSuccessMsg(`Default AI Strategy updated to ${val}`)
                    setTimeout(() => setSuccessMsg(""), 3000)
                  }
                } catch (err: any) {
                  console.error("Failed to update AI strategy:", err)
                }
              })
            }}
            className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded-lg p-3 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-colors"
          >
            <option value="STANDARDIZED">STANDARDIZED - Zero Cost, High Volume (Requires Question Bank)</option>
            <option value="TAILORED">TAILORED - Dynamic per candidate, uses AI tokens, async queue</option>
          </select>
        </div>
      </div>

    </div>
  )
}
