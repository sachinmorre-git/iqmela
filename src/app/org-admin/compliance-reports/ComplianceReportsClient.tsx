"use client";

import { useState, useTransition } from "react";
import {
  Shield, FileText, Clock, CheckCircle2, XCircle, AlertTriangle,
  Download, ChevronDown, ChevronRight, Loader2, Search,
  Scale, Eye, Fingerprint, Globe, Lock, Trash2, Plus,
  TrendingUp, Calendar, Building2, BarChart3,
} from "lucide-react";
import { generateComplianceReport, deleteReport } from "./actions";

type Report = {
  id: string;
  orgId: string | null;
  positionId: string | null;
  type: string;
  status: string;
  periodStart: string | null;
  periodEnd: string | null;
  reportData: any;
  requestedBy: string;
  notes: string | null;
  createdAt: string;
};

const REPORT_TYPE_META: Record<string, { label: string; icon: any; color: string; bg: string; description: string; agency: string }> = {
  NYC_AEDT_BIAS_AUDIT: {
    label: "NYC AEDT Bias Audit",
    icon: Scale,
    color: "text-rose-400",
    bg: "from-rose-900/30",
    description: "NYC Local Law 144 — Annual bias audit for Automated Employment Decision Tools",
    agency: "NYC DCWP",
  },
  EEOC_DIVERSITY_LOG: {
    label: "EEOC Diversity Report",
    icon: BarChart3,
    color: "text-green-400",
    bg: "from-green-900/30",
    description: "Title VII — Hiring funnel demographics and adverse impact analysis",
    agency: "EEOC",
  },
  GDPR_DSAR_SUMMARY: {
    label: "GDPR/DPDP DSAR Log",
    icon: Lock,
    color: "text-blue-400",
    bg: "from-blue-900/30",
    description: "GDPR Art. 15–17 / India DPDP — Data access, rectification, and erasure records",
    agency: "ICO / DPB",
  },
  AIVIA_CONSENT_LOG: {
    label: "AIVIA Consent Trail",
    icon: Fingerprint,
    color: "text-amber-400",
    bg: "from-amber-900/30",
    description: "Illinois AIVIA & BIPA — AI video consent and biometric compliance audit",
    agency: "IL AG",
  },
  DATA_MINIMIZATION_AUDIT: {
    label: "Data Minimization Audit",
    icon: Eye,
    color: "text-violet-400",
    bg: "from-violet-900/30",
    description: "CCPA/CPRA, GDPR Art. 5 — Data retention policy compliance check",
    agency: "Multiple",
  },
  PIPEDA_PRIVACY_REPORT: {
    label: "PIPEDA / Law 25 Report",
    icon: Globe,
    color: "text-red-400",
    bg: "from-red-900/30",
    description: "Canada PIPEDA & Quebec Law 25 — Privacy impact assessment and consent records",
    agency: "OPC / CAI",
  },
  AI_BIAS_MONITORING: {
    label: "AI Bias Monitoring",
    icon: TrendingUp,
    color: "text-cyan-400",
    bg: "from-cyan-900/30",
    description: "AI score distribution, human override rates, and adverse impact analysis",
    agency: "NYC 144 / GDPR",
  },
};

const STATUS_META: Record<string, { label: string; color: string; icon: any }> = {
  GENERATING: { label: "Generating...", color: "text-amber-400 bg-amber-500/10 border-amber-500/20", icon: Loader2 },
  READY: { label: "Ready", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
  FAILED: { label: "Failed", color: "text-red-400 bg-red-500/10 border-red-500/20", icon: XCircle },
};

function ReadinessScorecard({ reports }: { reports: Report[] }) {
  const readyReports = reports.filter((r) => r.status === "READY");
  const reportTypes = Object.keys(REPORT_TYPE_META);
  const coveredTypes = new Set(readyReports.map((r) => r.type));
  const coverage = reportTypes.length > 0 ? Math.round((coveredTypes.size / reportTypes.length) * 100) : 0;

  // Check freshness (< 12 months old)
  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);

  const freshReports = readyReports.filter((r) => new Date(r.createdAt) > oneYearAgo);
  const freshCoverage = new Set(freshReports.map((r) => r.type));

  return (
    <div className="bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-800 rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Compliance Readiness
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">Real-time audit coverage across all applicable frameworks</p>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-black ${coverage >= 80 ? "text-emerald-400" : coverage >= 50 ? "text-amber-400" : "text-red-400"}`}>
            {coverage}%
          </div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Coverage</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {reportTypes.map((type) => {
          const meta = REPORT_TYPE_META[type];
          const hasFresh = freshCoverage.has(type);
          const hasAny = coveredTypes.has(type);
          const latest = readyReports.filter((r) => r.type === type).sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )[0];

          return (
            <div key={type} className={`rounded-xl border p-3 ${hasFresh ? "border-emerald-500/20 bg-emerald-500/5" : hasAny ? "border-amber-500/20 bg-amber-500/5" : "border-zinc-800 bg-zinc-900/50"}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-2 h-2 rounded-full ${hasFresh ? "bg-emerald-400 shadow-sm shadow-emerald-400/60" : hasAny ? "bg-amber-400" : "bg-zinc-600"}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${hasFresh ? "text-emerald-400" : hasAny ? "text-amber-400" : "text-zinc-600"}`}>
                  {hasFresh ? "Current" : hasAny ? "Stale" : "Missing"}
                </span>
              </div>
              <p className={`text-xs font-bold ${meta.color}`}>{meta.label}</p>
              {latest && (
                <p className="text-[10px] text-zinc-500 mt-1">
                  Last: {new Date(latest.createdAt).toLocaleDateString()}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GenerateReportForm({ isRecruiter }: { isRecruiter: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);

  if (isRecruiter) return null;

  const now = new Date();
  const oneYearAgo = new Date(now);
  oneYearAgo.setFullYear(now.getFullYear() - 1);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
      <button onClick={() => setIsOpen((p) => !p)}
        className="w-full flex items-center justify-between p-5 hover:bg-zinc-900/80 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/20 flex items-center justify-center">
            <Plus className="w-5 h-5 text-rose-400" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold text-white">Generate New Compliance Report</h3>
            <p className="text-xs text-zinc-500">Select report type and date range</p>
          </div>
        </div>
        {isOpen ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
      </button>

      {isOpen && (
        <form action={(fd) => startTransition(() => generateComplianceReport(fd))}
          className="p-5 pt-0 space-y-4 border-t border-zinc-800">
          <input type="hidden" name="scope" value="org" />

          <div>
            <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Report Type</label>
            <select name="type" required
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-500">
              {Object.entries(REPORT_TYPE_META).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label} — {meta.agency}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Period Start</label>
              <input type="date" name="periodStart" required
                defaultValue={oneYearAgo.toISOString().split("T")[0]}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Period End</label>
              <input type="date" name="periodEnd" required
                defaultValue={now.toISOString().split("T")[0]}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-zinc-500" />
            </div>
          </div>

          <button type="submit" disabled={isPending}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-rose-900/30">
            {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</> : <><FileText className="w-4 h-4" /> Generate Report</>}
          </button>
        </form>
      )}
    </div>
  );
}

function ReportDetailView({ report, onClose }: { report: Report; onClose: () => void }) {
  const data = report.reportData as Record<string, any>;
  if (!data) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-16 overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-4xl shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-black text-white">{data.reportTitle || "Compliance Report"}</h2>
            {data.regulation && <p className="text-xs text-zinc-400 mt-1">{Array.isArray(data.regulations) ? data.regulations.join(" | ") : data.regulation}</p>}
            {data.enforcingAgency && <p className="text-xs text-rose-400 mt-0.5">Filing Agency: {Array.isArray(data.enforcingAgencies) ? data.enforcingAgencies.join(", ") : data.enforcingAgency}</p>}
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-sm font-bold px-3 py-1 rounded-lg hover:bg-zinc-800">✕ Close</button>
        </div>

        {/* Rendered Report Data */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {Object.entries(data).map(([key, value]) => {
            if (["reportTitle", "regulation", "regulations", "enforcingAgency", "enforcingAgencies"].includes(key)) return null;

            return (
              <div key={key} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                  {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                </h3>
                {typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? (
                  <p className="text-sm text-white">{String(value)}</p>
                ) : Array.isArray(value) ? (
                  <ul className="space-y-1.5">
                    {value.map((item, i) =>
                      typeof item === "string" ? (
                        <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                          <span className="text-rose-400 mt-0.5">•</span> {item}
                        </li>
                      ) : (
                        <li key={i} className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
                          {Object.entries(item as Record<string, any>).map(([k, v]) => (
                            <div key={k} className="flex justify-between text-xs py-0.5">
                              <span className="text-zinc-500">{k.replace(/([A-Z])/g, " $1")}</span>
                              <span className="text-white font-medium">{String(v)}</span>
                            </div>
                          ))}
                        </li>
                      )
                    )}
                  </ul>
                ) : typeof value === "object" && value !== null ? (
                  <div className="space-y-1">
                    {Object.entries(value).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-sm py-1 border-b border-zinc-800/50 last:border-none">
                        <span className="text-zinc-400">{k.replace(/([A-Z])/g, " $1")}</span>
                        <span className="text-white font-medium text-right max-w-[60%]">
                          {typeof v === "object" ? JSON.stringify(v, null, 0) : String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-between">
          <p className="text-[10px] text-zinc-600">Generated by IQMela Compliance Engine • {new Date(report.createdAt).toLocaleString()}</p>
          <button onClick={() => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${report.type}_${new Date(report.createdAt).toISOString().split("T")[0]}.json`;
            a.click();
          }}
            className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1.5 transition-colors">
            <Download className="w-3.5 h-3.5" /> Download JSON
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportVault({ reports, isRecruiter }: { reports: Report[]; isRecruiter: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewingReport, setViewingReport] = useState<Report | null>(null);
  const [isPending, startTransition] = useTransition();

  if (reports.length === 0) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-12 text-center">
        <FileText className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
        <h3 className="text-sm font-bold text-zinc-500">No reports generated yet</h3>
        <p className="text-xs text-zinc-600 mt-1">Generate your first compliance report using the form above.</p>
      </div>
    );
  }

  return (
    <>
      {viewingReport && <ReportDetailView report={viewingReport} onClose={() => setViewingReport(null)} />}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-zinc-400" /> Report Vault
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">{reports.length} report{reports.length !== 1 ? "s" : ""} on file</p>
          </div>
        </div>

        <div className="divide-y divide-zinc-800/50">
          {reports.map((report) => {
            const typeMeta = REPORT_TYPE_META[report.type] ?? { label: report.type, icon: FileText, color: "text-zinc-400", bg: "from-zinc-900/30", description: "", agency: "" };
            const statusMeta = STATUS_META[report.status] ?? STATUS_META.READY;
            const StatusIcon = statusMeta.icon;

            return (
              <div key={report.id} className="hover:bg-zinc-900/30 transition-colors">
                <div className="flex items-center gap-4 px-5 py-4 cursor-pointer" onClick={() => report.status === "READY" ? setViewingReport(report) : null}>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${typeMeta.bg} to-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0`}>
                    <typeMeta.icon className={`w-5 h-5 ${typeMeta.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{typeMeta.label}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusMeta.color} flex items-center gap-1`}>
                        <StatusIcon className={`w-2.5 h-2.5 ${report.status === "GENERATING" ? "animate-spin" : ""}`} />
                        {statusMeta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(report.createdAt).toLocaleDateString()}</span>
                      {report.periodStart && report.periodEnd && (
                        <span>
                          {new Date(report.periodStart).toLocaleDateString()} — {new Date(report.periodEnd).toLocaleDateString()}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> {report.orgId ? "Organization" : "Platform-wide"}
                      </span>
                    </div>
                    {report.notes && <p className="text-[11px] text-amber-400 mt-1">{report.notes}</p>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {report.status === "READY" && (
                      <button onClick={(e) => { e.stopPropagation(); setViewingReport(report); }}
                        className="text-xs font-bold text-sky-400 hover:text-sky-300 px-3 py-1.5 rounded-lg hover:bg-sky-500/10 transition-colors">
                        View
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function AgencyDirectory() {
  const agencies = [
    { name: "NYC DCWP", jurisdiction: "New York City", reportType: "AEDT Bias Audit", cadence: "Annual", color: "text-rose-400" },
    { name: "EEOC", jurisdiction: "United States", reportType: "EEO-1 Component 1", cadence: "Annual (Mar–Apr)", color: "text-green-400" },
    { name: "ICO", jurisdiction: "United Kingdom", reportType: "DPIA / DSAR Log", cadence: "On deployment + Annual", color: "text-blue-400" },
    { name: "OPC", jurisdiction: "Canada (Federal)", reportType: "PIPEDA Breach Report", cadence: "Within 72 hrs of breach", color: "text-red-400" },
    { name: "CAI (Quebec)", jurisdiction: "Quebec, Canada", reportType: "Law 25 PIA", cadence: "Before deployment", color: "text-pink-400" },
    { name: "IL AG", jurisdiction: "Illinois", reportType: "AIVIA Compliance", cadence: "On request", color: "text-amber-400" },
    { name: "OAIC", jurisdiction: "Australia", reportType: "Privacy Impact Assessment", cadence: "On deployment", color: "text-yellow-400" },
    { name: "DPB (India)", jurisdiction: "India", reportType: "DPDP Compliance", cadence: "Annual", color: "text-orange-400" },
  ];

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-zinc-800">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Globe className="w-4 h-4 text-zinc-400" /> Agency Filing Directory
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">Pre-configured regulatory agencies and filing cadences</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950/50">
              <th className="text-left px-5 py-3 text-zinc-500 font-bold uppercase tracking-wider">Agency</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-bold uppercase tracking-wider">Jurisdiction</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-bold uppercase tracking-wider">Report Type</th>
              <th className="text-left px-4 py-3 text-zinc-500 font-bold uppercase tracking-wider">Filing Cadence</th>
            </tr>
          </thead>
          <tbody>
            {agencies.map((a) => (
              <tr key={a.name} className="border-b border-zinc-800/40 hover:bg-zinc-900/40 transition-colors">
                <td className={`px-5 py-3 font-bold ${a.color}`}>{a.name}</td>
                <td className="px-4 py-3 text-zinc-300">{a.jurisdiction}</td>
                <td className="px-4 py-3 text-zinc-400">{a.reportType}</td>
                <td className="px-4 py-3 text-zinc-400">{a.cadence}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ComplianceReportsClient({ reports, isRecruiter }: { reports: Report[]; isRecruiter: boolean }) {
  return (
    <div className="space-y-6">
      {/* Readiness Scorecard */}
      <ReadinessScorecard reports={reports} />

      {/* Generate Form */}
      <GenerateReportForm isRecruiter={isRecruiter} />

      {/* Report Vault */}
      <ReportVault reports={reports} isRecruiter={isRecruiter} />

      {/* Agency Directory */}
      <AgencyDirectory />
    </div>
  );
}
