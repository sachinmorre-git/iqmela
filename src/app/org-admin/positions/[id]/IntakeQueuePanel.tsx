"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Users, Filter, TrendingUp, ArrowUpRight, Star,
  AlertTriangle, Archive, ChevronDown, ChevronUp,
  Loader2, CheckCircle2, XCircle, BarChart3, Settings2,
} from "lucide-react";
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
}

interface IntakeStats {
  total: number;
  tier1Pass: number;
  tier1Fail: number;
  tier2Scored: number;
  shortlisted: number;
  promoted: number;
  archived: number;
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
}: IntakeQueuePanelProps) {
  const [stats, setStats] = useState<IntakeStats | null>(null);
  const [candidates, setCandidates] = useState<IntakeCandidate[]>([]);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [topN, setTopN] = useState(initialTopN);
  const [autoPromote, setAutoPromote] = useState(initialAutoPromote);
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
      await updateIntakeConfigAction(positionId, { intakeTopN: topN, intakeAutoPromote: autoPromote });
      setShowSettings(false);
    });
  };

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(15,15,25,0.95), rgba(20,20,35,0.95))",
      border: "1px solid rgba(99,102,241,0.15)",
      borderRadius: "16px",
      padding: "24px",
      marginBottom: "20px",
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "40px",
            height: "40px",
            borderRadius: "10px",
            background: "linear-gradient(135deg, #8b5cf6, #d946ef)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Filter size={20} color="#fff" />
          </div>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#fff", margin: 0 }}>
              AI Intake Queue
            </h3>
            <p style={{ fontSize: "12px", color: "#888", margin: "2px 0 0 0" }}>
              2-tier AI screening • Top {topN} shortlisted
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 14px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              color: "#888",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            <Settings2 size={13} />
            Config
          </button>

          {stats && stats.shortlisted > 0 && (
            <button
              onClick={handleBulkPromote}
              disabled={isPending}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "8px",
                border: "none",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff",
                fontSize: "12px",
                fontWeight: 600,
                cursor: isPending ? "wait" : "pointer",
              }}
            >
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <ArrowUpRight size={13} />}
              Promote Top {topN} to Pipeline
            </button>
          )}
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          gap: "20px",
        }}>
          <div>
            <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "4px" }}>
              Top N to shortlist
            </label>
            <input
              type="number"
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
              style={{
                width: "80px",
                padding: "6px 10px",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.3)",
                color: "#fff",
                fontSize: "13px",
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "#888", display: "block", marginBottom: "4px" }}>
              Auto-promote to pipeline
            </label>
            <button
              onClick={() => setAutoPromote(!autoPromote)}
              style={{
                padding: "6px 16px",
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.1)",
                background: autoPromote ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.03)",
                color: autoPromote ? "#22c55e" : "#888",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {autoPromote ? "ON" : "OFF"}
            </button>
          </div>
          <button
            onClick={handleSaveConfig}
            disabled={isPending}
            style={{
              padding: "6px 16px",
              borderRadius: "6px",
              border: "none",
              background: "#6366f1",
              color: "#fff",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            Save
          </button>
        </div>
      )}

      {/* Funnel Stats Bar */}
      {stats && stats.total > 0 && (
        <div style={{
          display: "flex",
          gap: "4px",
          marginBottom: "20px",
          alignItems: "center",
        }}>
          <FunnelSegment
            label="Received"
            count={stats.total}
            color="#6366f1"
            total={stats.total}
            icon={<Users size={12} />}
          />
          <ChevronArrow />
          <FunnelSegment
            label="Screened"
            count={stats.tier1Pass + stats.tier2Scored + stats.shortlisted + stats.promoted}
            color="#8b5cf6"
            total={stats.total}
            icon={<TrendingUp size={12} />}
          />
          <ChevronArrow />
          <FunnelSegment
            label="Shortlisted"
            count={stats.shortlisted + stats.promoted}
            color="#22c55e"
            total={stats.total}
            icon={<Star size={12} />}
          />
          <ChevronArrow />
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
        <div style={{
          textAlign: "center",
          padding: "40px 20px",
          color: "#555",
        }}>
          <BarChart3 size={40} style={{ marginBottom: "12px", opacity: 0.5 }} />
          <p style={{ fontSize: "14px", marginBottom: "4px" }}>No applications yet</p>
          <p style={{ fontSize: "12px" }}>
            Applications from Indeed and Google Jobs will appear here once candidates apply
          </p>
        </div>
      )}

      {/* Status Filter Tabs */}
      {stats && stats.total > 0 && (
        <div style={{
          display: "flex",
          gap: "6px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}>
          {[
            { value: "", label: "All", count: stats.total },
            { value: "SHORTLISTED", label: "Shortlisted", count: stats.shortlisted },
            { value: "TIER2_SCORED", label: "Scored", count: stats.tier2Scored },
            { value: "PROMOTED", label: "In Pipeline", count: stats.promoted },
            { value: "ARCHIVED", label: "Archived", count: stats.archived },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setStatusFilter(tab.value); setPage(1); }}
              style={{
                padding: "5px 14px",
                borderRadius: "8px",
                border: "1px solid",
                borderColor: statusFilter === tab.value ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.06)",
                background: statusFilter === tab.value ? "rgba(99,102,241,0.12)" : "transparent",
                color: statusFilter === tab.value ? "#818cf8" : "#888",
                fontSize: "12px",
                cursor: "pointer",
                fontWeight: statusFilter === tab.value ? 600 : 400,
              }}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      )}

      {/* Candidate Table */}
      {candidates.length > 0 && (
        <div style={{ borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
          {candidates.map((c, idx) => (
            <div key={c.id}>
              <div
                onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 100px 120px 100px",
                  alignItems: "center",
                  padding: "12px 16px",
                  background: idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                  cursor: "pointer",
                  transition: "background 0.15s",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                }}
              >
                {/* Name + Email */}
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#fff" }}>
                    {c.candidateName || "Unknown"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#666" }}>{c.candidateEmail}</div>
                </div>

                {/* Source */}
                <div style={{ fontSize: "11px", color: "#888" }}>
                  {c.source}
                </div>

                {/* AI Score */}
                <div>
                  {c.tier2Score !== null ? (
                    <ScoreBadge score={c.tier2Score} label={c.tier2Label} />
                  ) : c.tier1Score !== null ? (
                    <span style={{ fontSize: "11px", color: "#888" }}>T1: {c.tier1Score}</span>
                  ) : (
                    <span style={{ fontSize: "11px", color: "#555" }}>Pending</span>
                  )}
                </div>

                {/* Status */}
                <div>
                  <CandidateStatusBadge status={c.finalStatus} />
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {c.finalStatus === "SHORTLISTED" && (
                    <button
                      onClick={() => handlePromote(c.id)}
                      disabled={isPending}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "6px",
                        border: "none",
                        background: "rgba(34,197,94,0.12)",
                        color: "#22c55e",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Promote
                    </button>
                  )}
                  {!["PROMOTED", "ARCHIVED", "PURGED"].includes(c.finalStatus) && (
                    <button
                      onClick={() => handleArchive(c.id)}
                      disabled={isPending}
                      style={{
                        padding: "4px 8px",
                        borderRadius: "6px",
                        border: "none",
                        background: "rgba(255,255,255,0.04)",
                        color: "#666",
                        fontSize: "11px",
                        cursor: "pointer",
                      }}
                    >
                      <Archive size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded Detail */}
              {expandedId === c.id && (
                <div style={{
                  padding: "16px 24px",
                  background: "rgba(99,102,241,0.03)",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}>
                  {c.tier2Rationale && (
                    <div style={{ marginBottom: "12px" }}>
                      <div style={{ fontSize: "11px", color: "#888", fontWeight: 600, marginBottom: "4px" }}>
                        AI Assessment
                      </div>
                      <p style={{ fontSize: "12px", color: "#ccc", lineHeight: 1.6, margin: 0 }}>
                        {c.tier2Rationale}
                      </p>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "24px" }}>
                    {Array.isArray(c.tier2MatchedSkills) && c.tier2MatchedSkills.length > 0 && (
                      <div>
                        <div style={{ fontSize: "11px", color: "#22c55e", fontWeight: 600, marginBottom: "6px" }}>
                          ✅ Matched Skills
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {(c.tier2MatchedSkills as string[]).map((s) => (
                            <span key={s} style={{
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: "rgba(34,197,94,0.1)",
                              color: "#22c55e",
                              fontSize: "11px",
                            }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {Array.isArray(c.tier2MissingSkills) && c.tier2MissingSkills.length > 0 && (
                      <div>
                        <div style={{ fontSize: "11px", color: "#ef4444", fontWeight: 600, marginBottom: "6px" }}>
                          ❌ Missing Skills
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {(c.tier2MissingSkills as string[]).map((s) => (
                            <span key={s} style={{
                              padding: "2px 8px",
                              borderRadius: "4px",
                              background: "rgba(239,68,68,0.1)",
                              color: "#ef4444",
                              fontSize: "11px",
                            }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {c.location && (
                    <div style={{ fontSize: "11px", color: "#666", marginTop: "8px" }}>
                      📍 {c.location} {c.phone ? `• 📞 ${c.phone}` : ""}
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
        <div style={{
          display: "flex",
          justifyContent: "center",
          gap: "8px",
          marginTop: "16px",
        }}>
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            style={{
              padding: "5px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "transparent",
              color: page <= 1 ? "#333" : "#888",
              fontSize: "12px",
              cursor: page <= 1 ? "default" : "pointer",
            }}
          >
            Previous
          </button>
          <span style={{ fontSize: "12px", color: "#666", lineHeight: "32px" }}>
            Page {page} of {Math.ceil(totalCandidates / 20)}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page * 20 >= totalCandidates}
            style={{
              padding: "5px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "transparent",
              color: page * 20 >= totalCandidates ? "#333" : "#888",
              fontSize: "12px",
              cursor: page * 20 >= totalCandidates ? "default" : "pointer",
            }}
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
    <div style={{
      flex: 1,
      background: `${color}10`,
      border: `1px solid ${color}25`,
      borderRadius: "10px",
      padding: "10px 12px",
      textAlign: "center",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px", marginBottom: "4px", color }}>
        {icon}
        <span style={{ fontSize: "18px", fontWeight: 700 }}>{count.toLocaleString()}</span>
      </div>
      <div style={{ fontSize: "11px", color: "#888" }}>{label}</div>
      {total > 0 && (
        <div style={{ fontSize: "10px", color: "#555", marginTop: "2px" }}>{pct}%</div>
      )}
    </div>
  );
}

function ChevronArrow() {
  return (
    <div style={{ color: "#333", display: "flex", alignItems: "center" }}>
      <ChevronDown size={14} style={{ transform: "rotate(-90deg)" }} />
    </div>
  );
}

function ScoreBadge({ score, label }: { score: number; label: string | null }) {
  let bg: string, color: string;
  if (score >= 80) { bg = "rgba(34,197,94,0.12)"; color = "#22c55e"; }
  else if (score >= 60) { bg = "rgba(6,182,212,0.12)"; color = "#06b6d4"; }
  else if (score >= 40) { bg = "rgba(234,179,8,0.12)"; color = "#eab308"; }
  else { bg = "rgba(239,68,68,0.12)"; color = "#ef4444"; }

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      padding: "3px 8px",
      borderRadius: "6px",
      fontSize: "11px",
      fontWeight: 700,
      background: bg,
      color,
    }}>
      {score}
    </span>
  );
}

function CandidateStatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; color: string; label: string }> = {
    RECEIVED: { bg: "rgba(255,255,255,0.05)", color: "#666", label: "Received" },
    TIER1_PASS: { bg: "rgba(99,102,241,0.1)", color: "#818cf8", label: "Screened" },
    TIER1_FAIL: { bg: "rgba(239,68,68,0.1)", color: "#ef4444", label: "Filtered" },
    TIER2_SCORING: { bg: "rgba(234,179,8,0.1)", color: "#eab308", label: "Scoring..." },
    TIER2_SCORED: { bg: "rgba(6,182,212,0.1)", color: "#06b6d4", label: "Scored" },
    SHORTLISTED: { bg: "rgba(34,197,94,0.1)", color: "#22c55e", label: "Shortlisted" },
    PROMOTED: { bg: "rgba(34,197,94,0.15)", color: "#22c55e", label: "In Pipeline" },
    ARCHIVED: { bg: "rgba(255,255,255,0.04)", color: "#555", label: "Archived" },
    PURGED: { bg: "rgba(239,68,68,0.08)", color: "#ef4444", label: "Purged" },
  };

  const c = config[status] || config.RECEIVED;

  return (
    <span style={{
      display: "inline-block",
      padding: "3px 8px",
      borderRadius: "6px",
      fontSize: "11px",
      fontWeight: 500,
      background: c.bg,
      color: c.color,
    }}>
      {c.label}
    </span>
  );
}
