"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  Activity, Database, Shield, Bot, Video, Fingerprint, Code2,
  CheckCircle2, AlertTriangle, XCircle, Clock, Loader2,
  TrendingUp, RefreshCw, Plus, ChevronDown, ChevronRight,
  Zap, Globe, Server,
} from "lucide-react";
import { resolveIncident, updateIncidentStatus, createManualIncident } from "./actions";

type ServiceResult = {
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs: number;
  error?: string;
};

type HealthResponse = {
  status: string;
  timestamp: string;
  services: Record<string, ServiceResult>;
};

type Incident = {
  id: string;
  title: string;
  service: string;
  severity: string;
  status: string;
  description: string | null;
  autoDetected: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
};

type RecentLog = {
  service: string;
  status: string;
  latencyMs: number | null;
  checkedAt: string;
};

const SERVICE_META: Record<string, { label: string; icon: any; description: string; critical: boolean }> = {
  database: { label: "Neon PostgreSQL", icon: Database, description: "Primary database (US East)", critical: true },
  clerk:    { label: "Clerk Auth", icon: Shield, description: "Authentication & Identity", critical: true },
  gemini:   { label: "Google Gemini", icon: Bot, description: "AI Interview Scoring", critical: false },
  deepseek: { label: "DeepSeek", icon: Bot, description: "Judgment & Reasoning AI", critical: false },
  livekit:  { label: "LiveKit Cloud", icon: Video, description: "Real-time Video/Audio", critical: false },
  tavus:    { label: "Tavus Avatar", icon: Fingerprint, description: "AI Avatar Rendering", critical: false },
  piston:   { label: "Piston Runtime", icon: Code2, description: "Code Execution Engine", critical: false },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; glow: string; label: string }> = {
  healthy:   { bg: "bg-emerald-500/10", text: "text-emerald-400", glow: "shadow-emerald-400/40", label: "Healthy" },
  degraded:  { bg: "bg-amber-500/10", text: "text-amber-400", glow: "shadow-amber-400/40", label: "Degraded" },
  unhealthy: { bg: "bg-red-500/10", text: "text-red-400", glow: "shadow-red-400/40", label: "Unhealthy" },
};

const SEVERITY_STYLES: Record<string, string> = {
  critical: "text-red-400 bg-red-500/10 border-red-500/25",
  high:     "text-orange-400 bg-orange-500/10 border-orange-500/25",
  medium:   "text-amber-400 bg-amber-500/10 border-amber-500/25",
  low:      "text-blue-400 bg-blue-500/10 border-blue-500/25",
};

const INCIDENT_STATUS_STYLES: Record<string, string> = {
  open:          "text-red-400 bg-red-500/10 border-red-500/25",
  investigating: "text-amber-400 bg-amber-500/10 border-amber-500/25",
  mitigating:    "text-sky-400 bg-sky-500/10 border-sky-500/25",
  resolved:      "text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
};

function StatusDot({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.unhealthy;
  return <span className={`w-2.5 h-2.5 rounded-full ${status === "healthy" ? "bg-emerald-400" : status === "degraded" ? "bg-amber-400" : "bg-red-400"} shadow-sm ${s.glow} inline-block`} />;
}

function OverallStatusBanner({ healthData }: { healthData: HealthResponse | null }) {
  if (!healthData) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
        <span className="text-sm text-zinc-500">Running health checks...</span>
      </div>
    );
  }

  const statusConfig: Record<string, { bg: string; border: string; text: string; icon: any; label: string }> = {
    healthy:  { bg: "from-emerald-900/30 to-zinc-900", border: "border-emerald-500/25", text: "text-emerald-400", icon: CheckCircle2, label: "All Systems Operational" },
    degraded: { bg: "from-amber-900/30 to-zinc-900", border: "border-amber-500/25", text: "text-amber-400", icon: AlertTriangle, label: "Performance Degraded" },
    impaired: { bg: "from-orange-900/30 to-zinc-900", border: "border-orange-500/25", text: "text-orange-400", icon: AlertTriangle, label: "Service Impaired" },
    critical: { bg: "from-red-900/30 to-zinc-900", border: "border-red-500/25", text: "text-red-400", icon: XCircle, label: "Critical Outage" },
  };

  const cfg = statusConfig[healthData.status] ?? statusConfig.critical;
  const Icon = cfg.icon;
  const serviceCount = Object.keys(healthData.services).length;
  const healthyCount = Object.values(healthData.services).filter((s) => s.status === "healthy").length;

  return (
    <div className={`bg-gradient-to-r ${cfg.bg} border ${cfg.border} rounded-2xl p-6`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl ${cfg.text} bg-black/30 flex items-center justify-center`}>
            <Icon className="w-7 h-7" />
          </div>
          <div>
            <h2 className={`text-xl font-black ${cfg.text}`}>{cfg.label}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {healthyCount}/{serviceCount} services healthy • Last check: {new Date(healthData.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-black ${cfg.text}`}>
            {Math.round((healthyCount / serviceCount) * 100)}%
          </div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Uptime</p>
        </div>
      </div>
    </div>
  );
}

function ServiceGrid({ healthData }: { healthData: HealthResponse | null }) {
  if (!healthData) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {Object.entries(healthData.services).map(([key, result]) => {
        const meta = SERVICE_META[key] ?? { label: key, icon: Server, description: "", critical: false };
        const s = STATUS_STYLES[result.status] ?? STATUS_STYLES.unhealthy;

        return (
          <div key={key} className={`${s.bg} border border-zinc-800 rounded-xl p-4 transition-all hover:border-zinc-700`}>
            <div className="flex items-center justify-between mb-3">
              <meta.icon className={`w-5 h-5 ${s.text}`} />
              <div className="flex items-center gap-1.5">
                <StatusDot status={result.status} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${s.text}`}>{s.label}</span>
              </div>
            </div>

            <h3 className="text-sm font-bold text-white">{meta.label}</h3>
            <p className="text-[10px] text-zinc-500 mt-0.5">{meta.description}</p>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800/50">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3 h-3 text-zinc-600" />
                <span className="text-xs text-zinc-400 font-mono">{result.latencyMs}ms</span>
              </div>
              {meta.critical && (
                <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded">
                  CRITICAL
                </span>
              )}
            </div>

            {result.error && (
              <div className="mt-2 bg-red-950/30 border border-red-500/15 rounded-lg p-2">
                <p className="text-[10px] text-red-300 font-mono break-all">{result.error}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function IncidentPanel({ incidents }: { incidents: Incident[] }) {
  const [isPending, startTransition] = useTransition();
  const [showCreateForm, setShowCreateForm] = useState(false);

  const activeIncidents = incidents.filter((i) => i.status !== "resolved");
  const resolvedIncidents = incidents.filter((i) => i.status === "resolved").slice(0, 10);

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" /> Incidents
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {activeIncidents.length} active • {resolvedIncidents.length} recently resolved
          </p>
        </div>
        <button onClick={() => setShowCreateForm((p) => !p)}
          className="text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition-colors">
          <Plus className="w-3.5 h-3.5" /> Log Incident
        </button>
      </div>

      {showCreateForm && (
        <form action={(fd) => startTransition(() => { createManualIncident(fd); setShowCreateForm(false); })}
          className="p-5 border-b border-zinc-800 space-y-3 bg-zinc-950/50">
          <div className="grid grid-cols-3 gap-3">
            <input name="title" required placeholder="Incident title..."
              className="col-span-3 bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500" />
            <select name="service" required
              className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500">
              {Object.entries(SERVICE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              <option value="platform">Platform</option>
            </select>
            <select name="severity" required
              className="bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500">
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium" selected>Medium</option>
              <option value="low">Low</option>
            </select>
            <button type="submit" disabled={isPending}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-50">
              {isPending ? "Creating..." : "Create"}
            </button>
          </div>
          <textarea name="description" rows={2} placeholder="Description (optional)..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500" />
        </form>
      )}

      {activeIncidents.length === 0 && resolvedIncidents.length === 0 ? (
        <div className="p-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-500/30 mx-auto mb-2" />
          <p className="text-xs text-zinc-600">No incidents recorded. All clear!</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-800/50">
          {activeIncidents.map((inc) => (
            <div key={inc.id} className="px-5 py-4 flex items-start gap-4">
              <div className="shrink-0 mt-0.5">
                <span className={`w-2.5 h-2.5 rounded-full inline-block ${inc.severity === "critical" ? "bg-red-400 animate-pulse" : inc.severity === "high" ? "bg-orange-400" : "bg-amber-400"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">{inc.title}</span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${SEVERITY_STYLES[inc.severity] ?? ""}`}>
                    {inc.severity.toUpperCase()}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${INCIDENT_STATUS_STYLES[inc.status] ?? ""}`}>
                    {inc.status.toUpperCase()}
                  </span>
                  {inc.autoDetected && (
                    <span className="text-[9px] font-bold text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">AUTO</span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  {SERVICE_META[inc.service]?.label ?? inc.service} • {new Date(inc.createdAt).toLocaleString()}
                </p>
                {inc.description && <p className="text-xs text-zinc-400 mt-1">{inc.description}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {inc.status === "open" && (
                  <button onClick={() => startTransition(() => updateIncidentStatus(inc.id, "investigating"))}
                    disabled={isPending}
                    className="text-[10px] font-bold text-amber-400 hover:text-amber-300 px-2 py-1 rounded hover:bg-amber-500/10 transition-colors">
                    Investigate
                  </button>
                )}
                {inc.status !== "resolved" && (
                  <button onClick={() => startTransition(() => resolveIncident(inc.id))}
                    disabled={isPending}
                    className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded hover:bg-emerald-500/10 transition-colors">
                    Resolve
                  </button>
                )}
              </div>
            </div>
          ))}

          {resolvedIncidents.length > 0 && (
            <>
              <div className="px-5 py-2 bg-zinc-950/50">
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Recently Resolved</span>
              </div>
              {resolvedIncidents.map((inc) => (
                <div key={inc.id} className="px-5 py-3 flex items-center gap-3 opacity-60">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-zinc-400">{inc.title}</span>
                    <span className="text-[10px] text-zinc-600 ml-2">
                      {inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RecentLogsTimeline({ logs }: { logs: RecentLog[] }) {
  if (logs.length === 0) return null;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-zinc-800">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <Clock className="w-4 h-4 text-zinc-400" /> Recent Health Checks
        </h2>
        <p className="text-xs text-zinc-500 mt-0.5">Last 50 probe results</p>
      </div>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950/50 sticky top-0">
              <th className="text-left px-5 py-2 text-zinc-500 font-bold">Time</th>
              <th className="text-left px-3 py-2 text-zinc-500 font-bold">Service</th>
              <th className="text-center px-3 py-2 text-zinc-500 font-bold">Status</th>
              <th className="text-right px-5 py-2 text-zinc-500 font-bold">Latency</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, i) => {
              const s = STATUS_STYLES[log.status] ?? STATUS_STYLES.unhealthy;
              return (
                <tr key={i} className="border-b border-zinc-800/30 hover:bg-zinc-900/40">
                  <td className="px-5 py-2 text-zinc-500 font-mono">{new Date(log.checkedAt).toLocaleTimeString()}</td>
                  <td className="px-3 py-2 text-white">{SERVICE_META[log.service]?.label ?? log.service}</td>
                  <td className="text-center px-3 py-2">
                    <span className={`inline-flex items-center gap-1 ${s.text}`}>
                      <StatusDot status={log.status} />
                      {s.label}
                    </span>
                  </td>
                  <td className="text-right px-5 py-2 text-zinc-400 font-mono">{log.latencyMs ?? "—"}ms</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function HealthDashboardClient({
  incidents,
  recentLogs,
}: {
  incidents: Incident[];
  recentLogs: RecentLog[];
}) {
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const data = await res.json();
      setHealthData(data);
      setLastRefresh(new Date());
    } catch {
      setHealthData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchHealth, 60_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  return (
    <div className="space-y-6">
      {/* Refresh Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Activity className="w-3.5 h-3.5" />
          {lastRefresh ? `Last probe: ${lastRefresh.toLocaleTimeString()}` : "Initializing..."}
          <span className="text-zinc-700">•</span>
          <span>Auto-refreshes every 60s</span>
        </div>
        <button onClick={fetchHealth} disabled={isLoading}
          className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Now
        </button>
      </div>

      {/* Overall Status */}
      <OverallStatusBanner healthData={healthData} />

      {/* Service Grid */}
      <ServiceGrid healthData={healthData} />

      {/* Incidents */}
      <IncidentPanel incidents={incidents} />

      {/* Recent Logs */}
      <RecentLogsTimeline logs={recentLogs} />
    </div>
  );
}
