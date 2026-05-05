"use client";
import { toast } from "sonner";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Loader2, X, FileText, CheckCircle, ChevronRight, Calculator,
  Calendar as CalendarIcon, UserCheck, Clock, XCircle, Send, RefreshCw, ExternalLink
} from "lucide-react";
import { createJobOfferAction, getOfferByResumeAction, getOfferTemplatesAction, resendApprovalAction, reviseOfferAction, manualApproveAction } from "@/app/org-admin/offer-actions";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/locale-utils";

interface OfferWorkspaceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  resumeId: string;
  positionId: string;
  candidateName: string;
  pipelineStatus?: string;
}

type OfferData = Awaited<ReturnType<typeof getOfferByResumeAction>> extends { offer: infer T } ? T : never;

export function OfferWorkspaceDrawer({
  isOpen,
  onClose,
  resumeId,
  positionId,
  candidateName,
  pipelineStatus,
}: OfferWorkspaceDrawerProps) {
  // ─── Shared state ────────────────────────────────────────────────────────
  const [mode, setMode] = useState<"create" | "track" | "loading">("loading");
  const [existingOffer, setExistingOffer] = useState<any>(null);

  // ─── Create mode states ──────────────────────────────────────────────────
  const [step, setStep] = useState<"DETAILS" | "APPROVALS" | "REVIEW">("DETAILS");
  const [baseSalary, setBaseSalary] = useState("");
  const [equity, setEquity] = useState("");
  const [bonus, setBonus] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [startDate, setStartDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [approvers, setApprovers] = useState([{ name: "", email: "", designation: "" }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // ─── Track mode states ───────────────────────────────────────────────────
  const [sendingReminder, setSendingReminder] = useState<string | null>(null);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [manualApproveId, setManualApproveId] = useState<string | null>(null);
  const [manualApproveNotes, setManualApproveNotes] = useState("");
  const [isApproving, setIsApproving] = useState(false);

  // ─── Portal ──────────────────────────────────────────────────────────────
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  useEffect(() => { setPortalTarget(document.body); }, []);

  // ─── Auto-detect mode on open ────────────────────────────────────────────
  const loadOffer = useCallback(async () => {
    if (!isOpen) return;
    setMode("loading");
    const res = await getOfferByResumeAction(resumeId, positionId);
    if (res.success && res.offer) {
      setExistingOffer(res.offer);
      setMode("track");
    } else {
      setMode("create");
    }
  }, [isOpen, resumeId, positionId]);

  useEffect(() => { loadOffer(); }, [loadOffer]);

  // ─── Load templates when entering create mode ─────────────────────────
  useEffect(() => {
    if (mode === "create" && templates.length === 0 && !loadingTemplates) {
      setLoadingTemplates(true);
      getOfferTemplatesAction().then(res => {
        if (res.success && res.templates) {
          setTemplates(res.templates);
          // Auto-select first template if none selected
          if (!templateId && res.templates.length > 0) {
            setTemplateId(res.templates[0].id);
          }
        }
      }).finally(() => setLoadingTemplates(false));
    }
  }, [mode]);

  // ─── Create mode handlers ────────────────────────────────────────────────
  const handleAddApprover = () => {
    setApprovers([...approvers, { name: "", email: "", designation: "" }]);
  };
  const handleRemoveApprover = (idx: number) => {
    setApprovers(approvers.filter((_, i) => i !== idx));
  };
  const handleUpdateApprover = (idx: number, field: string, val: string) => {
    const updated = [...approvers];
    (updated[idx] as any)[field] = val;
    setApprovers(updated);
  };
  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      const res = await createJobOfferAction({
        resumeId,
        positionId,
        templateId: templateId || undefined,
        baseSalary: Number(baseSalary),
        currency,
        signOnBonus: Number(bonus) || undefined,
        equityAmount: equity || undefined,
        startDate,
        expirationDate: expiryDate,
        approvers: approvers.filter(a => a.name && a.email)
      });
      if (res.success) {
        toast.success("Offer drafted and sent for internal approval successfully!");
        onClose();
      } else {
        toast.error(res.error || "Failed to create offer");
      }
    } catch { toast.error("Network error."); }
    finally { setIsSubmitting(false); }
  };

  // ─── Track mode handlers ─────────────────────────────────────────────────
  const handleResend = async (approvalId: string) => {
    setSendingReminder(approvalId);
    const res = await resendApprovalAction(approvalId);
    if (res.success) {
      toast.success("Reminder sent! Check terminal for the mock email link.");
    } else {
      toast.error(res.error || "Failed to send reminder");
    }
    setSendingReminder(null);
  };

  const handleRefresh = async () => {
    await loadOffer();
  };

  const handleManualApprove = async (approvalId: string) => {
    setIsApproving(true);
    const res = await manualApproveAction(approvalId, manualApproveNotes || undefined);
    if (res.success) {
      setManualApproveId(null);
      setManualApproveNotes("");
      await loadOffer(); // refresh the tracker
    } else {
      toast.error(res.error || "Failed to approve");
    }
    setIsApproving(false);
  };

  // ─── Revise mode: pre-populate form from existing offer ──────────────────
  const enterReviseMode = () => {
    if (!existingOffer) return;
    setBaseSalary(String(existingOffer.baseSalary || ""));
    setBonus(String(existingOffer.signOnBonus || ""));
    setEquity(existingOffer.equityAmount || "");
    setCurrency(existingOffer.currency || "USD");
    setStartDate(existingOffer.startDate ? new Date(existingOffer.startDate).toISOString().split("T")[0] : "");
    setExpiryDate(existingOffer.expirationDate ? new Date(existingOffer.expirationDate).toISOString().split("T")[0] : "");
    // Pre-populate approvers from existing chain
    if (existingOffer.approvals?.length > 0) {
      setApprovers(existingOffer.approvals.map((a: any) => ({ name: a.name, email: a.email, designation: a.designation })));
    } else {
      setApprovers([{ name: "", email: "", designation: "" }]);
    }
    setStep("DETAILS");
    setMode("create");
  };

  const handleReviseSubmit = async () => {
    if (!existingOffer) return;
    try {
      setIsSubmitting(true);
      const res = await reviseOfferAction({
        offerId: existingOffer.id,
        baseSalary: Number(baseSalary),
        currency,
        signOnBonus: Number(bonus) || undefined,
        equityAmount: equity || undefined,
        startDate,
        expirationDate: expiryDate,
        approvers: approvers.filter(a => a.name && a.email),
      });
      if (res.success) {
        toast.success("Offer revised and re-sent for approval!");
        onClose();
      } else {
        toast.error(res.error || "Failed to revise offer");
      }
    } catch { toast.error("Network error."); }
    finally { setIsSubmitting(false); }
  };

  if (!isOpen || !portalTarget) return null;

  // ─── Status badge utils ──────────────────────────────────────────────────
  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      DRAFT: { bg: "bg-gray-100 dark:bg-zinc-800", text: "text-gray-600 dark:text-zinc-400", label: "Draft" },
      PENDING_APPROVAL: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", label: "Pending Approval" },
      FROZEN: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", label: "Approved & Frozen" },
      CHANGES_REQUESTED: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", label: "Changes Requested" },
      ACCEPTED: { bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-400", label: "Accepted by Candidate" },
      REJECTED_BY_CANDIDATE: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", label: "Rejected by Candidate" },
    };
    const s = map[status] || map.DRAFT;
    return <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  return createPortal(
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-0 right-0 z-50 h-full w-full max-w-[600px] bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

        {/* ═══ HEADER ═══ */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-900">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-rose-500" />
              {mode === "track" ? "Offer Tracker" : "Offer Studio"}
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              {mode === "track" ? "Tracking offer for" : "Drafting offer for"}{" "}
              <strong className="text-gray-900 dark:text-white">{candidateName}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            {mode === "track" && (
              <button type="button" onClick={handleRefresh} className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center text-gray-400 transition-colors" title="Refresh status">
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
            <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center text-gray-400 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ═══ BODY ═══ */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50 dark:bg-black/20">

          {/* ─── LOADING STATE ─── */}
          {mode === "loading" && (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
              <p className="text-sm text-gray-500 dark:text-zinc-400">Loading offer data…</p>
            </div>
          )}

          {/* ═══════════ TRACK MODE ═══════════ */}
          {mode === "track" && existingOffer && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">

              {/* ─── Offer Summary Card ─── */}
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-4 relative overflow-hidden">
                <div className="absolute -top-20 -right-20 w-40 h-40 bg-rose-400/5 rounded-full blur-2xl" />
                <div className="flex items-center justify-between relative z-10">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Offer Summary</h3>
                  {statusBadge(existingOffer.status)}
                </div>
                <div className="grid grid-cols-2 gap-3 relative z-10">
                  <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Base Salary</p>
                    <p className="text-lg font-black text-gray-900 dark:text-white mt-0.5">
                      {formatCurrency(Number(existingOffer.baseSalary), { currency: existingOffer.currency })}
                    </p>
                  </div>
                  {existingOffer.signOnBonus && (
                    <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Sign-on Bonus</p>
                      <p className="text-lg font-black text-gray-900 dark:text-white mt-0.5">
                        {formatCurrency(Number(existingOffer.signOnBonus), { currency: existingOffer.currency })}
                      </p>
                    </div>
                  )}
                  {existingOffer.equityAmount && (
                    <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Equity</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">{existingOffer.equityAmount}</p>
                    </div>
                  )}
                  <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider">Start Date</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5">
                      {formatDate(new Date(existingOffer.startDate))}
                    </p>
                  </div>
                </div>
              </div>

              {/* ─── Approval Chain Timeline ─── */}
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-rose-500" />
                  Approval Chain
                </h3>
                <div className="relative">
                  {/* Vertical connector line */}
                  <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-gray-200 dark:bg-zinc-800" />

                  <div className="space-y-1">
                    {existingOffer.approvals?.map((approval: any, idx: number) => {
                      const isApproved = approval.status === "APPROVED";
                      const isRejected = approval.status === "REJECTED";
                      const isPending = approval.status === "PENDING";
                      const isActive = isPending && (idx === 0 || existingOffer.approvals[idx - 1]?.status === "APPROVED");

                      return (
                        <div key={approval.id}>
                          <div className={`relative flex items-start gap-4 py-3 px-3 rounded-xl transition-colors ${isActive ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}`}>
                          {/* Status dot */}
                          <div className={`relative z-10 w-[30px] h-[30px] rounded-full flex items-center justify-center shrink-0 border-2 ${
                            isApproved ? "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-500 text-emerald-600" :
                            isRejected ? "bg-red-100 dark:bg-red-900/40 border-red-500 text-red-600" :
                            isActive ? "bg-amber-100 dark:bg-amber-900/40 border-amber-500 text-amber-600 animate-pulse" :
                            "bg-gray-100 dark:bg-zinc-800 border-gray-300 dark:border-zinc-700 text-gray-400"
                          }`}>
                            {isApproved && <CheckCircle className="w-4 h-4" />}
                            {isRejected && <XCircle className="w-4 h-4" />}
                            {isPending && <Clock className="w-3.5 h-3.5" />}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-gray-900 dark:text-white truncate">{approval.name}</span>
                              <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                                isApproved ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                isRejected ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                "bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400"
                              }`}>
                                {approval.status}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-500 dark:text-zinc-500">{approval.designation} · {approval.email}</p>
                            {approval.reviewNotes && (
                              <p className="text-xs text-gray-600 dark:text-zinc-400 mt-1 italic border-l-2 border-gray-200 dark:border-zinc-700 pl-2">
                                &ldquo;{approval.reviewNotes}&rdquo;
                              </p>
                            )}
                            {approval.updatedAt && !isPending && (
                              <p className="text-[10px] text-gray-400 dark:text-zinc-600 mt-1">
                                {formatDateTime(new Date(approval.updatedAt), { showTimezone: false })}
                              </p>
                            )}
                          </div>

                          {/* Action buttons for active pending */}
                          {isActive && (
                            <div className="shrink-0 flex flex-col gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleResend(approval.id)}
                                disabled={sendingReminder === approval.id}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-[10px] font-bold rounded-lg shadow-sm shadow-amber-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                              >
                                {sendingReminder === approval.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Send className="w-3 h-3" />
                                )}
                                Remind
                              </button>
                              <button
                                type="button"
                                onClick={() => setManualApproveId(manualApproveId === approval.id ? null : approval.id)}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded-lg shadow-sm shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                              >
                                <CheckCircle className="w-3 h-3" />
                                Mark Approved
                              </button>
                            </div>
                          )}
                          </div>

                          {/* Manual approve notes input */}
                          {manualApproveId === approval.id && (
                            <div className="ml-[46px] mt-2 mb-2 animate-in fade-in slide-in-from-top-1 duration-200">
                              <textarea
                                placeholder="Add notes (e.g. 'Verbal approval in standup')..."
                                value={manualApproveNotes}
                                onChange={e => setManualApproveNotes(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                                rows={2}
                              />
                              <div className="flex items-center gap-2 mt-2">
                                <button
                                  type="button"
                                  onClick={() => handleManualApprove(approval.id)}
                                  disabled={isApproving}
                                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                >
                                  {isApproving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                  Confirm Approval
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setManualApproveId(null); setManualApproveNotes(""); }}
                                  className="px-3 py-1.5 text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 text-[11px] font-medium transition-colors"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Candidate delivery status */}
                {(existingOffer.status === "FROZEN" || existingOffer.status === "ACCEPTED" || existingOffer.status === "REJECTED_BY_CANDIDATE") && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800 space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 shrink-0">
                        <ExternalLink className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-emerald-800 dark:text-emerald-400">Offer sent to candidate</p>
                        <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/60 truncate">
                          {existingOffer.resume?.candidateEmail || "No email on file"}
                        </p>
                      </div>
                    </div>

                    {/* Candidate Link */}
                    {existingOffer.candidateToken && (
                      <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-3 border border-gray-200 dark:border-zinc-700">
                        <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-1.5">Candidate Offer Link</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-[11px] bg-white dark:bg-zinc-900 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 truncate font-mono">
                            {typeof window !== "undefined" ? `${window.location.origin}/offer/${existingOffer.candidateToken}` : `/offer/${existingOffer.candidateToken}`}
                          </code>
                          <button
                            type="button"
                            onClick={() => {
                              const url = `${window.location.origin}/offer/${existingOffer.candidateToken}`;
                              navigator.clipboard.writeText(url);
                              toast.success("Link copied to clipboard!");
                            }}
                            className="shrink-0 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold rounded-lg transition-colors"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Candidate Response Status */}
                    <div className={`p-3 rounded-xl border ${
                      existingOffer.status === "ACCEPTED"
                        ? "bg-rose-50 dark:bg-rose-900/10 border-rose-100 dark:border-rose-800/30"
                        : existingOffer.status === "REJECTED_BY_CANDIDATE"
                        ? "bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-800/30"
                        : "bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-800/30"
                    }`}>
                      <div className="flex items-center gap-2">
                        {existingOffer.status === "ACCEPTED" ? (
                          <>
                            <CheckCircle className="w-4 h-4 text-rose-600" />
                            <p className="text-xs font-bold text-rose-800 dark:text-rose-400">Candidate Accepted! 🎉</p>
                          </>
                        ) : existingOffer.status === "REJECTED_BY_CANDIDATE" ? (
                          <>
                            <XCircle className="w-4 h-4 text-red-600" />
                            <p className="text-xs font-bold text-red-800 dark:text-red-400">Candidate Declined</p>
                          </>
                        ) : (
                          <>
                            <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                            <p className="text-xs font-bold text-amber-800 dark:text-amber-400">Awaiting candidate response</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {existingOffer.status === "CHANGES_REQUESTED" && (
                  <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
                    <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-800/30">
                      <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600">
                        <XCircle className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-red-800 dark:text-red-400">Offer rejected by a stakeholder</p>
                        <p className="text-[10px] text-red-600/70 dark:text-red-500/60">Review the notes above and revise the offer</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ─── Audit Log ─── */}
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAuditLog(!showAuditLog)}
                  className="w-full px-6 py-4 flex items-center justify-between text-sm font-bold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    Activity Timeline ({existingOffer.auditLogs?.length || 0} events)
                  </span>
                  <ChevronRight className={`w-4 h-4 transition-transform ${showAuditLog ? "rotate-90" : ""}`} />
                </button>
                {showAuditLog && (
                  <div className="px-6 pb-5 space-y-3 border-t border-gray-100 dark:border-zinc-800 pt-4">
                    {existingOffer.auditLogs?.map((log: any) => (
                      <div key={log.id} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-zinc-700 mt-2 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-800 dark:text-zinc-300">
                            {log.action.replace(/_/g, " ")}
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-zinc-600">
                            {formatDateTime(new Date(log.createdAt), { showTimezone: false })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ═══════════ CREATE MODE ═══════════ */}
          {mode === "create" && (
            <>
              {/* Stepper */}
              <div className="flex items-center justify-between relative mb-2">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-200 dark:bg-zinc-800 -z-10" />
                {[
                  { key: "DETAILS" as const, icon: Calculator, label: "1. Structured Data" },
                  { key: "APPROVALS" as const, icon: UserCheck, label: "2. Approvals" },
                  { key: "REVIEW" as const, icon: CheckCircle, label: "3. Freeze & Route" },
                ].map(({ key, icon: Icon, label }) => (
                  <div key={key} className={`flex flex-col items-center gap-2 ${step === key ? "text-rose-600" : "text-gray-400"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 bg-white dark:bg-zinc-900 ${step === key ? "border-rose-600 shadow-[0_0_0_4px_rgba(79,70,229,0.1)]" : "border-gray-200 dark:border-zinc-700"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
                  </div>
                ))}
              </div>

              {step === "DETAILS" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                  <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-gray-400" /> Compensation Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Base Salary</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                          <input type="number" placeholder="120,000" className="w-full pl-7 pr-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Sign-on Bonus</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                          <input type="number" placeholder="10,000" className="w-full pl-7 pr-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none" value={bonus} onChange={e => setBonus(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Equity Grant (RSUs / Options)</label>
                        <input type="text" placeholder="e.g. 5,000 RSUs vesting over 4 years" className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none" value={equity} onChange={e => setEquity(e.target.value)} />
                      </div>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-gray-400" /> Key Dates & Template
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Expected Start Date</label>
                        <input type="date" className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Offer Expiration Date</label>
                        <input type="date" className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Document Template</label>
                        <select
                          className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-rose-500 outline-none"
                          value={templateId}
                          onChange={e => setTemplateId(e.target.value)}
                        >
                          {loadingTemplates ? (
                            <option value="">Loading templates…</option>
                          ) : templates.length > 0 ? (
                            templates.map(t => (
                              <option key={t.id} value={t.id}>{t.name}{t.isStandard ? " ★" : ""}</option>
                            ))
                          ) : (
                            <option value="">Default Standard Offer (auto-generated)</option>
                          )}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === "APPROVALS" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                  <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-400 mb-1">Approval Chain Sequence</h4>
                    <p className="text-xs text-amber-700 dark:text-amber-500/80">These stakeholders will receive a sequential, secure link to review the structured data and rendered offer document.</p>
                  </div>
                  <div className="space-y-4">
                    {approvers.map((approver, idx) => (
                      <div key={idx} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm relative group">
                        <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-100 dark:bg-zinc-800 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-zinc-400 shadow-sm">
                          {idx + 1}
                        </div>
                        {approvers.length > 1 && (
                          <button type="button" onClick={() => handleRemoveApprover(idx)} className="absolute right-3 top-3 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-4 h-4" />
                          </button>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Name</label>
                            <input type="text" placeholder="John Doe" className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm" value={approver.name} onChange={e => handleUpdateApprover(idx, "name", e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Designation / Role</label>
                            <input type="text" placeholder="VP of Engineering" className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm" value={approver.designation} onChange={e => handleUpdateApprover(idx, "designation", e.target.value)} />
                          </div>
                          <div className="space-y-1 col-span-2">
                            <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Email Address (Secure Link Target)</label>
                            <input type="email" placeholder="john@company.com" className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm" value={approver.email} onChange={e => handleUpdateApprover(idx, "email", e.target.value)} />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={handleAddApprover} className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-xl text-sm font-medium text-gray-500 dark:text-zinc-400 hover:border-rose-400 hover:text-rose-600 dark:hover:border-rose-500/50 dark:hover:text-rose-400 transition-colors flex items-center justify-center gap-2 bg-white dark:bg-transparent">
                      + Add another approver
                    </button>
                  </div>
                </div>
              )}

              {step === "REVIEW" && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
                  <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-800/30 rounded-xl p-6 text-center">
                    <CheckCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
                    <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">Offer Ready to Freeze</h3>
                    <p className="text-sm text-gray-600 dark:text-zinc-400 max-w-sm mx-auto">Once submitted, this structured data package will be sent to the approval chain. No edits can be made without restarting the process.</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ═══ FOOTER ═══ */}
        {mode === "create" && (
          <div className="p-4 border-t border-gray-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-900 flex items-center justify-between">
            {step !== "DETAILS" ? (
              <button type="button" onClick={() => {
                setStep(step === "REVIEW" ? "APPROVALS" : "DETAILS");
              }} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                Back
              </button>
            ) : existingOffer ? (
              <button type="button" onClick={() => { setMode("track"); loadOffer(); }} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                ← Back to Tracker
              </button>
            ) : <div />}
            {step === "REVIEW" ? (
              <button type="button" onClick={existingOffer ? handleReviseSubmit : handleSubmit} disabled={isSubmitting} className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg shadow-sm shadow-rose-600/20 flex items-center gap-2 transition-colors disabled:opacity-50">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : existingOffer ? "Revise & Re-route" : "Freeze & Route to Approvers"}
              </button>
            ) : (
              <button type="button" onClick={() => setStep(step === "DETAILS" ? "APPROVALS" : "REVIEW")} className="px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 text-sm font-medium rounded-lg shadow-sm flex items-center gap-2 transition-colors">
                Next Step <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {mode === "track" && (
          <div className="p-4 border-t border-gray-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-900 flex items-center justify-between">
            <button type="button" onClick={onClose} className="px-5 py-2.5 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-zinc-300 text-sm font-medium rounded-lg transition-colors">
              Close
            </button>
            {existingOffer && existingOffer.status !== "FROZEN" && existingOffer.status !== "ACCEPTED" && (
              <button type="button" onClick={enterReviseMode} className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg shadow-sm shadow-amber-500/20 transition-all flex items-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Revise Offer
              </button>
            )}
          </div>
        )}
      </div>
    </>,
    portalTarget
  );
}
