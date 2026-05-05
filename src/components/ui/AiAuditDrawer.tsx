"use client"

import React, { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "./dialog"
import { Brain, AlertTriangle, CheckCircle, Info, Edit2 } from "lucide-react"
import { Button } from "./button"
import { Input } from "./input"
import { overrideAiDecision } from "@/app/org-admin/resumes/[id]/actions"

interface AiAuditDrawerProps {
  resumeId: string
  jdMatchScore: number | null
  jdMatchLabel: string | null
  rankingExplanation: string | null
  aiRecommendationRationale: string | null
  aiRedFlagsJson: any
  matchedSkillsJson: any
  missingSkillsJson: any
  aiOverrideScore?: number | null
  aiOverrideReason?: string | null
}

export function AiAuditDrawer({
  resumeId,
  jdMatchScore,
  jdMatchLabel,
  rankingExplanation,
  aiRecommendationRationale,
  aiRedFlagsJson,
  matchedSkillsJson,
  missingSkillsJson,
  aiOverrideScore,
  aiOverrideReason,
}: AiAuditDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isOverriding, setIsOverriding] = useState(false)
  const [newScore, setNewScore] = useState<string>(jdMatchScore?.toString() || "0")
  const [newLabel, setNewLabel] = useState<string>(jdMatchLabel || "MAYBE")
  const [reason, setReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Safe parse JSON arrays
  const redFlags = Array.isArray(aiRedFlagsJson) ? aiRedFlagsJson : []
  const matchedSkills = Array.isArray(matchedSkillsJson) ? matchedSkillsJson : []
  const missingSkills = Array.isArray(missingSkillsJson) ? missingSkillsJson : []

  const handleOverride = async () => {
    if (!reason.trim()) return alert("A justification reason is required for compliance logging.")
    
    setIsSubmitting(true)
    const res = await overrideAiDecision(resumeId, parseInt(newScore, 10), newLabel, reason)
    setIsSubmitting(false)
    
    if (res.success) {
      setIsOpen(false)
      setIsOverriding(false)
    } else {
      alert(res.error || "Failed to override.")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs font-medium text-rose-500 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 px-2 py-1 rounded-md transition-colors">
          <Brain className="w-3.5 h-3.5" />
          <span>AI Audit</span>
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between pr-8">
            <div>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Brain className="w-5 h-5 text-rose-500" />
                AI Decision Audit Trail
              </DialogTitle>
              <DialogDescription className="mt-1.5">
                Transparent view of exactly why the AI assigned this score.
              </DialogDescription>
            </div>
            {aiOverrideScore !== undefined && aiOverrideScore !== null && (
              <div className="px-3 py-1 bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold rounded-full border border-amber-200 dark:border-amber-500/30">
                ⚠️ HUMAN OVERRIDDEN
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* AI Score Box */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <div className="text-sm text-zinc-500 dark:text-zinc-400 font-medium mb-1">Original AI Score</div>
              <div className="text-3xl font-black text-zinc-900 dark:text-white">
                {jdMatchScore ?? "N/A"} <span className="text-sm font-medium text-zinc-400">/ 100</span>
              </div>
              <div className="text-sm font-medium mt-1 text-zinc-600 dark:text-zinc-300">{jdMatchLabel}</div>
            </div>
            
            {aiOverrideScore !== null && aiOverrideScore !== undefined && (
              <div className="bg-amber-50 dark:bg-amber-500/10 p-4 rounded-xl border border-amber-200 dark:border-amber-500/30">
                <div className="text-sm text-amber-600 dark:text-amber-400 font-medium mb-1">Human Override</div>
                <div className="text-3xl font-black text-amber-700 dark:text-amber-300">
                  {aiOverrideScore} <span className="text-sm font-medium opacity-60">/ 100</span>
                </div>
                <div className="text-sm font-medium mt-1 text-amber-700 dark:text-amber-300">Reason: {aiOverrideReason}</div>
              </div>
            )}
          </div>

          {/* AI Rationale */}
          <div className="space-y-2">
            <h4 className="text-sm font-bold flex items-center gap-2 text-zinc-900 dark:text-white">
              <Info className="w-4 h-4 text-blue-500" />
              AI Recommendation Rationale
            </h4>
            <div className="text-sm text-zinc-600 dark:text-zinc-300 bg-blue-50 dark:bg-blue-500/10 p-4 rounded-xl leading-relaxed">
              {aiRecommendationRationale || rankingExplanation || "No rationale generated."}
            </div>
          </div>

          {/* Red Flags */}
          {redFlags.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold flex items-center gap-2 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-4 h-4" />
                AI Identified Red Flags
              </h4>
              <ul className="space-y-2">
                {redFlags.map((flag: any, idx: number) => (
                  <li key={idx} className="text-sm text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10 p-3 rounded-lg border border-rose-100 dark:border-rose-500/20">
                    {typeof flag === 'string' ? flag : JSON.stringify(flag)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Skills Breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> Matched Skills
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {matchedSkills.length > 0 ? matchedSkills.map((s: string, i: number) => (
                  <span key={i} className="px-2 py-1 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs rounded-md border border-emerald-100 dark:border-emerald-500/20">
                    {s}
                  </span>
                )) : <span className="text-xs text-zinc-500">None</span>}
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Missing Skills
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {missingSkills.length > 0 ? missingSkills.map((s: string, i: number) => (
                  <span key={i} className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs rounded-md">
                    {s}
                  </span>
                )) : <span className="text-xs text-zinc-500">None</span>}
              </div>
            </div>
          </div>

          {/* Override Section */}
          <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-800">
            {!isOverriding ? (
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Disagree with the AI?</h4>
                  <p className="text-xs text-zinc-500 mt-0.5">EU AI Act / EEOC compliance requires human oversight capabilities.</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsOverriding(true)} className="gap-2">
                  <Edit2 className="w-3.5 h-3.5" /> Override AI Decision
                </Button>
              </div>
            ) : (
              <div className="space-y-4 bg-zinc-50 dark:bg-zinc-800/30 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                <h4 className="text-sm font-bold text-zinc-900 dark:text-white">Human Override Form</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">New Score (0-100)</label>
                    <Input 
                      type="number" 
                      min="0" max="100" 
                      value={newScore} 
                      onChange={(e) => setNewScore(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">New Label</label>
                    <select 
                      className="flex h-9 w-full rounded-md border border-zinc-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:focus-visible:ring-rose-500"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                    >
                      <option value="STRONG_HIRE">STRONG_HIRE</option>
                      <option value="HIRE">HIRE</option>
                      <option value="MAYBE">MAYBE</option>
                      <option value="NO_HIRE">NO_HIRE</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    Justification Reason (Required for Audit Log)
                  </label>
                  <textarea 
                    className="flex min-h-[80px] w-full rounded-md border border-zinc-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:placeholder:text-zinc-500 dark:focus-visible:ring-rose-500"
                    placeholder="E.g., AI missed that candidate has equivalent experience in a different framework..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" size="sm" onClick={() => setIsOverriding(false)}>Cancel</Button>
                  <Button size="sm" onClick={handleOverride} disabled={isSubmitting || !reason.trim()}>
                    {isSubmitting ? "Saving..." : "Confirm Override"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
