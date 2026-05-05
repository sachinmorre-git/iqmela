"use client";

import { useState, useEffect, useTransition } from "react";
import { fetchScanHistory } from "./actions";
import { Shield, ShieldCheck, ShieldAlert, AlertTriangle, CheckCircle2, XCircle, Clock, Zap, RefreshCw, TrendingUp, Download } from "lucide-react";

type ScanResult = {
  id?: string;
  overallScore: number;
  grade: string;
  totalChecks: number;
  passed: number;
  warnings: number;
  failed: number;
  checks: any[];
  scanDurationMs: number;
  triggeredBy: string;
  createdAt?: string;
  scannedAt?: string;
};

const GRADE_COLORS: Record<string, string> = {
  "A+": "text-emerald-400",
  "A": "text-emerald-400",
  "B": "text-yellow-400",
  "C": "text-amber-400",
  "D": "text-orange-400",
  "F": "text-red-400",
};

const GRADE_BG: Record<string, string> = {
  "A+": "bg-emerald-500/10 border-emerald-500/20",
  "A": "bg-emerald-500/10 border-emerald-500/20",
  "B": "bg-yellow-500/10 border-yellow-500/20",
  "C": "bg-amber-500/10 border-amber-500/20",
  "D": "bg-orange-500/10 border-orange-500/20",
  "F": "bg-red-500/10 border-red-500/20",
};

export default function SecurityScanClient() {
  const [liveScan, setLiveScan] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const hist = await fetchScanHistory();
      setHistory(hist);
    });
  }, []);

  const runScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch("/api/security-scan");
      const data = await res.json();
      setLiveScan(data);
      // Refresh history
      const hist = await fetchScanHistory();
      setHistory(hist);
    } catch (err) {
      console.error("Scan failed:", err);
    } finally {
      setIsScanning(false);
    }
  };

  const activeScan = liveScan || (history.length > 0 ? history[0] : null);

  const formatDate = (iso?: string) => {
    if (!iso) return "Unknown Date";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "Unknown Date";
    return d.toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  const downloadReport = () => {
    if (!activeScan) return;
    
    const headers = ["Check Name", "Category", "Status", "Score", "Max Score", "Details", "Recommendation"];
    const rows = activeScan.checks.map(c => [
      `"${c.name}"`,
      `"${c.category}"`,
      `"${c.status.toUpperCase()}"`,
      c.score,
      c.maxScore,
      `"${c.details.replace(/"/g, '""')}"`,
      `"${(c.recommendation || "").replace(/"/g, '""')}"`
    ]);
    
    const dateStr = activeScan.createdAt || activeScan.scannedAt || new Date().toISOString();
    
    const summaryRows = [
      ["IQMela Security Scan Report"],
      [`Date: ${formatDate(dateStr)}`],
      [`Overall Score: ${activeScan.overallScore}/100 (Grade: ${activeScan.grade})`],
      [`Triggered By: ${activeScan.triggeredBy}`],
      [],
      headers,
      ...rows
    ];
    
    const csvContent = summaryRows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `iqmela_security_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
            <Shield className="w-7 h-7 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Security Scanner</h1>
            <p className="text-sm text-zinc-500">Automated 12-point security health check</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeScan && (
            <button
              onClick={downloadReport}
              className="px-4 py-2.5 text-sm font-bold bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4" /> Download CSV
            </button>
          )}
          <button
            onClick={runScan}
            disabled={isScanning}
            className="px-5 py-2.5 text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {isScanning ? (
              <><RefreshCw className="w-4 h-4 animate-spin" /> Scanning...</>
            ) : (
              <><Zap className="w-4 h-4" /> Run Scan Now</>
            )}
          </button>
        </div>
      </div>

      {/* Score Card */}
      {activeScan ? (
        <div className={`p-6 rounded-2xl border ${GRADE_BG[activeScan.grade] || "bg-zinc-900/60 border-zinc-800"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Big Score */}
              <div className="text-center">
                <div className={`text-6xl font-black ${GRADE_COLORS[activeScan.grade] || "text-white"}`}>
                  {activeScan.overallScore}
                </div>
                <div className="text-xs font-bold text-zinc-500 mt-1">/ 100</div>
              </div>
              {/* Grade Badge */}
              <div className="text-center">
                <div className={`text-5xl font-black ${GRADE_COLORS[activeScan.grade] || "text-white"}`}>
                  {activeScan.grade}
                </div>
                <div className="text-xs font-bold text-zinc-500 mt-1">GRADE</div>
              </div>
              {/* Stats */}
              <div className="space-y-2 ml-6">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-bold">{activeScan.passed} passed</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-400 font-bold">{activeScan.warnings} warnings</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span className="text-red-400 font-bold">{activeScan.failed} failed</span>
                </div>
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-xs text-zinc-500 flex items-center gap-1 justify-end">
                <Clock className="w-3 h-3" /> {formatDate(activeScan.createdAt || activeScan.scannedAt)}
              </div>
              <div className="text-xs text-zinc-600">
                {activeScan.scanDurationMs}ms • {activeScan.triggeredBy}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 rounded-2xl border border-zinc-800 bg-zinc-900/40 text-center">
          <Shield className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
          <p className="text-zinc-500 font-medium">No scan results yet. Click "Run Scan Now" to begin.</p>
        </div>
      )}

      {/* Detailed Checks */}
      {activeScan && activeScan.checks && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" /> Detailed Results
          </h2>
          <div className="grid gap-2">
            {activeScan.checks.map((check: any) => (
              <div
                key={check.id}
                className={`flex items-center justify-between p-4 rounded-xl border ${
                  check.status === "pass"
                    ? "bg-emerald-500/5 border-emerald-500/10"
                    : check.status === "warn"
                      ? "bg-amber-500/5 border-amber-500/10"
                      : "bg-red-500/5 border-red-500/10"
                }`}
              >
                <div className="flex items-center gap-3 flex-1">
                  {check.status === "pass" ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : check.status === "warn" ? (
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{check.name}</span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                        {check.category}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{check.details}</p>
                    {check.recommendation && (
                      <p className="text-xs text-amber-400/80 mt-0.5">💡 {check.recommendation}</p>
                    )}
                  </div>
                </div>
                <div className={`text-sm font-black ml-4 ${
                  check.status === "pass" ? "text-emerald-400" : check.status === "warn" ? "text-amber-400" : "text-red-400"
                }`}>
                  {check.score}/{check.maxScore}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scan History */}
      {history.length > 1 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-zinc-400" /> Scan History
          </h2>
          <div className="grid gap-2">
            {history.slice(1, 11).map((scan) => (
              <div
                key={scan.id}
                className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/40 border border-zinc-800"
              >
                <div className="flex items-center gap-4">
                  <span className={`text-xl font-black ${GRADE_COLORS[scan.grade] || "text-white"}`}>
                    {scan.grade}
                  </span>
                  <span className="text-sm text-white font-bold">{scan.overallScore}/100</span>
                  <span className="text-xs text-zinc-500">
                    ✅ {scan.passed} ⚠️ {scan.warnings} ❌ {scan.failed}
                  </span>
                </div>
                <div className="text-xs text-zinc-600 flex items-center gap-3">
                  <span>{scan.triggeredBy}</span>
                  <span>{formatDate(scan.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
