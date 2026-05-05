"use client";

/**
 * BgvDrawerView — Background Verification Drawer
 *
 * Rendered inside the ScheduleDrawer when the pipeline stage is BGV_CHECK.
 * 5 visual states: AVAILABLE → IN_PROGRESS → COMPLETED → ADVERSE_ACTION → MANUAL_UPLOAD
 */

import { useState, useTransition, useEffect, useCallback } from "react";
import {
  Shield, ShieldCheck, ShieldAlert, ShieldX,
  CheckCircle, Clock, AlertTriangle, XCircle,
  Upload, Copy, ExternalLink, FileText, Sparkles,
  ChevronDown, ChevronUp, Lock, Send, RotateCcw,
  Loader2, MapPin, DollarSign,
} from "lucide-react";
import {
  initiateBgvCheckAction,
  getBgvCheckStatusAction,
  reviewBgvReportAction,
  uploadBgvReportAction,
  sendPreAdverseNoticeAction,
  confirmAdverseActionAction,
  generateUploadLinkAction,
} from "./bgv-actions";
import { PII_CONSENT_TEXT } from "@/lib/bgv/pii-consent";
import { getPackagesForVendor } from "@/lib/bgv/packages";
import type { BgvVendorType, BgvAdjudication, BgvCheck, BgvAuditLog } from "@prisma/client";
import type { BgvPackage } from "@/lib/bgv/types";
import type { PiiDetection } from "@/lib/bgv/pii-shield";
import { formatDate } from "@/lib/locale-utils";

// ── Props ───────────────────────────────────────────────────────────────────

interface BgvDrawerViewProps {
  resumeId: string;
  positionId: string;
  candidateName: string;
  stageIndex: number;
  interviewId?: string;
  totalStages: number;
  onAdvanceToStage?: (stageIndex: number) => void;
  onClose: () => void;
}

// ── Vendor card data ────────────────────────────────────────────────────────

const VENDORS: { type: BgvVendorType; label: string; description: string; enabled: boolean; icon: string }[] = [
  { type: "CHECKR", label: "Checkr", description: "Requires US Entity & Credentialing", enabled: false, icon: "🔗" },
  { type: "CERTN", label: "Certn", description: "Coming soon", enabled: false, icon: "🔮" },
  { type: "MANUAL", label: "Manual Upload", description: "Upload a BGV report from any vendor", enabled: true, icon: "📤" },
  { type: "CANDIDATE_VENDOR", label: "Candidate's Vendor", description: "Share a link for agency upload", enabled: true, icon: "🤝" },
];

// US States
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
];

// ── Helper: time ago ────────────────────────────────────────────────────────

function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Component ───────────────────────────────────────────────────────────────

export function BgvDrawerView({
  resumeId,
  positionId,
  candidateName,
  stageIndex,
  interviewId,
  totalStages,
  onAdvanceToStage,
  onClose,
}: BgvDrawerViewProps) {
  const [isPending, startTransition] = useTransition();
  const [bgvCheck, setBgvCheck] = useState<(BgvCheck & { auditLogs: BgvAuditLog[] }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Initiation form state
  const [selectedVendor, setSelectedVendor] = useState<BgvVendorType>("MANUAL");
  const [selectedPackage, setSelectedPackage] = useState<string>("");
  const [workLocation, setWorkLocation] = useState("CA");
  const [packages, setPackages] = useState<BgvPackage[]>([]);

  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [piiConsent, setPiiConsent] = useState(false);
  const [scanningPii, setScanningPii] = useState(false);
  const [piiDetections, setPiiDetections] = useState<PiiDetection[]>([]);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Review state
  const [reviewNotes, setReviewNotes] = useState("");
  const [expandedCheck, setExpandedCheck] = useState<string | null>(null);

  // Upload link state
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // ── Fetch BGV check status ──────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const res = await getBgvCheckStatusAction({
        resumeId,
        positionId,
        stageIndex,
      });
      if (res.success) {
        setBgvCheck(res.bgvCheck as (BgvCheck & { auditLogs: BgvAuditLog[] }) | null);
      }
    } catch (err) {
      console.error("[BGV] Failed to fetch status:", err);
    } finally {
      setLoading(false);
    }
  }, [resumeId, positionId, stageIndex]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Update packages when vendor changes
  useEffect(() => {
    const pkgs = getPackagesForVendor(selectedVendor);
    setPackages(pkgs);
    const recommended = pkgs.find((p) => p.recommended);
    setSelectedPackage(recommended?.slug || pkgs[0]?.slug || "");
  }, [selectedVendor]);

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleInitiate = () => {
    setError(null);
    const pkg = packages.find((p) => p.slug === selectedPackage);
    if (!pkg) return setError("Please select a package.");

    startTransition(async () => {
      const res = await initiateBgvCheckAction({
        resumeId,
        positionId,
        vendorType: selectedVendor,
        packageSlug: pkg.slug,
        packageLabel: pkg.label,
        checksRequested: pkg.checks,
        workLocation,
        stageIndex,
        interviewId,
      });

      if (res.success) {
        setSuccess("BGV initiated successfully!");
        if (res.uploadToken) {
          const appUrl = typeof window !== "undefined" ? window.location.origin : "";
          setUploadUrl(`${appUrl}/bgv-upload/${res.uploadToken}`);
        }
        fetchStatus();
      } else {
        setError(res.error || "Failed to initiate BGV.");
      }
    });
  };

  const handleUpload = () => {
    if (!uploadFile || !bgvCheck) return;
    if (!piiConsent) return setError("PII consent attestation is required.");

    setError(null);
    setScanningPii(true);
    setPiiDetections([]);

    startTransition(async () => {
      try {
        // Extract text from file (simplified — in production use a PDF parser)
        const text = await uploadFile.text().catch(() => "");
        const base64 = await fileToBase64(uploadFile);

        const res = await uploadBgvReportAction({
          bgvCheckId: bgvCheck.id,
          reportText: text,
          reportBase64: base64,
          consentGiven: piiConsent,
        });

        if (res.success) {
          setUploadSuccess(true);
          setSuccess("Report uploaded! PII scan passed. AI summary generated.");
          fetchStatus();
        } else {
          if (res.piiDetections) {
            setPiiDetections(res.piiDetections as PiiDetection[]);
            setError("Sensitive information detected. Please redact and re-upload.");
          } else {
            setError(res.error || "Upload failed.");
          }
        }
      } finally {
        setScanningPii(false);
      }
    });
  };

  const handleReview = (adjudication: BgvAdjudication) => {
    if (!bgvCheck) return;
    setError(null);

    startTransition(async () => {
      const res = await reviewBgvReportAction({
        bgvCheckId: bgvCheck.id,
        adjudication,
        reviewNotes: reviewNotes || undefined,
        positionId,
        resumeId,
        totalStages,
      });

      if (res.success) {
        if (adjudication === "CLEAR") {
          setSuccess("BGV cleared! Pipeline advancing...");
          setTimeout(() => {
            if (stageIndex + 1 < totalStages) {
              onAdvanceToStage?.(stageIndex + 1);
            }
            onClose();
          }, 1200);
        } else {
          setSuccess("Review recorded.");
          fetchStatus();
        }
      } else {
        setError(res.error || "Review failed.");
      }
    });
  };

  const handleSendPreAdverse = () => {
    if (!bgvCheck) return;
    setError(null);
    startTransition(async () => {
      const res = await sendPreAdverseNoticeAction({
        bgvCheckId: bgvCheck.id,
        positionId,
      });
      if (res.success) {
        setSuccess("Pre-adverse notice sent. Dispute period started.");
        fetchStatus();
      } else {
        setError(res.error || "Failed to send notice.");
      }
    });
  };

  const handleConfirmAdverse = () => {
    if (!bgvCheck) return;
    setError(null);
    startTransition(async () => {
      const res = await confirmAdverseActionAction({
        bgvCheckId: bgvCheck.id,
        positionId,
        resumeId,
      });
      if (res.success) {
        setSuccess("Adverse action confirmed. Candidate rejected.");
        fetchStatus();
      } else {
        setError(res.error || "Failed to confirm adverse action.");
      }
    });
  };

  const handleGenerateLink = () => {
    if (!bgvCheck) return;
    startTransition(async () => {
      const res = await generateUploadLinkAction({
        bgvCheckId: bgvCheck.id,
        positionId,
      });
      if (res.success && res.uploadUrl) {
        setUploadUrl(res.uploadUrl);
      }
    });
  };

  const handleCopyLink = () => {
    if (uploadUrl) {
      navigator.clipboard.writeText(uploadUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Loading ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Loading BGV status...</span>
      </div>
    );
  }

  // ── Error/Success banners ───────────────────────────────────────────────

  const Banner = () => (
    <>
      {error && (
        <div className="mx-4 mt-3 px-4 py-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 rounded-xl text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="mx-4 mt-3 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}
    </>
  );

  // ── STATE: AVAILABLE — Vendor Selection & Initiation ────────────────────

  if (!bgvCheck) {
    const selectedPkg = packages.find((p) => p.slug === selectedPackage);

    return (
      <div className="flex-1 overflow-y-auto pb-4">
        {/* Section Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-pink-50 dark:from-blue-900/10 dark:to-pink-900/10 border-b border-blue-100 dark:border-blue-800/30">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Background Verification</h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Select a vendor and package to initiate background checks for {candidateName}.
          </p>
        </div>

        <Banner />

        {/* Vendor Cards */}
        <div className="px-4 mt-4">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            Select Vendor
          </label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {VENDORS.map((v) => (
              <button
                key={v.type}
                onClick={() => v.enabled && setSelectedVendor(v.type)}
                disabled={!v.enabled}
                className={`p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                  selectedVendor === v.type && v.enabled
                    ? "border-pink-500 bg-pink-50 dark:bg-pink-900/20 ring-2 ring-pink-500/30 scale-[1.02]"
                    : v.enabled
                      ? "border-gray-200 dark:border-zinc-700 hover:border-pink-300 dark:hover:border-pink-700 bg-white dark:bg-zinc-800/50"
                      : "border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 opacity-50 cursor-not-allowed"
                }`}
              >
                <span className="text-lg">{v.icon}</span>
                <p className="text-xs font-bold text-gray-900 dark:text-white mt-1">{v.label}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight mt-0.5">{v.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Package Selection */}
        {packages.length > 0 && (
          <div className="px-4 mt-4">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
              Select Package
            </label>
            <div className="space-y-2 mt-2">
              {packages.map((pkg) => (
                <button
                  key={pkg.slug}
                  onClick={() => setSelectedPackage(pkg.slug)}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all duration-200 ${
                    selectedPackage === pkg.slug
                      ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20 ring-2 ring-rose-500/30"
                      : "border-gray-200 dark:border-zinc-700 hover:border-rose-300 bg-white dark:bg-zinc-800/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-900 dark:text-white">{pkg.label}</span>
                      {pkg.recommended && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                          ⭐ Recommended
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-gray-900 dark:text-white">
                      {pkg.priceCents > 0 ? `$${(pkg.priceCents / 100).toFixed(2)}` : "Free"}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{pkg.description}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {pkg.checks.map((c) => (
                      <span key={c} className="px-1.5 py-0.5 text-[9px] bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300 rounded-full">
                        {c.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                  {pkg.estimatedDays > 0 && (
                    <p className="text-[10px] text-gray-400 mt-1">
                      ⏱ Est. {pkg.estimatedDays} business day{pkg.estimatedDays > 1 ? "s" : ""}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Work Location */}
        {selectedVendor === "CHECKR" && (
          <div className="px-4 mt-4">
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center gap-1">
              <MapPin className="w-3 h-3" /> Work Location
            </label>
            <select
              value={workLocation}
              onChange={(e) => setWorkLocation(e.target.value)}
              className="mt-2 w-full px-3 py-2 text-sm bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
            >
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        )}

        {/* Cost Preview */}
        {selectedPkg && selectedPkg.priceCents > 0 && (
          <div className="mx-4 mt-4 px-4 py-3 bg-gray-50 dark:bg-zinc-800/50 rounded-xl border border-gray-200 dark:border-zinc-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Estimated Cost</span>
              </div>
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                ${(selectedPkg.priceCents / 100).toFixed(2)}
              </span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              ⏱ {selectedPkg.estimatedDays} business day{selectedPkg.estimatedDays > 1 ? "s" : ""} estimated turnaround
            </p>
          </div>
        )}

        {/* Initiate Button */}
        <div className="px-4 mt-5">
          <button
            onClick={handleInitiate}
            disabled={isPending || !selectedPackage}
            className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-rose-500 hover:from-emerald-600 hover:to-rose-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : selectedVendor === "MANUAL" || selectedVendor === "CANDIDATE_VENDOR" ? (
              <>📎 Generate Upload Link</>
            ) : (
              <>🚀 Initiate Background Check</>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Determine visual state ──────────────────────────────────────────────

  const status = bgvCheck.status;
  const isInProgress = ["INITIATED", "PENDING_CONSENT", "CONSENT_GIVEN", "IN_PROGRESS"].includes(status);
  const isCompleted = status === "COMPLETED";
  const isReviewed = ["CLEAR", "CONSIDER"].includes(status);
  const isAdverseFlow = ["PRE_ADVERSE_SENT", "DISPUTE_PERIOD", "ADVERSE_CONFIRMED", "DISPUTE_RESOLVED"].includes(status);
  const needsUpload = ["INITIATED"].includes(status) && (bgvCheck.vendorType === "MANUAL" || bgvCheck.vendorType === "CANDIDATE_VENDOR");

  // ── Timeline milestones ─────────────────────────────────────────────────

  const milestones = [
    { label: "Initiated", done: true, time: bgvCheck.createdAt },
    { label: "Candidate Consent", done: ["CONSENT_GIVEN", "IN_PROGRESS", "COMPLETED", "CLEAR", "CONSIDER", "PRE_ADVERSE_SENT", "DISPUTE_PERIOD", "ADVERSE_CONFIRMED"].includes(status), time: bgvCheck.consentGivenAt },
    { label: "Checks Running", done: ["IN_PROGRESS", "COMPLETED", "CLEAR", "CONSIDER", "PRE_ADVERSE_SENT", "DISPUTE_PERIOD", "ADVERSE_CONFIRMED"].includes(status), active: status === "IN_PROGRESS" },
    { label: "Report Ready", done: ["COMPLETED", "CLEAR", "CONSIDER", "PRE_ADVERSE_SENT", "DISPUTE_PERIOD", "ADVERSE_CONFIRMED"].includes(status), time: bgvCheck.completedAt },
    { label: "Reviewed", done: ["CLEAR", "CONSIDER", "PRE_ADVERSE_SENT", "DISPUTE_PERIOD", "ADVERSE_CONFIRMED"].includes(status), time: bgvCheck.reviewedAt },
  ];

  // ── Parse report findings ───────────────────────────────────────────────

  type Finding = { checkType: string; status: string; summary: string; details?: string };
  const reportFindings: Finding[] = bgvCheck.reportJson
    ? ((bgvCheck.reportJson as Record<string, unknown>).findings as Finding[]) || []
    : [];

  const riskAssessment = bgvCheck.reportJson
    ? (bgvCheck.reportJson as Record<string, unknown>).riskAssessment as string
    : null;

  // ── STATE: IN_PROGRESS — Status Timeline ────────────────────────────────

  if (isInProgress && !needsUpload) {
    return (
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-rose-50 dark:from-blue-900/10 dark:to-rose-900/10 border-b border-blue-100 dark:border-blue-800/30">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600 animate-pulse" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">BGV In Progress</h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {bgvCheck.vendorType === "CHECKR" ? "Checkr" : "Vendor"} · {bgvCheck.packageLabel || "Background Check"}
          </p>
        </div>

        <Banner />

        {/* Timeline */}
        <div className="px-6 mt-5">
          <div className="relative">
            {milestones.map((m, i) => (
              <div key={i} className="flex items-start gap-3 mb-5 last:mb-0">
                {/* Dot + Line */}
                <div className="relative flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    m.done ? "bg-emerald-500 border-emerald-500" : m.active ? "bg-amber-500 border-amber-500 animate-pulse" : "bg-white dark:bg-zinc-800 border-gray-300 dark:border-zinc-600"
                  }`}>
                    {m.done && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                    {m.active && <Clock className="w-3 h-3 text-white" />}
                  </div>
                  {i < milestones.length - 1 && (
                    <div className={`w-0.5 h-8 mt-1 ${m.done ? "bg-emerald-400" : "bg-gray-200 dark:bg-zinc-700"}`} />
                  )}
                </div>
                {/* Label */}
                <div className="pt-0.5">
                  <p className={`text-xs font-semibold ${m.done ? "text-emerald-700 dark:text-emerald-400" : m.active ? "text-amber-700 dark:text-amber-400" : "text-gray-400 dark:text-gray-500"}`}>
                    {m.label}
                  </p>
                  {m.time && (
                    <p className="text-[10px] text-gray-400">{timeAgo(m.time as Date)}</p>
                  )}
                  {m.active && <p className="text-[10px] text-amber-500">Processing...</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Estimated completion */}
        {bgvCheck.vendorType === "CHECKR" && (
          <div className="mx-4 mt-4 px-4 py-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800/30">
            <p className="text-xs text-blue-700 dark:text-blue-400">
              📧 Consent form sent to candidate via Checkr
            </p>
          </div>
        )}
      </div>
    );
  }

  // ── STATE: MANUAL UPLOAD ────────────────────────────────────────────────

  if (needsUpload) {
    return (
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-pink-50 dark:from-blue-900/10 dark:to-pink-900/10 border-b border-blue-100 dark:border-blue-800/30">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Upload BGV Report</h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {bgvCheck.vendorType === "CANDIDATE_VENDOR" ? "Share upload link or upload directly" : "Upload a completed BGV report"}
          </p>
        </div>

        <Banner />

        {/* Shareable Upload Link */}
        {(bgvCheck.uploadLinkToken || uploadUrl) && (
          <div className="mx-4 mt-4 px-4 py-3 bg-pink-50 dark:bg-pink-900/10 rounded-xl border border-pink-200 dark:border-pink-800/30">
            <p className="text-xs font-semibold text-pink-700 dark:text-pink-400 mb-2">📎 Shareable Upload Link</p>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={uploadUrl || `${typeof window !== "undefined" ? window.location.origin : ""}/bgv-upload/${bgvCheck.uploadLinkToken}`}
                className="flex-1 px-2 py-1.5 text-[10px] bg-white dark:bg-zinc-800 border border-pink-200 dark:border-pink-700 rounded-lg text-gray-700 dark:text-gray-300"
              />
              <button
                onClick={handleCopyLink}
                className="px-2 py-1.5 bg-pink-100 dark:bg-pink-800/30 rounded-lg text-pink-700 dark:text-pink-400 hover:bg-pink-200 transition-colors"
              >
                {copied ? <CheckCircle className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[10px] text-pink-500 mt-1">
              Expires: {bgvCheck.uploadLinkExpiresAt ? formatDate(new Date(bgvCheck.uploadLinkExpiresAt)) : "7 days"}
            </p>
          </div>
        )}

        {/* PII Consent */}
        <div className="mx-4 mt-4 px-4 py-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800/30">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={piiConsent}
              onChange={(e) => setPiiConsent(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[10px] text-blue-800 dark:text-blue-300 leading-relaxed whitespace-pre-wrap">
              {PII_CONSENT_TEXT}
            </span>
          </label>
        </div>

        {/* File Upload */}
        <div className="mx-4 mt-4">
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200 ${
              uploadFile
                ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/10"
                : "border-gray-300 dark:border-zinc-600 hover:border-pink-400 dark:hover:border-pink-600 bg-white dark:bg-zinc-800/50"
            }`}
          >
            {uploadFile ? (
              <div>
                <FileText className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mt-2">{uploadFile.name}</p>
                <p className="text-[10px] text-gray-500 mt-1">{(uploadFile.size / 1024).toFixed(0)} KB</p>
                <button
                  onClick={() => setUploadFile(null)}
                  className="text-[10px] text-red-500 underline mt-1"
                >
                  Remove
                </button>
              </div>
            ) : (
              <label className="cursor-pointer">
                <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                <p className="text-xs text-gray-500 mt-2">Drag & drop or click to browse</p>
                <p className="text-[10px] text-gray-400 mt-1">PDF, PNG, JPG · Max 20MB</p>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                />
              </label>
            )}
          </div>
        </div>

        {/* PII Scan Progress */}
        {scanningPii && (
          <div className="mx-4 mt-4 px-4 py-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800/30">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-600 animate-spin" />
              <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">Scanning for sensitive information...</span>
            </div>
            <div className="mt-2 h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          </div>
        )}

        {/* PII Detected */}
        {piiDetections.length > 0 && (
          <div className="mx-4 mt-4 px-4 py-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800/30">
            <div className="flex items-center gap-2 mb-2">
              <ShieldX className="w-5 h-5 text-red-600" />
              <span className="text-xs font-bold text-red-700 dark:text-red-400">Upload Blocked — Sensitive Information Detected</span>
            </div>
            <div className="space-y-1.5">
              {piiDetections.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] text-red-600 dark:text-red-400">
                  <XCircle className="w-3 h-3 flex-shrink-0" />
                  <span>{d.type} — {d.location} ({d.confidence} confidence)</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-red-500 mt-2">Please redact this information and re-upload. The file has NOT been stored.</p>
          </div>
        )}

        {/* Upload Success */}
        {uploadSuccess && (
          <div className="mx-4 mt-4 px-4 py-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200 dark:border-emerald-800/30">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Report Uploaded Successfully</span>
            </div>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-500">🛡️ PII scan: Clean — no sensitive information detected</p>
            <p className="text-[10px] text-emerald-600 dark:text-emerald-500">📊 AI summary generated</p>
          </div>
        )}

        {/* Upload Button */}
        {!uploadSuccess && (
          <div className="px-4 mt-4">
            <button
              onClick={handleUpload}
              disabled={!uploadFile || !piiConsent || isPending || scanningPii}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-pink-500 hover:from-blue-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              {isPending || scanningPii ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>📤 Upload & Scan Report</>
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── STATE: COMPLETED / REVIEWED — Report Review ─────────────────────────

  if (isCompleted || isReviewed) {
    return (
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="px-4 py-3 bg-gradient-to-r from-emerald-50 to-rose-50 dark:from-emerald-900/10 dark:to-rose-900/10 border-b border-emerald-100 dark:border-emerald-800/30">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">BGV Report Ready</h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {bgvCheck.packageLabel} · Completed {bgvCheck.completedAt ? timeAgo(bgvCheck.completedAt) : ""}
          </p>
        </div>

        <Banner />

        {/* AI Summary Card */}
        {bgvCheck.reportSummary && (
          <div className="mx-4 mt-4 p-4 rounded-xl bg-gradient-to-br from-white to-emerald-50/50 dark:from-zinc-800 dark:to-emerald-900/10 border border-emerald-200/60 dark:border-emerald-700/30 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-emerald-800 dark:text-emerald-400">AI Report Summary</span>
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed italic">
              &quot;{bgvCheck.reportSummary}&quot;
            </p>
            {riskAssessment && (
              <div className={`inline-flex items-center gap-1 mt-2 px-2 py-1 rounded-full text-[10px] font-bold ${
                riskAssessment === "CLEAR" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                riskAssessment === "CAUTION" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              }`}>
                {riskAssessment === "CLEAR" ? "✅" : riskAssessment === "CAUTION" ? "⚠️" : "🚨"} Risk: {riskAssessment}
              </div>
            )}
          </div>
        )}

        {/* Check Results Grid */}
        {reportFindings.length > 0 && (
          <div className="px-4 mt-4 space-y-2">
            {reportFindings.map((f, i) => (
              <button
                key={i}
                onClick={() => setExpandedCheck(expandedCheck === f.checkType ? null : f.checkType)}
                className="w-full p-3 rounded-xl bg-white dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 text-left transition-all duration-200 hover:shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{f.status === "clear" ? "✅" : f.status === "consider" ? "⚠️" : f.status === "pending" ? "⏳" : "❌"}</span>
                    <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 capitalize">{f.checkType.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold capitalize ${
                      f.status === "clear" ? "text-emerald-600" : f.status === "consider" ? "text-amber-600" : "text-gray-500"
                    }`}>{f.status}</span>
                    {expandedCheck === f.checkType ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{f.summary}</p>
                {expandedCheck === f.checkType && f.details && (
                  <p className="text-[10px] text-gray-400 mt-2 pt-2 border-t border-gray-100 dark:border-zinc-700">{f.details}</p>
                )}
              </button>
            ))}
          </div>
        )}

        {/* View Full Report */}
        {bgvCheck.reportUrl && (
          <div className="px-4 mt-3">
            <button className="flex items-center gap-2 text-xs text-pink-600 dark:text-pink-400 hover:underline">
              <ExternalLink className="w-3.5 h-3.5" /> View Full Report PDF
            </button>
          </div>
        )}

        {/* Review Notes */}
        {isCompleted && (
          <>
            <div className="px-4 mt-4">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">Review Notes (optional)</label>
              <textarea
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add notes about this BGV review..."
                className="mt-1 w-full px-3 py-2 text-xs bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg resize-none h-16 focus:ring-2 focus:ring-pink-500"
              />
            </div>

            {/* Adjudication Buttons */}
            <div className="px-4 mt-4 space-y-2">
              <button
                onClick={() => handleReview("CLEAR")}
                disabled={isPending}
                className="w-full py-3 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-rose-500 hover:from-emerald-600 hover:to-rose-600 disabled:opacity-50 transition-all duration-200 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <>✅ Clear — Proceed</>}
              </button>
              <button
                onClick={() => handleSendPreAdverse()}
                disabled={isPending}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-300 dark:border-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-all duration-200 flex items-center justify-center gap-2"
              >
                ⚠️ Consider — Send Pre-Adverse Notice
              </button>
            </div>
          </>
        )}

        {/* Already Reviewed Badge */}
        {isReviewed && (
          <div className={`mx-4 mt-4 px-4 py-3 rounded-xl border ${
            status === "CLEAR"
              ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/40"
              : "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/40"
          }`}>
            <p className={`text-xs font-bold ${status === "CLEAR" ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
              {status === "CLEAR" ? "✅ Cleared" : "⚠️ Under Consideration"}
            </p>
            {bgvCheck.reviewNotes && (
              <p className="text-[10px] text-gray-500 mt-1">{bgvCheck.reviewNotes}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── STATE: ADVERSE ACTION — Dispute Period ──────────────────────────────

  if (isAdverseFlow) {
    const disputeDeadline = bgvCheck.disputeDeadline ? new Date(bgvCheck.disputeDeadline) : null;
    const isDisputeActive = disputeDeadline && disputeDeadline > new Date();
    const daysLeft = disputeDeadline
      ? Math.max(0, Math.ceil((disputeDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : 0;

    return (
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="px-4 py-3 bg-gradient-to-r from-amber-50 to-red-50 dark:from-amber-900/10 dark:to-red-900/10 border-b border-amber-100 dark:border-amber-800/30">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Adverse Action Process</h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">FCRA compliance — dispute period active</p>
        </div>

        <Banner />

        {/* Dispute Period Countdown */}
        {isDisputeActive && (
          <div className="mx-4 mt-4 px-4 py-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border-2 border-amber-300 dark:border-amber-700">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-amber-600" />
              <span className="text-xs font-bold text-amber-800 dark:text-amber-400">Dispute Period Active</span>
            </div>
            <div className="text-2xl font-black text-amber-700 dark:text-amber-400">
              {daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining
            </div>
            <p className="text-[10px] text-amber-600 mt-1">
              Candidate may dispute findings until {disputeDeadline ? formatDate(disputeDeadline) : ""}
            </p>
          </div>
        )}

        {/* Status: Adverse Confirmed */}
        {status === "ADVERSE_CONFIRMED" && (
          <div className="mx-4 mt-4 px-4 py-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800/30">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="text-xs font-bold text-red-700 dark:text-red-400">Adverse Action Confirmed</span>
            </div>
            <p className="text-[10px] text-red-600 mt-1">
              Confirmed: {bgvCheck.adverseAt ? formatDate(new Date(bgvCheck.adverseAt)) : ""}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="px-4 mt-4 space-y-2">
          {/* Resend Notice */}
          <button
            onClick={handleSendPreAdverse}
            disabled={isPending}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 border border-amber-300 dark:border-amber-700 hover:bg-amber-100 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <Send className="w-3.5 h-3.5" /> Resend Pre-Adverse Notice
          </button>

          {/* Resolve Favorably */}
          <button
            onClick={() => handleReview("CLEAR")}
            disabled={isPending}
            className="w-full py-2.5 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Resolve Favorably
          </button>

          {/* Confirm Adverse Action — LOCKED during dispute */}
          <button
            onClick={handleConfirmAdverse}
            disabled={isPending || !!isDisputeActive}
            className={`w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
              isDisputeActive
                ? "text-gray-400 bg-gray-100 dark:bg-zinc-800 border-2 border-gray-200 dark:border-zinc-700 cursor-not-allowed"
                : "text-white bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/20"
            }`}
            title={isDisputeActive ? `Locked until ${disputeDeadline ? formatDate(disputeDeadline) : ""} (FCRA dispute period)` : undefined}
          >
            {isDisputeActive ? (
              <>
                <Lock className="w-4 h-4" />
                Locked — {daysLeft} days remaining
              </>
            ) : (
              <>❌ Confirm Adverse Action</>
            )}
          </button>

          {isDisputeActive && (
            <p className="text-[10px] text-center text-gray-400">
              🔒 FCRA requires a minimum 5 business day dispute period before adverse action can be confirmed
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Fallback ────────────────────────────────────────────────────────────

  return (
    <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
      <Shield className="w-5 h-5 mr-2" /> BGV check status: {status}
    </div>
  );
}

// ── Utility ─────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] || result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
