"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Users, Filter, TrendingUp, ArrowUpRight, Star,
  AlertTriangle, Archive, ChevronDown, ChevronUp,
  Loader2, CheckCircle2, XCircle, BarChart3, Settings2,
} from "lucide-react";
import { maskEmail } from "@/lib/pii-redact";
import {
  getIntakeStatsAction,
  getIntakeCandidatesAction,
  promoteIntakeCandidateAction,
  archiveIntakeCandidateAction,
  bulkPromoteTopNAction,
  updateIntakeConfigAction,
} from "@/app/org-admin/distribution-actions";

interface IntakeQueuePanelProps {
  positionId: string;
  intakeTopN: number;
  intakeAutoPromote: boolean;
  tier1PassThreshold?: number;
  showPII?: boolean;
}

interface IntakeStats {
  total: number;
  tier1Pass: number;
  tier1Fail: number;
  tier2Scored: number;
  shortlisted: number;
  promoted: number;
  archived: number;
  needsReview: number;
}

interface IntakeCandidate {
  id: string;
  candidateName: string | null;
  candidateEmail: string;
  phone: string | null;
  location: string | null;
  source: string;
  tier1Score: number | null;
  tier1Reasons: unknown;
  tier2Score: number | null;
  tier2Label: string | null;
  tier2Rationale: string | null;
  tier2MatchedSkills: unknown;
  tier2MissingSkills: unknown;
  finalStatus: string;
  promotedToResumeId: string | null;
  createdAt: string;
}

export default function IntakeQueuePanel({
  positionId,
  intakeTopN: initialTopN,
  intakeAutoPromote: initialAutoPromote,
  tier1PassThreshold: initialThreshold = 35,
  showPII = true,
}: IntakeQueuePanelProps) {
  const [stats, setStats] = useState<IntakeStats | null>(null);
  const [candidates, setCandidates] = useState<IntakeCandidate[]>([]);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [topN, setTopN] = useState(initialTopN);
  const [autoPromote, setAutoPromote] = useState(initialAutoPromote);
  const [threshold, setThreshold] = useState(initialThreshold);
  const [showSettings, setShowSettings] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Load stats + candidates
  useEffect(() => {
    loadData();
  }, [positionId, page, statusFilter]);

  const loadData = () => {
    startTransition(async () => {
      try {
        const [statsData, candidatesData] = await Promise.all([
          getIntakeStatsAction(positionId),
          getIntakeCandidatesAction(positionId, {
            status: statusFilter || undefined,
            page,
            limit: 20,
            sortBy: "tier2Score",
            sortOrder: "desc",
          }),
        ]);
        setStats(statsData);
        setCandidates(candidatesData.candidates as unknown as IntakeCandidate[]);
        setTotalCandidates(candidatesData.total);
      } catch (err) {
        console.error("Failed to load intake data:", err);
      }
    });
  };

  const handlePromote = (id: string) => {
    startTransition(async () => {
      await promoteIntakeCandidateAction(id);
      loadData();
    });
  };

  const handleArchive = (id: string) => {
    startTransition(async () => {
      await archiveIntakeCandidateAction(id);
      loadData();
    });
  };

  const handleBulkPromote = () => {
    startTransition(async () => {
      await bulkPromoteTopNAction(positionId, topN);
      loadData();
    });
  };

  const handleSaveConfig = () => {
    startTransition(async () => {
      await updateIntakeConfigAction(positionId, {
        intakeTopN: topN,
        intakeAutoPromote: autoPromote,
        tier1PassThreshold: threshold,
      });
      setShowSettings(false);
    });
  };

  return (
    <div className="bg-gradient-to-br from-[rgba(15,15,25,0.95)] to-[rgba(20,20,35,0.95)] border border-indigo-500/15 rounded-2xl p-4 sm:p-6 mb-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
            <Filter size={20} color="#fff" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white m-0">
              AI Intake Queue
            </h3>
            <p className="text-xs text-gray-500 mt-0.5 m-0">
              2-tier AI screening • Top {topN} shortlisted
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-gray-500 text-xs cursor-pointer hover:bg-white/[0.06] transition-colors"
          >
            <Settings2 size={13} />
            Config
          </button>

          {stats && stats.shortlisted > 0 && (
            <button
              onClick={handleBulkPromote}
              disabled={isPending}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border-none bg-gradient-to-br from-indigo-500 to-violet-500 text-white text-xs font-semibold cursor-pointer disabled:cursor-wait hover:from-indigo-400 hover:to-violet-400 transition-all"
            >
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpRight size={13} />}
              Promote Top {topN} to Pipeline
            </button>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-5 flex-wrap">
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Top N to shortlist
            </label>
            <input
              type="number"
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              className="w-20 px-2.5 py-1.5 rounded-md border border-white/10 bg-black/30 text-white text-[13px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Tier 1 Pass Threshold
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={100}
                value={threshold}
                onChange={(e) => setThreshold(Math.max(0, Math.min(100, Number(e.target.value))))}
                className="w-16 px-2.5 py-1.5 rounded-md border border-white/10 bg-black/30 text-white text-[13px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-gray-600">/100</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              Auto-promote to pipeline
            </label>
            <button
              onClick={() => setAutoPromote(!autoPromote)}
              className={`px-4 py-1.5 rounded-md border border-white/10 text-xs font-semibold cursor-pointer transition-colors ${
                autoPromote
                  ? "bg-green-500/15 text-green-500"
                  : "bg-white/[0.03] text-gray-500"
              }`}
            >
              {autoPromote ? "ON" : "OFF"}
            </button>
          </div>
          <button
            onClick={handleSaveConfig}
            disabled={isPending}
            className="px-4 py-1.5 rounded-md border-none bg-indigo-500 text-white text-xs font-semibold cursor-pointer sm:ml-auto hover:bg-indigo-400 transition-colors"
          >
            Save
          </button>
        </div>
      )}

      {/* Funnel Stats Bar */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
          <FunnelSegment
            label="Received"
            count={stats.total}
            color="#6366f1"
            total={stats.total}
            icon={<Users size={12} />}
          />
          <FunnelSegment
            label="Screened"
            count={stats.tier1Pass + stats.tier2Scored + stats.shortlisted + stats.promoted}
            color="#8b5cf6"
            total={stats.total}
            icon={<TrendingUp size={12} />}
          />
          <FunnelSegment
            label="Shortlisted"
            count={stats.shortlisted + stats.promoted}
            color="#22c55e"
            total={stats.total}
            icon={<Star size={12} />}
          />
          <FunnelSegment
            label="In Pipeline"
            count={stats.promoted}
            color="#06b6d4"
            total={stats.total}
            icon={<CheckCircle2 size={12} />}
          />
        </div>
      )}

      {/* Empty State */}
      {stats && stats.total === 0 && (
        <div className="text-center py-10 px-5 text-gray-600">
          <BarChart3 size={40} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm mb-1">No applications yet</p>
          <p className="text-xs">
            Applications from Indeed and Google Jobs will appear here once candidates apply
          </p>
        </div>
      )}

      {/* Status Filter Tabs */}
      {stats && stats.total > 0 && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          {[
            { value: "", label: "All", count: stats.total },
            { value: "SHORTLISTED", label: "Shortlisted", count: stats.shortlisted },
            { value: "TIER2_SCORED", label: "Scored", count: stats.tier2Scored },
            { value: "NEEDS_REVIEW", label: "⚠ Review", count: stats.needsReview },
            { value: "PROMOTED", label: "In Pipeline", count: stats.promoted },
            { value: "ARCHIVED", label: "Archived", count: stats.archived },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value); setPage(1); }}
              className={`px-3.5 py-1 rounded-lg border text-xs cursor-pointer transition-colors ${
                statusFilter === tab.value
                  ? "border-indigo-500/40 bg-indigo-500/[0.12] text-indigo-400 font-semibold"
                  : tab.value === "NEEDS_REVIEW" && tab.count > 0
                    ? "border-amber-500/30 bg-amber-500/[0.08] text-amber-400 font-normal hover:bg-amber-500/[0.12]"
                    : "border-white/[0.06] bg-transparent text-gray-500 font-normal hover:bg-white/[0.04]"
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      )}

      {/* Candidate Table */}
      {candidates.length > 0 && (
        <div className="rounded-xl overflow-hidden border border-white/[0.06]">
          {candidates.map((c, idx) => (
            <div key={c.id}>
              {/* Row */}
              <div
                onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                className={`grid grid-cols-1 sm:grid-cols-[1fr_80px_80px] md:grid-cols-[1fr_100px_100px_120px_100px] items-center px-3 sm:px-4 py-3 cursor-pointer transition-colors border-b border-white/[0.04] hover:bg-white/[0.04] ${
                  idx % 2 === 0 ? "bg-white/[0.02]" : "bg-transparent"
                }`}
              >
                {/* Name + Email */}
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-white truncate">
                    {c.candidateName || "Unknown"}
                  </div>
                  <div className="text-[11px] text-gray-600 truncate">{showPII ? c.candidateEmail : maskEmail(c.candidateEmail)}</div>
                </div>

                {/* Source — hidden on mobile */}
                <div className="hidden sm:block text-[11px] text-gray-500 truncate">
                  {c.source}
                </div>

                {/* AI Score — hidden on mobile */}
                <div className="hidden sm:block">
                  {c.tier2Score !== null ? (
                    <ScoreBadge score={c.tier2Score} label={c.tier2Label} />
                  ) : c.tier1Score !== null ? (
                    <span className="text-[11px] text-gray-500">T1: {c.tier1Score}</span>
                  ) : (
                    <span className="text-[11px] text-gray-600">Pending</span>
                  )}
                </div>

                {/* Status — hidden on small mobile */}
                <div className="hidden md:block">
                  <CandidateStatusBadge status={c.finalStatus} />
                </div>

                {/* Actions — hidden on small mobile */}
                <div className="hidden md:flex gap-1.5 justify-end"
                  onClick={(e) => e.stopPropagation()}
                >
                  {c.finalStatus === "SHORTLISTED" && (
                    <button
                      onClick={() => handlePromote(c.id)}
                      disabled={isPending}
                      className="px-2.5 py-1 rounded-md border-none bg-green-500/[0.12] text-green-500 text-[11px] font-semibold cursor-pointer hover:bg-green-500/20 transition-colors"
                    >
                      Promote
                    </button>
                  )}
                  {!["PROMOTED", "ARCHIVED", "PURGED"].includes(c.finalStatus) && (
                    <button
                      onClick={() => handleArchive(c.id)}
                      disabled={isPending}
                      className="px-2 py-1 rounded-md border-none bg-white/[0.04] text-gray-600 text-[11px] cursor-pointer hover:bg-white/[0.08] transition-colors"
                    >
                      <Archive size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* Mobile-visible status + actions row */}
              <div className="flex items-center justify-between px-4 py-2 md:hidden border-b border-white/[0.04] bg-white/[0.01]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2">
                  <CandidateStatusBadge status={c.finalStatus} />
                  {c.tier2Score !== null && <ScoreBadge score={c.tier2Score} label={c.tier2Label} />}
                </div>
                <div className="flex gap-1.5">
                  {c.finalStatus === "SHORTLISTED" && (
                    <button onClick={() => handlePromote(c.id)} disabled={isPending}
                      className="px-2.5 py-1 rounded-md bg-green-500/[0.12] text-green-500 text-[11px] font-semibold border-none cursor-pointer">
                      Promote
                    </button>
                  )}
                  {!["PROMOTED", "ARCHIVED", "PURGED"].includes(c.finalStatus) && (
                    <button onClick={() => handleArchive(c.id)} disabled={isPending}
                      className="px-2 py-1 rounded-md bg-white/[0.04] text-gray-600 text-[11px] border-none cursor-pointer">
                      <Archive size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Detail */}
              {expandedId === c.id && (
                <div className="px-4 sm:px-6 py-4 bg-indigo-500/[0.03] border-b border-white/[0.06]">
                  {c.tier2Rationale && (
                    <div className="mb-3">
                      <div className="text-[11px] text-gray-500 font-semibold mb-1">
                        AI Assessment
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed m-0">
                        {c.tier2Rationale}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
                    {Array.isArray(c.tier2MatchedSkills) && c.tier2MatchedSkills.length > 0 && (
                      <div>
                        <div className="text-[11px] text-green-500 font-semibold mb-1.5">
                          ✅ Matched Skills
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(c.tier2MatchedSkills as string[]).map((s) => (
                            <span key={s} className="px-2 py-0.5 rounded bg-green-500/10 text-green-500 text-[11px]">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {Array.isArray(c.tier2MissingSkills) && c.tier2MissingSkills.length > 0 && (
                      <div>
                        <div className="text-[11px] text-red-500 font-semibold mb-1.5">
                          ❌ Missing Skills
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {(c.tier2MissingSkills as string[]).map((s) => (
                            <span key={s} className="px-2 py-0.5 rounded bg-red-500/10 text-red-500 text-[11px]">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {c.location && (
                    <div className="text-[11px] text-gray-600 mt-2">
                      📍 {c.location} {showPII && c.phone ? `• 📞 ${c.phone}` : ""}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalCandidates > 20 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            className={`px-3 py-1 rounded-md border border-white/[0.08] bg-transparent text-xs cursor-pointer transition-colors ${
              page <= 1 ? "text-gray-700 cursor-default" : "text-gray-500 hover:bg-white/[0.04]"
            }`}
          >
            Previous
          </button>
          <span className="text-xs text-gray-600 leading-8">
            Page {page} of {Math.ceil(totalCandidates / 20)}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page * 20 >= totalCandidates}
            className={`px-3 py-1 rounded-md border border-white/[0.08] bg-transparent text-xs cursor-pointer transition-colors ${
              page * 20 >= totalCandidates ? "text-gray-700 cursor-default" : "text-gray-500 hover:bg-white/[0.04]"
            }`}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FunnelSegment({
  label, count, color, total, icon,
}: {
  label: string; count: number; color: string; total: number; icon: React.ReactNode;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div
      className="flex-1 rounded-[10px] px-3 py-2.5 text-center border"
      style={{ background: `${color}10`, borderColor: `${color}25` }}
    >
      <div className="flex items-center justify-center gap-1 mb-1" style={{ color }}>
        {icon}
        <span className="text-lg font-bold">{count.toLocaleString()}</span>
      </div>
      <div className="text-[11px] text-gray-500">{label}</div>
      {total > 0 && (
        <div className="text-[10px] text-gray-600 mt-0.5">{pct}%</div>
      )}
    </div>
  );
}

function ScoreBadge({ score, label }: { score: number; label: string | null }) {
  const cls = score >= 80
    ? "bg-green-500/[0.12] text-green-500"
    : score >= 60
    ? "bg-cyan-500/[0.12] text-cyan-500"
    : score >= 40
    ? "bg-yellow-500/[0.12] text-yellow-500"
    : "bg-red-500/[0.12] text-red-500";

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${cls}`}>
      {score}
    </span>
  );
}

function CandidateStatusBadge({ status }: { status: string }) {
  const config: Record<string, { cls: string; label: string }> = {
    RECEIVED: { cls: "bg-white/5 text-gray-600", label: "Received" },
    TIER1_PASS: { cls: "bg-indigo-500/10 text-indigo-400", label: "Screened" },
    TIER1_FAIL: { cls: "bg-red-500/10 text-red-500", label: "Filtered" },
    TIER2_SCORING: { cls: "bg-yellow-500/10 text-yellow-500", label: "Scoring..." },
    TIER2_SCORED: { cls: "bg-cyan-500/10 text-cyan-500", label: "Scored" },
    NEEDS_REVIEW: { cls: "bg-amber-500/10 text-amber-500", label: "⚠ Review" },
    SHORTLISTED: { cls: "bg-green-500/10 text-green-500", label: "Shortlisted" },
    PROMOTED: { cls: "bg-green-500/15 text-green-500", label: "In Pipeline" },
    ARCHIVED: { cls: "bg-white/[0.04] text-gray-600", label: "Archived" },
    PURGED: { cls: "bg-red-500/[0.08] text-red-500", label: "Purged" },
  };

  const c = config[status] || config.RECEIVED;

  return (
    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-medium ${c.cls}`}>
      {c.label}
    </span>
  );
}
