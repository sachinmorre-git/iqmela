"use client";

import { useState, useTransition, useRef, useEffect, useCallback, Dispatch, SetStateAction, RefObject } from "react";
import { createPortal } from "react-dom";
import { formatDate, formatTime, formatDateTime } from "@/lib/locale-utils";
import {
  X, Loader2, Calendar, Clock, Users, Link2, FileText, ChevronRight,
  Bot, Send, RefreshCw, CheckCircle, Edit3, Zap, CalendarClock,
  DollarSign, Sparkles, Shield,
} from "lucide-react";
import { scheduleRoundAction, completeRoundAction } from "./pipeline-actions";
import { createAiInterviewSessionAction } from "./ai-interview-actions";
import { createAvailabilityPollAction, getPollStatusAction, nudgePanelistAction } from "./poll-actions";
import { toast } from "sonner";
import { CoachMark } from "@/components/ui/CoachMark";
import { CompletedRoundView } from "./CompletedRoundView";
import { BgvDrawerView } from "./BgvDrawerView";
import type { StageState } from "./CandidatePipelineBar";
import type { MatchResult, InterviewerForMatch } from "@/lib/interviewer-match";

// ── Types ────────────────────────────────────────────────────────────────────

type ScheduleMode = "quick" | "poll";

interface Interviewer {
  id: string;
  name: string | null;
  email: string;
}

interface ScheduleDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  stage: StageState | null;
  resumeId: string;
  positionId: string;
  candidateName: string;
  matchScore?: number | null;
  topSkills?: string[];
  previousRounds?: { label: string; status: string; score?: number | null }[];
  interviewers: Interviewer[];
  aiFocusAreas?: string[];
  matchResults?: MatchResult[];   // AI match results for interviewers
  totalStages?: number;           // Total number of pipeline stages
  onAdvanceToStage?: (stageIndex: number) => void; // Called after ADVANCE decision
}

// ── Component ────────────────────────────────────────────────────────────────

export function ScheduleDrawer({
  isOpen,
  onClose,
  stage,
  resumeId,
  positionId,
  candidateName,
  matchScore,
  topSkills = [],
  previousRounds = [],
  interviewers,
  aiFocusAreas = [],
  matchResults = [],
  totalStages = 3,
  onAdvanceToStage,
}: ScheduleDrawerProps) {
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<ScheduleMode>("poll");
  const [selectedInterviewerIds, setSelectedInterviewerIds] = useState<string[]>([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState(stage?.stage.durationMinutes ?? 45);
  const [externalLink, setExternalLink] = useState("");
  const [notes, setNotes] = useState(aiFocusAreas.length > 0 ? `Focus areas: ${aiFocusAreas.join(", ")}` : "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("Done!");
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<"internal" | "marketplace">("internal");
  const [profilePopoverUserId, setProfilePopoverUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Smart Poll fields
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set()); // ISO date strings
  const [deadlineWeekdays, setDeadlineWeekdays] = useState(5); // 3 / 5 / 7 / 10 / 14
  // Derived start/end from selectedDays (kept for backward compat with action)
  const sortedDays = [...selectedDays].sort();
  const dateRangeStart = sortedDays[0] ?? "";
  const dateRangeEnd   = sortedDays[sortedDays.length - 1] ?? "";

  // Poll status from backend
  const [activePoll, setActivePoll] = useState<any>(null);
  const [isLoadingPoll, setIsLoadingPoll] = useState(false);

  useEffect(() => {
    let active = true;
    if (mode === "poll" && isOpen && stage) {
      setIsLoadingPoll(true);
      getPollStatusAction(positionId, resumeId, stage.stage.stageIndex)
        .then((res) => {
          if (active && res.poll) {
            setActivePoll(res.poll);
          }
        })
        .finally(() => {
          if (active) setIsLoadingPoll(false);
        });
    }
    return () => { active = false; };
  }, [mode, isOpen, stage, positionId, resumeId]);


  const toggleInterviewer = (id: string) => {
    setSelectedInterviewerIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 6) return prev;
      return [...prev, id];
    });
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setSuccess(true);
    setTimeout(() => {
      onClose();
      setSuccess(false);
      setIsEditing(false);
      setSelectedInterviewerIds([]);
      setScheduledAt("");
      setExternalLink("");
      setNotes("");
      setSelectedDays(new Set());
      setDeadlineWeekdays(5);
    }, 1200);
  };

  /* ── Action Handlers ──────────────────────────────────────────── */

  const handleQuickSchedule = () => {
    if (!stage) return;
    setError(null);
    startTransition(async () => {
      const res = await scheduleRoundAction({
        positionId,
        resumeId,
        stageIndex: stage.stage.stageIndex,
        interviewerIds: selectedInterviewerIds,
        scheduledAt,
        durationMinutes: duration,
        externalLink: externalLink || undefined,
        notes: notes || undefined,
      });
      if (res.success) showSuccess("Round Scheduled!");
      else setError(res.error ?? "Failed to schedule");
    });
  };

  const handleSmartPoll = () => {
    if (!stage) return;
    setError(null);
    startTransition(async () => {
      const res = await createAvailabilityPollAction({
        positionId,
        resumeId,
        stageIndex: stage.stage.stageIndex,
        roundLabel: stage.stage.roundLabel,
        durationMinutes: duration,
        dateRangeStart,
        dateRangeEnd,
        interviewerIds: selectedInterviewerIds,
        deadlineWeekdays,
      });
      if (res.success) showSuccess("Availability requests sent!");
      else setError(res.error ?? "Failed to create poll");
    });
  };

  const handleSendAiInvite = () => {
    setError(null);
    startTransition(async () => {
      const res = await createAiInterviewSessionAction(resumeId, positionId);
      if (res.success) {
        showSuccess("AI Interview Invite Sent (or Queued)!");
        // Fire background processor
        fetch("/api/ai-interview/process-queue", { method: "POST" }).catch(console.error);
      } else {
        setError(res.error ?? "Failed to send AI interview invite");
      }
    });
  };

  const handleResendAiInvite = () => {
    setError(null);
    startTransition(async () => {
      const res = await createAiInterviewSessionAction(resumeId, positionId);
      if (res.success) {
        showSuccess("AI Invite Resent (or Queued)!");
        // Fire background processor
        fetch("/api/ai-interview/process-queue", { method: "POST" }).catch(console.error);
      } else {
        setError(res.error ?? "Failed to resend");
      }
    });
  };

  const handleMarkComplete = () => {
    if (!stage?.interviewId) return;
    setError(null);
    startTransition(async () => {
      const res = await completeRoundAction(stage.interviewId!);
      if (res.success) showSuccess("Round Marked Complete!");
      else setError(res.error ?? "Failed to complete round");
    });
  };

  if (!isOpen || !stage) return null;

  const isAI = stage.stage.roundType === "AI_SCREEN";
  const isBGV = stage.stage.roundType === "BGV_CHECK";
  const isScheduled = stage.status === "SCHEDULED";
  const isQueued = stage.status === "QUEUED";
  const isCompleted = stage.status === "COMPLETED";
  const isAvailable = stage.status === "AVAILABLE";

  // Split interviewers by source using match results
  const internalMatches = matchResults.filter((m) => m.interviewer.source === "INTERNAL");
  const marketplaceMatches = matchResults.filter((m) => m.interviewer.source === "MARKETPLACE");

  // Find users who are in 'interviewers' but NOT in 'internalMatches'
  const internalMatchIds = new Set(internalMatches.map(m => m.interviewer.userId));
  const unmatchedInternalInterviewers = interviewers.filter(u => !internalMatchIds.has(u.id));

  // Filter based on search query
  const query = searchQuery.toLowerCase();
  
  const filteredInternalMatches = internalMatches.filter(m => 
    (m.interviewer.name || m.interviewer.email || "").toLowerCase().includes(query)
  );
  
  const filteredUnmatchedInternal = unmatchedInternalInterviewers.filter(u => 
    (u.name || u.email || "").toLowerCase().includes(query)
  );

  const filteredMarketplaceMatches = marketplaceMatches.filter(m => 
    (m.interviewer.name || m.interviewer.email || "").toLowerCase().includes(query)
  );

  // Cost estimator
  const selectedCost = selectedInterviewerIds.reduce((total, id) => {
    const match = matchResults.find((m) => m.interviewer.userId === id);
    if (match?.interviewer.hourlyRate) {
      return total + (match.interviewer.hourlyRate * (duration / 60));
    }
    return total;
  }, 0);

  // Top AI recommendations (sorted by score, top 5)
  // Now filtered dynamically based on the active tab
  const activeTabMatches = activeTab === "internal" ? internalMatches : marketplaceMatches;
  const topRecommendations = activeTabMatches.slice(0, 5);

  const formattedDate = stage.scheduledAt
    ? formatDateTime(new Date(stage.scheduledAt))
    : null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 z-50 h-full w-full max-w-5xl bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {isAI ? (
                <Bot className="w-4 h-4 text-pink-500" />
              ) : isBGV ? (
                <Shield className="w-4 h-4 text-blue-500" />
              ) : isCompleted ? (
                <CheckCircle className="w-4 h-4 text-emerald-500" />
              ) : isScheduled ? (
                <Clock className="w-4 h-4 text-amber-500" />
              ) : isQueued ? (
                <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              ) : (
                <Calendar className="w-4 h-4 text-rose-500" />
              )}
              {isAI
                ? isQueued ? "AI Interview — Queued" : isScheduled ? "AI Interview — Sent" : isCompleted ? "AI Interview — Completed" : "AI Interview Invite"
                : isBGV
                  ? "Background Verification"
                  : isCompleted
                    ? `${stage.stage.roundLabel} — Completed`
                    : isScheduled
                      ? `${stage.stage.roundLabel} — Scheduled`
                      : `Schedule ${stage.stage.roundLabel}`}
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              Round {stage.stage.stageIndex + 1} • {stage.stage.roundType.replace(/_/g, " ")}
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Success */}
          {success && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 animate-in fade-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{successMessage}</p>
            </div>
          )}

          {!success && (
            <>
              {/* Candidate Brief */}
              <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-4 border border-gray-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-sm text-gray-900 dark:text-white">{candidateName}</p>
                    {matchScore != null && (
                      <p className="text-xs text-gray-500 dark:text-zinc-400">
                        Match: <span className="font-bold text-rose-600 dark:text-rose-400">{matchScore}%</span>
                      </p>
                    )}
                  </div>
                  {(isScheduled || isCompleted) && (
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                      isCompleted
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
                    }`}>
                      {isCompleted ? "✓ Completed" : "◌ Scheduled"}
                    </span>
                  )}
                </div>
                {topSkills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {topSkills.slice(0, 5).map((s) => (
                      <span key={s} className="px-1.5 py-0.5 text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 rounded border border-rose-100 dark:border-rose-800/40">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                {formattedDate && (isScheduled || isCompleted) && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-zinc-700 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300">{formattedDate}</span>
                  </div>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}

              {/* ═══ AI INTERVIEW STATES ═══ */}
              {isAI && isAvailable && (
                <div className="flex flex-col items-center text-center py-6 gap-4">
                  <div className="w-14 h-14 rounded-full bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                    <Bot className="w-7 h-7 text-pink-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Send AI Interview</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-[280px]">
                      The candidate will receive an email with a link to complete their AI-powered interview at their own convenience.
                    </p>
                  </div>
                </div>
              )}

              {isAI && (isQueued || isScheduled || isCompleted) && (
                <div className="flex flex-col items-center text-center py-4 gap-4">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                    isCompleted ? "bg-emerald-100 dark:bg-emerald-900/30" :
                    isQueued ? "bg-blue-100 dark:bg-blue-900/30" :
                    "bg-pink-100 dark:bg-pink-900/30"
                  }`}>
                    {isCompleted ? <CheckCircle className="w-7 h-7 text-emerald-500" /> :
                     isQueued ? <div className="w-7 h-7 rounded-full border-[3px] border-blue-500 border-t-transparent animate-spin" /> :
                     <Bot className="w-7 h-7 text-pink-500 animate-pulse" />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {isCompleted ? "AI Interview Complete" :
                       isQueued ? "⚙️ Generating AI Parameters..." :
                       "AI Interview Invitation Sent"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 max-w-[280px]">
                      {isCompleted
                        ? "The candidate has completed the AI interview."
                        : isQueued
                        ? "The AI is currently drafting the dynamic question plan. The email will be sent momentarily."
                        : "The invite has been sent. Waiting for the candidate to complete."}
                    </p>
                  </div>
                  
                  {isCompleted && stage?.interviewId && (
                    <div className="w-full text-left mt-2">
                      <CompletedRoundView
                        interviewId={stage.interviewId}
                        resumeId={resumeId}
                        positionId={positionId}
                        candidateName={candidateName}
                        stageIndex={stage.stage.stageIndex}
                        roundLabel={stage.stage.roundLabel}
                        totalStages={totalStages}
                        onAdvanceComplete={(nextStageIndex) => {
                          onAdvanceToStage?.(nextStageIndex);
                        }}
                        onDecisionComplete={onClose}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ═══ BGV_CHECK: Dedicated BGV View ═══ */}
              {isBGV && (
                <BgvDrawerView
                  resumeId={resumeId}
                  positionId={positionId}
                  candidateName={candidateName}
                  stageIndex={stage.stage.stageIndex}
                  interviewId={stage.interviewId}
                  totalStages={totalStages}
                  onAdvanceToStage={onAdvanceToStage}
                  onClose={onClose}
                />
              )}

              {/* ═══ HUMAN: SCHEDULED STATE ═══ */}
              {!isAI && isScheduled && !isEditing && (
                <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-200 dark:border-amber-800/40">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-amber-500" />
                    <p className="text-sm font-bold text-amber-800 dark:text-amber-400">Interview Scheduled</p>
                  </div>
                  {formattedDate && <p className="text-xs text-amber-700 dark:text-amber-500">📅 {formattedDate}</p>}
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">Duration: {stage.stage.durationMinutes} min</p>
                </div>
              )}

              {/* ═══ HUMAN: COMPLETED STATE — Command Center ═══ */}
              {!isAI && isCompleted && stage.interviewId && (
                <CompletedRoundView
                  interviewId={stage.interviewId}
                  resumeId={resumeId}
                  positionId={positionId}
                  candidateName={candidateName}
                  stageIndex={stage.stage.stageIndex}
                  roundLabel={stage.stage.roundLabel}
                  totalStages={totalStages}
                  onAdvanceComplete={(nextStageIndex) => {
                    onAdvanceToStage?.(nextStageIndex);
                  }}
                  onDecisionComplete={onClose}
                />
              )}

              {/* Fallback: COMPLETED without interviewId (legacy) */}
              {!isAI && isCompleted && !stage.interviewId && (
                <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800/40">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Round Completed</p>
                  </div>
                  {formattedDate && <p className="text-xs text-emerald-700 dark:text-emerald-500">📅 {formattedDate}</p>}
                  {stage.score != null && <p className="text-xs text-emerald-600 mt-1">Score: {stage.score}/10</p>}
                </div>
              )}

              {/* ═══ HUMAN: SCHEDULE FORM (AVAILABLE or EDITING) ═══ */}
              {!isAI && (isAvailable || isEditing) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-2">
                  
                  {/* LEFT COLUMN: Interviewer Selection */}
                  <div className="space-y-5">
                    {/* AI Recommended carousel */}
                  {topRecommendations.length > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-2 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400" /> AI Recommended
                      </p>
                      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                        {topRecommendations.map((m) => {
                          const isSelected = selectedInterviewerIds.includes(m.interviewer.userId);
                          const initials = (m.interviewer.name || m.interviewer.email).slice(0, 2).toUpperCase();
                          return (
                            <button
                              key={m.interviewer.userId}
                              type="button"
                              onClick={() => toggleInterviewer(m.interviewer.userId)}
                              className={`flex flex-col items-center gap-1 p-1.5 rounded-[10px] border min-w-[60px] transition-all shrink-0 ${
                                isSelected
                                  ? "border-rose-400 bg-rose-50 dark:bg-rose-900/30 dark:border-rose-700 shadow-sm"
                                  : "border-gray-200 dark:border-zinc-700 hover:border-rose-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
                              }`}
                            >
                              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                                isSelected
                                  ? "bg-rose-500 text-white shadow-md shadow-rose-500/20"
                                  : "bg-gray-100 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 shadow-inner " + (
                                      m.matchScore >= 85 ? "text-emerald-600 dark:text-emerald-400"
                                    : m.matchScore >= 70 ? "text-amber-600 dark:text-amber-400"
                                    : "text-gray-500 dark:text-gray-400"
                                  )
                              }`}>
                                {isSelected ? "✓" : `${m.matchScore}%`}
                              </div>
                              <span className="text-xs font-semibold text-gray-700 dark:text-zinc-300 truncate max-w-[56px] mt-0.5">
                                {(m.interviewer.name || m.interviewer.email).split(" ")[0]}
                              </span>
                              <span className={`px-1 py-0.5 text-[7px] font-bold uppercase rounded ${
                                m.interviewer.source === "INTERNAL"
                                  ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
                                  : "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400"
                              }`}>
                                {m.interviewer.source === "INTERNAL" ? "INT" : "MKT"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tabs: Your Team / Marketplace */}
                  <div>
                    <div className="flex gap-0 mb-2 border-b border-gray-100 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => setActiveTab("internal")}
                        className={`flex-1 py-2 text-xs font-bold text-center transition-all border-b-2 ${
                          activeTab === "internal"
                            ? "border-rose-500 text-rose-700 dark:text-rose-400"
                            : "border-transparent text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        <Users className="w-3 h-3 inline mr-1" />
                        Your Team ({internalMatches.length || interviewers.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("marketplace")}
                        className={`flex-1 py-2 text-xs font-bold text-center transition-all border-b-2 ${
                          activeTab === "marketplace"
                            ? "border-pink-500 text-pink-700 dark:text-pink-400"
                            : "border-transparent text-gray-400 hover:text-gray-600"
                        }`}
                      >
                        <Sparkles className="w-3 h-3 inline mr-1" />
                        Marketplace ({marketplaceMatches.length})
                      </button>
                    </div>

                    {/* Search Bar */}
                    <div className="mb-3 px-1 mt-4">
                      <input
                        type="text"
                        placeholder="Search team members..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800/50 px-3 py-2 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                      />
                    </div>

                    {/* Interviewer list */}
                    <div className="flex-1 min-h-[300px] max-h-[500px] overflow-y-auto border border-gray-200 dark:border-zinc-700 rounded-xl divide-y divide-gray-100 dark:divide-zinc-800">
                      {activeTab === "internal" ? (
                        <>
                          {filteredInternalMatches.filter((m) => !selectedInterviewerIds.includes(m.interviewer.userId)).map((m) => (
                            <InterviewerListItem
                              key={m.interviewer.userId}
                              match={m}
                              onSelect={() => toggleInterviewer(m.interviewer.userId)}
                              onViewProfile={() => setProfilePopoverUserId(profilePopoverUserId === m.interviewer.userId ? null : m.interviewer.userId)}
                              isProfileOpen={profilePopoverUserId === m.interviewer.userId}
                              onCloseProfile={() => setProfilePopoverUserId(null)}
                              isSelected={selectedInterviewerIds.includes(m.interviewer.userId)}
                              disabled={selectedInterviewerIds.length >= 6}
                            />
                          ))}
                          {filteredUnmatchedInternal.filter((u) => !selectedInterviewerIds.includes(u.id)).map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => toggleInterviewer(u.id)}
                              disabled={selectedInterviewerIds.length >= 6}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors disabled:opacity-40"
                            >
                              <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300 flex items-center justify-center text-[10px] font-bold shrink-0">
                                {(u.name || u.email)[0]?.toUpperCase()}
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{u.name || u.email}</p>
                                <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                              </div>
                              <ChevronRight className="w-3 h-3 text-gray-300 ml-auto shrink-0" />
                            </button>
                          ))}
                          {filteredInternalMatches.length === 0 && filteredUnmatchedInternal.length === 0 && (
                            <div className="px-4 py-6 text-center">
                              <p className="text-xs font-bold text-gray-600 dark:text-zinc-400">No team members found</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {filteredMarketplaceMatches.length > 0 ? (
                            filteredMarketplaceMatches.filter((m) => !selectedInterviewerIds.includes(m.interviewer.userId)).map((m) => (
                              <InterviewerListItem
                                key={m.interviewer.userId}
                                match={m}
                                onSelect={() => toggleInterviewer(m.interviewer.userId)}
                                onViewProfile={() => setProfilePopoverUserId(profilePopoverUserId === m.interviewer.userId ? null : m.interviewer.userId)}
                                isProfileOpen={profilePopoverUserId === m.interviewer.userId}
                                onCloseProfile={() => setProfilePopoverUserId(null)}
                                isSelected={selectedInterviewerIds.includes(m.interviewer.userId)}
                                disabled={selectedInterviewerIds.length >= 6}
                              />
                            ))
                          ) : (
                            <div className="px-4 py-6 text-center">
                              <Sparkles className="w-5 h-5 text-pink-400 mx-auto mb-2" />
                              <p className="text-xs font-bold text-gray-600 dark:text-zinc-400">IQMela Marketplace</p>
                              <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1">
                                Coming soon — Expert freelance interviewers matched to your requirements
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  </div> {/* End of LEFT COLUMN */}

                  {/* RIGHT COLUMN: Configuration */}
                  <div className="space-y-6 bg-gray-50 dark:bg-zinc-800/30 p-6 rounded-2xl border border-gray-100 dark:border-zinc-800 flex flex-col">
                    
                    {/* Selected chips */}
                    {selectedInterviewerIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {selectedInterviewerIds.map((id) => {
                          const m = matchResults.find((x) => x.interviewer.userId === id);
                          const u = m?.interviewer || interviewers.find((x) => x.id === id);
                          if (!u) return null;
                          const name = ("name" in u ? u.name : null) || ("email" in u ? u.email : id);
                          return (
                            <div key={id} className="flex items-center gap-1 px-2 py-1 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-lg text-xs font-semibold text-rose-700 dark:text-rose-400">
                              <span className="w-4 h-4 rounded-full bg-rose-500 text-white flex items-center justify-center text-[8px] shrink-0">
                                {(name)[0]?.toUpperCase()}
                              </span>
                              {name.split(" ")[0]}
                              {m && <span className="text-[9px] text-rose-500 ml-0.5">{m.matchScore}%</span>}
                              <button type="button" onClick={() => toggleInterviewer(id)} className="ml-1 text-rose-400 hover:text-red-500">×</button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Cost Estimator */}
                  {selectedCost > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800/40">
                      <DollarSign className="w-4 h-4 text-amber-500 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-amber-800 dark:text-amber-400">Estimated Cost</p>
                        <p className="text-[10px] text-amber-600 dark:text-amber-500">
                          ${selectedCost.toFixed(2)} for {duration} min session
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Mode Toggle */}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setMode("quick")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                        mode === "quick"
                          ? "bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-900/30 dark:border-rose-700 dark:text-rose-400 shadow-sm"
                          : "bg-transparent border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Quick Book
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode("poll")}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all border ${
                        mode === "poll"
                          ? "bg-pink-50 border-pink-300 text-pink-700 dark:bg-pink-900/30 dark:border-pink-700 dark:text-pink-400 shadow-sm"
                          : "bg-transparent border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                      Smart Poll
                    </button>
                  </div>

                  {/* ── Quick Book: Date, Duration, Link, Notes ── */}
                  {mode === "quick" && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-1.5">
                            <Calendar className="w-3.5 h-3.5 text-gray-400" />
                            Date & Time
                          </label>
                          <input
                            type="datetime-local"
                            required
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            className="w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-1.5">
                            <Clock className="w-3.5 h-3.5 text-gray-400" />
                            Duration
                          </label>
                          <select
                            value={duration}
                            onChange={(e) => setDuration(parseInt(e.target.value))}
                            className="w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                          >
                            <option value={15}>15 min</option>
                            <option value={30}>30 min</option>
                            <option value={45}>45 min</option>
                            <option value={60}>60 min</option>
                            <option value={90}>90 min</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-1.5">
                          <Link2 className="w-3.5 h-3.5 text-gray-400" />
                          Meeting Link
                        </label>
                        <input
                          type="url"
                          value={externalLink}
                          onChange={(e) => setExternalLink(e.target.value)}
                          placeholder="https://zoom.us/j/..."
                          className="w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-1.5">
                          <FileText className="w-3.5 h-3.5 text-gray-400" />
                          Notes
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          placeholder="Focus areas, topics to cover..."
                          className="w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition resize-none"
                        />
                      </div>
                    </>
                  )}

                  {/* ── Smart Poll: 4-Week Mini-Calendar + Deadline ── */}
                  {mode === "poll" && (
                    <div className="flex-1">
                      {isLoadingPoll ? (
                        <div className="flex items-center justify-center p-12">
                          <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
                        </div>
                      ) : activePoll ? (
                        <ActivePollSummary poll={activePoll} />
                      ) : (
                        <SmartPollConfigurator
                          duration={duration}
                          setDuration={setDuration}
                          selectedDays={selectedDays}
                          setSelectedDays={setSelectedDays}
                          deadlineWeekdays={deadlineWeekdays}
                          setDeadlineWeekdays={setDeadlineWeekdays}
                        />
                      )}
                    </div>
                  )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer — hidden when CompletedRoundView or BgvDrawerView is active */}
        {!success && !(isCompleted && !isAI && stage?.interviewId) && !isBGV && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-zinc-800 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => { setIsEditing(false); onClose(); }}
              disabled={isPending}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {isQueued || isScheduled || isCompleted ? "Close" : "Cancel"}
            </button>

            {/* AI: Available → Send */}
            {isAI && isAvailable && (
              <button type="button" onClick={handleSendAiInvite} disabled={isPending}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-pink-600 text-white hover:bg-pink-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {isPending ? "Sending…" : "Send AI Invite"}
              </button>
            )}

            {/* AI: Scheduled → Resend */}
            {isAI && isScheduled && (
              <button type="button" onClick={handleResendAiInvite} disabled={isPending}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-pink-600 text-white hover:bg-pink-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
                {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {isPending ? "Resending…" : "Resend AI Invite"}
              </button>
            )}

            {/* Human: Scheduled (not editing) → Reschedule + Complete */}
            {!isAI && isScheduled && !isEditing && (
              <>
                <button type="button" onClick={() => setIsEditing(true)} disabled={isPending}
                  className="px-4 py-2 rounded-xl text-sm font-bold border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all inline-flex items-center gap-2">
                  <Edit3 className="w-3.5 h-3.5" /> Reschedule
                </button>
                <button type="button" onClick={handleMarkComplete} disabled={isPending}
                  className="px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50 inline-flex items-center gap-2">
                  {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                  {isPending ? "Updating…" : "Mark Complete"}
                </button>
              </>
            )}

            {/* Human: Available or Editing → Quick Book or Smart Poll */}
            {!isAI && (isAvailable || isEditing) && mode === "quick" && (
              <button type="button" onClick={handleQuickSchedule}
                disabled={isPending || !scheduledAt || selectedInterviewerIds.length === 0}
                className="px-5 py-2 rounded-xl text-sm font-bold bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
                {isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scheduling…</> : <>🚀 {isEditing ? "Reschedule" : "Schedule & Notify"}</>}
              </button>
            )}

            {!isAI && (isAvailable || isEditing) && mode === "poll" && (
              <div className="relative">
                <button type="button" onClick={handleSmartPoll}
                  disabled={isPending || !dateRangeStart || !dateRangeEnd || selectedInterviewerIds.length === 0}
                  className="px-5 py-2 rounded-xl text-sm font-bold bg-pink-600 text-white hover:bg-pink-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2">
                  {isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending…</> : <>📨 Request Availability</>}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  , document.body);
}

// ── Interviewer List Item with Profile Popover ──────────────────────────────

function InterviewerListItem({
  match,
  onSelect,
  onViewProfile,
  isProfileOpen,
  onCloseProfile,
  isSelected,
  disabled,
}: {
  match: MatchResult;
  onSelect: () => void;
  onViewProfile: () => void;
  isProfileOpen: boolean;
  onCloseProfile: () => void;
  isSelected: boolean;
  disabled: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const { interviewer, matchScore } = match;
  const initials = (interviewer.name || interviewer.email).slice(0, 2).toUpperCase();

  return (
    <div ref={rowRef} className="relative">
      <div className="flex items-center w-full">
        <button
          type="button"
          onClick={onSelect}
          disabled={disabled && !isSelected}
          className="flex-1 flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors disabled:opacity-40"
        >
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
            isSelected
              ? "bg-rose-500 text-white"
              : "bg-gray-200 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300"
          }`}>
            {isSelected ? "✓" : initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{interviewer.name || interviewer.email}</p>
              <span className={`px-1 py-0.5 text-[7px] font-bold uppercase rounded ${
                interviewer.source === "INTERNAL"
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
                  : "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400"
              }`}>
                {interviewer.source === "INTERNAL" ? "INT" : "MKT"}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
              {interviewer.title || interviewer.email}
              {interviewer.hourlyRate != null && <span className="ml-1">· ${interviewer.hourlyRate}/hr</span>}
            </p>
          </div>
          <span className={`text-xs font-bold shrink-0 ${
            matchScore >= 85 ? "text-emerald-600 dark:text-emerald-400" : matchScore >= 70 ? "text-amber-600 dark:text-amber-400" : "text-gray-600 dark:text-gray-400"
          }`}>
            {matchScore}%
          </span>
        </button>
        <button
          type="button"
          onClick={onViewProfile}
          className="px-2 py-2 text-gray-400 hover:text-rose-500 transition-colors shrink-0"
          title="View profile"
        >
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Profile Popover */}
      {isProfileOpen && (
        <InterviewerProfilePopover
          match={match}
          isOpen={isProfileOpen}
          onClose={onCloseProfile}
          onSelect={onSelect}
          isSelected={isSelected}
          anchorRef={rowRef}
        />
      )}
    </div>
  );
}

// ── Interviewer Profile Popover ───────────────────────────────────────────────
// Slide-in panel that expands below the interviewer row when the chevron is clicked

function InterviewerProfilePopover({
  match,
  onClose,
  onSelect,
  isSelected,
}: {
  match: MatchResult;
  isOpen: boolean;
  onClose: () => void;
  onSelect: () => void;
  isSelected: boolean;
  anchorRef: RefObject<HTMLDivElement | null>;
}) {
  const { interviewer, matchScore, matchReasons } = match;
  const skills: string[] = Array.isArray(interviewer.skills) ? interviewer.skills : [];

  // Star rating renderer
  function Stars({ rating }: { rating: number }) {
    return (
      <span className="flex items-center gap-0.5">
        {[1,2,3,4,5].map((s) => (
          <svg key={s} width="9" height="9" viewBox="0 0 12 12" fill={s <= Math.round(rating) ? "#f59e0b" : "none"}
            stroke="#f59e0b" strokeWidth="1.5" className="shrink-0">
            <path d="M6 1l1.236 2.504L10 3.82l-2 1.949.472 2.753L6 7.25l-2.472 1.272L4 5.769 2 3.82l2.764-.316z"/>
          </svg>
        ))}
        <span className="text-[9px] text-amber-500 font-bold ml-0.5">{rating?.toFixed(1)}</span>
      </span>
    );
  }

  const matchColour =
    matchScore >= 85 ? "text-emerald-600 dark:text-emerald-400" :
    matchScore >= 70 ? "text-amber-600 dark:text-amber-400" :
    "text-gray-400 dark:text-zinc-500";

  return (
    <div className="mx-1 mb-1 rounded-xl border border-pink-200 dark:border-pink-800/50 bg-white dark:bg-zinc-900 shadow-xl shadow-pink-100/30 dark:shadow-none overflow-hidden animate-in slide-in-from-top-1 duration-150">
      {/* Header strip */}
      <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 bg-gradient-to-r from-pink-50/60 to-transparent dark:from-pink-900/10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar / initials */}
          {interviewer.avatarUrl ? (
            <img src={interviewer.avatarUrl} alt={interviewer.name ?? ""} className="w-10 h-10 rounded-xl object-cover shrink-0 ring-2 ring-pink-200 dark:ring-pink-700" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white font-extrabold text-sm shrink-0">
              {(interviewer.name || interviewer.email).slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{interviewer.name || interviewer.email}</p>
              {interviewer.isVerified && (
                <span title="IQMela Verified" className="text-rose-500">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="m9 12 2 2 4-4"/>
                  </svg>
                </span>
              )}
              <span className={`px-1.5 py-0.5 text-[7px] font-bold uppercase rounded ${
                interviewer.source === "INTERNAL"
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400"
                  : "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-400"
              }`}>
                {interviewer.source === "INTERNAL" ? "Internal" : "Marketplace"}
              </span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-zinc-400 truncate mt-0.5">
              {interviewer.title || "Interviewer"}
              {interviewer.source === "INTERNAL" && interviewer.department && <span className="text-gray-300 dark:text-zinc-600"> · {interviewer.department}</span>}
              {interviewer.source === "MARKETPLACE" && <span className="text-gray-300 dark:text-zinc-600"> · Contact via IQMela</span>}
            </p>
          </div>
        </div>
        <button type="button" onClick={onClose} className="text-gray-300 hover:text-gray-500 dark:hover:text-zinc-300 transition-colors shrink-0 mt-0.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <div className="px-4 pb-4 space-y-3">
        {/* Stats row */}
        <div className="flex items-center gap-3 flex-wrap">
          {interviewer.avgRating != null && (
            <div className="flex items-center gap-1">
              <Stars rating={interviewer.avgRating} />
            </div>
          )}
          {interviewer.totalInterviews != null && interviewer.totalInterviews > 0 && (
            <span className="text-[10px] text-gray-400 dark:text-zinc-500 flex items-center gap-1">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <strong className="text-gray-600 dark:text-zinc-300">{interviewer.totalInterviews}</strong> interviews
            </span>
          )}
          {interviewer.hourlyRate != null && (
            <span className="text-[10px] font-bold text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 px-2 py-0.5 rounded-full">
              ${interviewer.hourlyRate}/hr
            </span>
          )}
          {/* AI match score */}
          <span className={`text-[10px] font-bold ml-auto ${matchColour}`}>
            {matchScore}% AI match
          </span>
        </div>

        {/* Bio */}
        {interviewer.expertise && (
          <p className="text-[11px] text-gray-600 dark:text-zinc-400 leading-relaxed border-l-2 border-pink-200 dark:border-pink-800 pl-2 italic">
            {interviewer.expertise}
          </p>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 mb-1.5">Skills</p>
            <div className="flex flex-wrap gap-1">
              {skills.map((sk) => (
                <span key={sk} className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300">
                  {sk}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* AI match reasons */}
        {matchReasons && matchReasons.length > 0 && (
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-pink-400 dark:text-pink-500 mb-1.5">Why AI recommended</p>
            <ul className="space-y-0.5">
              {matchReasons.slice(0, 3).map((r, i) => (
                <li key={i} className="flex items-start gap-1 text-[10px] text-gray-500 dark:text-zinc-400">
                  <span className="text-pink-400 mt-0.5 shrink-0">•</span>
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer: LinkedIn + Select button */}
        <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-zinc-800">
          {interviewer.linkedinUrl ? (
            <a href={interviewer.linkedinUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-600 font-semibold transition-colors">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2zM4 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/>
              </svg>
              LinkedIn
            </a>
          ) : <span />}
          <button
            type="button"
            onClick={() => { onSelect(); onClose(); }}
            className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all ${
              isSelected
                ? "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-700"
                : "bg-pink-600 text-white hover:bg-pink-700 shadow-sm"
            }`}
          >
            {isSelected ? "✓ Added to panel" : "+ Add to panel"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SmartPollConfigurator ─────────────────────────────────────────────────────
// 4-week mini-calendar day picker + deadline selector for Smart Poll mode.

const DEADLINE_OPTIONS = [
  { value: 1, label: "1 weekday"  },
  { value: 2, label: "2 weekdays" },
  { value: 3, label: "3 weekdays" },
  { value: 4, label: "4 weekdays" },
  { value: 5, label: "5 weekdays" },
];

function addWeekdaysForDisplay(start: Date, days: number): Date {
  let count = 0;
  const d = new Date(start);
  while (count < days) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return d;
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const dow = d.getDay();
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return d;
}

function dateISO(d: Date): string {
  return d.toISOString().split("T")[0];
}

interface SmartPollConfiguratorProps {
  duration: number;
  setDuration: (v: number) => void;
  selectedDays: Set<string>;
  setSelectedDays: Dispatch<SetStateAction<Set<string>>>;
  deadlineWeekdays: number;
  setDeadlineWeekdays: (v: number) => void;
}

function SmartPollConfigurator({
  duration, setDuration,
  selectedDays, setSelectedDays,
  deadlineWeekdays, setDeadlineWeekdays,
}: SmartPollConfiguratorProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Drag-to-paint state
  const isDragging = useRef(false);
  // "add" = painting selection, "remove" = painting deselection
  const dragMode = useRef<"add" | "remove">("add");

  // Build 4 weeks starting from this Monday
  const monday = getMonday(today);
  const weeks: Date[][] = [];
  for (let w = 0; w < 4; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 5; d++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + w * 7 + d);
      week.push(day);
    }
    weeks.push(week);
  }

  const allWeekdays = weeks.flat().map(dateISO);

  // Mouse handlers for drag-to-paint
  function handleDayMouseDown(iso: string, isPast: boolean) {
    if (isPast) return;
    isDragging.current = true;
    // Decide paint mode based on first cell touched
    dragMode.current = selectedDays.has(iso) ? "remove" : "add";
    setSelectedDays(prev => {
      const next = new Set(prev);
      dragMode.current === "add" ? next.add(iso) : next.delete(iso);
      return next;
    });
  }

  function handleDayMouseEnter(iso: string, isPast: boolean) {
    if (!isDragging.current || isPast) return;
    setSelectedDays(prev => {
      const next = new Set(prev);
      dragMode.current === "add" ? next.add(iso) : next.delete(iso);
      return next;
    });
  }

  // Stop drag on mouse-up anywhere
  useEffect(() => {
    const stop = () => { isDragging.current = false; };
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  function selectAll() { setSelectedDays(new Set(allWeekdays)); }
  function clearAll()  { setSelectedDays(new Set()); }

  // Deadline preview
  const deadlineDate  = addWeekdaysForDisplay(today, deadlineWeekdays);
  const deadlineLabel = formatDate(deadlineDate);

  const selectedCount  = selectedDays.size;
  const sortedSelected = [...selectedDays].sort();

  return (
    <div className="space-y-4">
      {/* How it works */}
      <div className="bg-pink-50 dark:bg-pink-900/10 rounded-xl p-3 border border-pink-200 dark:border-pink-800/40">
        <p className="text-sm text-pink-600 dark:text-pink-400 font-extrabold uppercase tracking-wider mb-2">
          How Smart Poll works
        </p>
        <ol className="text-sm font-bold text-pink-500 dark:text-pink-400/80 space-y-1 list-decimal list-inside leading-relaxed">
          <li>Select the days you want to open for availability</li>
          <li>Panel members mark 9AM–5PM slots they&apos;re free</li>
          <li>AI finds common windows · Candidate picks a time</li>
        </ol>
      </div>

      {/* Day picker */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-pink-500" />
            Select Interview Days
            {selectedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-400 text-[9px] font-bold">
                {selectedCount}
              </span>
            )}
          </label>
          <div className="flex items-center gap-2">
            <button type="button" onClick={selectAll}
              className="text-xs font-semibold text-pink-600 dark:text-pink-400 hover:underline">
              All weekdays
            </button>
            <span className="text-gray-300 dark:text-zinc-600">·</span>
            <button type="button" onClick={clearAll}
              className="text-xs font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300 hover:underline">
              Clear
            </button>
          </div>
        </div>

        {/* Drag-to-select hint */}
        <p className="text-[11px] text-gray-400 dark:text-zinc-600 mb-2 flex items-center gap-1">
          <span>💡</span>
          Click a day or <strong>click &amp; drag</strong> to select a range
        </p>

        {/* 4-week grid — drag + select */}
        {/* Prevent default drag behaviour so browser doesn't interfere */}
        <div
          className="space-y-1.5 select-none"
          onDragStart={(e) => e.preventDefault()}
        >
          {/* Day header */}
          <div className="grid grid-cols-5 gap-1">
            {["Mon","Tue","Wed","Thu","Fri"].map(d => (
              <div key={d} className="text-center text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase">
                {d}
              </div>
            ))}
          </div>

          {/* Weeks */}
          {weeks.map((week, wi) => {
            const weekLabel = formatDate(week[0]);
            return (
              <div key={wi} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 dark:text-zinc-500 w-12 shrink-0 text-right leading-tight">
                  {weekLabel}
                </span>
                <div className="grid grid-cols-5 gap-1 flex-1">
                  {week.map((day) => {
                    const iso      = dateISO(day);
                    const isPast   = day < today;
                    const isSel    = selectedDays.has(iso);
                    const isToday  = iso === dateISO(today);

                    return (
                      <button
                        key={iso}
                        type="button"
                        disabled={isPast}
                        // Click (without drag) also works
                        onMouseDown={() => handleDayMouseDown(iso, isPast)}
                        onMouseEnter={() => handleDayMouseEnter(iso, isPast)}
                        // Prevent losing drag state when pointer briefly leaves grid
                        onMouseUp={() => { isDragging.current = false; }}
                        className={`
                          relative h-10 rounded-xl text-sm font-bold transition-all duration-100
                          ${isPast
                            ? "opacity-20 cursor-not-allowed bg-gray-100 dark:bg-zinc-800 text-gray-400"
                            : isSel
                            ? "bg-pink-600 text-white shadow-sm shadow-pink-300/40 dark:shadow-none ring-2 ring-pink-600 ring-offset-1 ring-offset-white dark:ring-offset-zinc-900 scale-[0.97]"
                            : "cursor-pointer bg-gray-50 dark:bg-zinc-800/70 text-gray-700 dark:text-zinc-300 hover:bg-pink-50 dark:hover:bg-pink-900/20 hover:text-pink-700 dark:hover:text-pink-400 border border-gray-100 dark:border-zinc-700/50 hover:border-pink-300 dark:hover:border-pink-700"
                          }
                        `}
                      >
                        {day.getDate()}
                        {isToday && !isSel && (
                          <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-pink-400" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary chips */}
        {selectedCount > 0 && (
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-gray-400 dark:text-zinc-500 shrink-0">Selected:</span>
            {sortedSelected.slice(0, 5).map(iso => (
              <span key={iso} className="text-[9px] font-semibold text-pink-700 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 px-1.5 py-0.5 rounded-md">
                {formatDate(new Date(iso + "T00:00:00"))}
              </span>
            ))}
            {sortedSelected.length > 5 && (
              <span className="text-[9px] text-gray-400 dark:text-zinc-500">+{sortedSelected.length - 5} more</span>
            )}
          </div>
        )}
      </div>

      {/* Duration + Deadline row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5 mb-1.5">
            <Clock className="w-3.5 h-3.5 text-pink-500" />
            Duration
          </label>
          <select
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
            className="w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
          >
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
            <option value={60}>60 min</option>
            <option value={90}>90 min</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5 mb-1.5">
            <Clock className="w-3.5 h-3.5 text-pink-500" />
            Deadline
          </label>
          <select
            value={deadlineWeekdays}
            onChange={(e) => setDeadlineWeekdays(parseInt(e.target.value))}
            className="w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
          >
            {DEADLINE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Deadline preview */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-700">
        <span className="text-lg">⏳</span>
        <p className="text-sm font-semibold text-gray-700 dark:text-zinc-300">
          Panelists must respond by{" "}
          <strong className="font-extrabold text-gray-900 dark:text-white">{deadlineLabel}</strong>
          {" "}· Hourly reminders sent 9AM–5PM on weekdays.
        </p>
      </div>
    </div>
  );
}

// ── Active Poll Summary (Elegant UI Mockup) ─────────────────────────────────

function ActivePollSummary({ poll }: { poll: any }) {
  const [isNudging, setIsNudging] = useState<string | null>(null);
  const [viewingSlotsFor, setViewingSlotsFor] = useState<{name: string, slots: any[]} | null>(null);

  if (!poll) return null;

  const handleNudge = async (userId: string) => {
    setIsNudging(userId);
    try {
      const res = await nudgePanelistAction(poll.id, userId);
      if (res.success) {
        toast.success("Nudge sent to panelist!");
      } else {
        toast.error(res.error || "Failed to send nudge");
      }
    } catch (e) {
      toast.error("An error occurred");
    } finally {
      setIsNudging(null);
    }
  };

  const handleViewSlots = (name: string, slots: any[]) => {
    if (!slots || slots.length === 0) {
      toast.info("No slots provided yet");
      return;
    }
    setViewingSlotsFor({ name, slots });
  };

  const responses = poll.responses || [];
  const total = poll.totalPanelists || responses.length;
  const submitted = poll.submittedCount;
  const progressPct = total > 0 ? (submitted / total) * 100 : 0;
  
  const colors = ["bg-rose-500", "bg-blue-500", "bg-amber-500", "bg-emerald-500", "bg-purple-500"];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 relative">
      {/* Status Header */}
      <div className="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-900/10 dark:to-rose-900/10 rounded-2xl p-5 border border-pink-100 dark:border-pink-800/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <CalendarClock className="w-24 h-24 text-pink-500" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                {submitted < total && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                )}
                <span className="relative inline-flex rounded-full h-3 w-3 bg-pink-500"></span>
              </span>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                {poll.status === "READY" || poll.status === "CONFIRMED" ? "Poll Completed" : "Collecting Availability"}
              </h3>
            </div>
            <span className="text-xs font-bold text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-900/40 px-2 py-1 rounded-md">
              {submitted} / {total} Responded
            </span>
          </div>
          
          <div className="h-2 w-full bg-white dark:bg-zinc-800 rounded-full overflow-hidden border border-pink-100 dark:border-zinc-700/50">
            <div className="h-full bg-gradient-to-r from-pink-400 to-rose-500 rounded-full transition-all duration-1000" style={{ width: `${progressPct}%` }}></div>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 mt-3 font-medium">
            Deadline: <span className="text-gray-700 dark:text-zinc-300">{formatDate(new Date(poll.deadline))}</span>
          </p>
        </div>
      </div>

      {/* Panelist Breakdown */}
      <div>
        <p className="text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-3 px-1">Panelist Status</p>
        <div className="space-y-2">
          {responses.map((p: any, i: number) => {
            const hasResponded = !!p.submittedAt;
            const avatarColor = colors[i % colors.length];
            
            return (
              <div key={p.userId} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                hasResponded 
                  ? 'bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800' 
                  : 'bg-gray-50 dark:bg-zinc-800/40 border-dashed border-gray-200 dark:border-zinc-700'
              }`}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${avatarColor}`}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    {hasResponded && (
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900 flex items-center justify-center">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">{p.name}</p>
                    <p className="text-[10px] text-gray-500 dark:text-zinc-400 font-medium">
                      {hasResponded 
                        ? `Provided ${p.slots?.length || 0} slots` 
                        : p.lastNudgedAt ? `Last nudged ${formatDate(new Date(p.lastNudgedAt))}` : 'Waiting for response'}
                    </p>
                  </div>
                </div>
                
                {hasResponded ? (
                  <button 
                    type="button" 
                    onClick={() => handleViewSlots(p.name, p.slots)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 transition-colors rounded-lg border border-emerald-100 dark:border-emerald-800/30"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold uppercase tracking-wide">View Slots</span>
                  </button>
                ) : (
                  <button 
                    type="button" 
                    onClick={() => handleNudge(p.userId)}
                    disabled={isNudging === p.userId}
                    className="flex items-center gap-1 text-[10px] font-bold text-pink-600 dark:text-pink-400 hover:text-pink-700 bg-pink-50 dark:bg-pink-900/20 hover:bg-pink-100 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isNudging === p.userId ? (
                      <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25"/><path fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" className="opacity-75"/></svg>
                    ) : (
                      <Send className="w-3 h-3" />
                    )}
                    {isNudging === p.userId ? 'Nudging...' : 'Nudge'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* AI Overlaps Preview */}
      {poll.commonSlots?.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/10 dark:to-teal-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/30 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-400">{poll.commonSlots.length} Overlap{poll.commonSlots.length > 1 ? 's' : ''} Found So Far</p>
            <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1 leading-relaxed">
              The AI has successfully found common windows for the panel.
            </p>
          </div>
        </div>
      )}

      {viewingSlotsFor && (
        <div className="absolute inset-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md rounded-2xl border border-gray-200 dark:border-zinc-800 flex flex-col p-5 shadow-2xl animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-zinc-800 pb-3 shrink-0">
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white text-base">Availability Slots</h4>
              <p className="text-xs text-gray-500 dark:text-zinc-400">Provided by <span className="font-semibold text-gray-700 dark:text-zinc-300">{viewingSlotsFor.name}</span></p>
            </div>
            <button 
              onClick={() => setViewingSlotsFor(null)}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center text-gray-500 transition-colors shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-1 space-y-2 pb-4 scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-zinc-700">
            {viewingSlotsFor.slots.map((s, idx) => {
              if (!s.date || !s.startTime || !s.endTime) return null;
              const d = new Date(s.date);
              const localDate = new Date(d.getTime() + d.getTimezoneOffset() * 60000);
              return (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 flex flex-col items-center justify-center shadow-sm shrink-0">
                      <span className="text-[9px] uppercase font-bold text-emerald-600 dark:text-emerald-400 leading-none">{localDate.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                      <span className="text-sm font-black text-gray-900 dark:text-white leading-none mt-0.5">{localDate.getDate()}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-700 dark:text-zinc-300">
                      {localDate.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 shadow-sm shrink-0">
                    <CalendarClock className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs font-bold font-mono text-gray-900 dark:text-white tracking-tight mt-0.5">
                      {s.startTime} <span className="text-gray-400 font-sans px-0.5">-</span> {s.endTime}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
