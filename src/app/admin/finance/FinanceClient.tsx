"use client";

import { useState, useTransition } from "react";
import {
  DollarSign, TrendingUp, TrendingDown, Cpu, Building2,
  Clock, Zap, ArrowUpRight, ArrowDownRight, Plus, Loader2,
  Check, Globe, UserCircle, Video, Cloud, Radio, Mic, Mail
} from "lucide-react";
import { createManualCostEntry } from "../compliance/actions";
import { formatDate, formatTime, formatNumber } from "@/lib/locale-utils"

interface FinanceProps {
  summary: {
    allTime: number;
    today: number;
    week: number;
    month: number;
    totalTokens: number;
    totalCalls: number;
    projectedMonthly: number;
    monthOverMonth: number;
    prevMonthCost: number;
    dailyAvg: number;
  };
  costByProvider: Array<{ provider: string; cost: number; tokens: number; calls: number }>;
  costByTask: Array<{ taskType: string; cost: number; tokens: number; calls: number }>;
  costByOrg: Array<{ orgId: string; orgName: string; cost: number; tokens: number; calls: number }>;
  recentLogs: Array<{ id: string; provider: string; model: string; taskType: string; totalTokens: number; estimatedCost: number; createdAt: string }>;
  manualEntries: Array<{ id: string; category: string; amount: number; description: string; periodStart: string; periodEnd: string; createdAt: string }>;
}

const PROVIDER_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  GEMINI:    { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  DEEPSEEK:  { bg: "bg-violet-500/10", text: "text-violet-400", dot: "bg-violet-400" },
  OPENAI:    { bg: "bg-green-500/10", text: "text-green-400", dot: "bg-green-400" },
  ANTHROPIC: { bg: "bg-orange-500/10", text: "text-orange-400", dot: "bg-orange-400" },
};

const TASK_LABELS: Record<string, string> = {
  EXTRACTION: "Resume Extraction",
  RANKING: "Candidate Ranking",
  ADVANCED_JUDGMENT: "Advanced Judgment",
  JD_ANALYSIS: "JD Analysis",
  AI_INTERVIEW_SCORE: "Interview Scoring",
  CODING_GEN: "Coding Questions",
};

const fmt = (n: number) => `$${n.toFixed(4)}`;
const fmtUsd = (n: number) => `$${n.toFixed(2)}`;
const fmtK = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : n.toString();

export function FinanceClient({ summary, costByProvider, costByTask, costByOrg, recentLogs, manualEntries }: FinanceProps) {
  const [showManualForm, setShowManualForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("TAVUS_VIDEO");
  const [isPending, startTransition] = useTransition();

  const totalProviderCost = costByProvider.reduce((s, p) => s + p.cost, 0);

  return (
    <div className="space-y-6">
      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: "Today", value: fmtUsd(summary.today), icon: <Clock className="w-4 h-4 text-blue-400" />, accent: "" },
          { label: "This Week", value: fmtUsd(summary.week), icon: <TrendingUp className="w-4 h-4 text-emerald-400" />, accent: "" },
          { label: "This Month", value: fmtUsd(summary.month), icon: <DollarSign className="w-4 h-4 text-rose-400" />, accent: "border-rose-500/20 bg-rose-900/10" },
          { label: "All Time", value: fmtUsd(summary.allTime), icon: <Zap className="w-4 h-4 text-amber-400" />, accent: "" },
          { label: "Total Tokens", value: fmtK(summary.totalTokens), icon: <Cpu className="w-4 h-4 text-violet-400" />, accent: "" },
          { label: "API Calls", value: formatNumber(summary.totalCalls), icon: <ArrowUpRight className="w-4 h-4 text-cyan-400" />, accent: "" },
        ].map((kpi) => (
          <div key={kpi.label} className={`bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 ${kpi.accent}`}>
            <div className="flex items-center gap-2 mb-1">
              {kpi.icon}
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">{kpi.label}</span>
            </div>
            <div className="text-2xl font-black text-white">{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* ── Forecasting Banner ── */}
      <div className={`rounded-xl border p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
        summary.monthOverMonth > 20
          ? "border-amber-500/20 bg-amber-900/10"
          : "border-emerald-500/20 bg-emerald-900/10"
      }`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            summary.monthOverMonth > 20
              ? "bg-amber-500/20"
              : "bg-emerald-500/20"
          }`}>
            {summary.monthOverMonth > 0 ? (
              <TrendingUp className={`w-6 h-6 ${summary.monthOverMonth > 20 ? "text-amber-400" : "text-emerald-400"}`} />
            ) : (
              <TrendingDown className="w-6 h-6 text-emerald-400" />
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-white">Monthly Forecast</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Based on {fmtUsd(summary.dailyAvg)}/day trailing average
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Projected This Month</p>
            <p className="text-xl font-black text-white">{fmtUsd(summary.projectedMonthly)}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">vs Last Month</p>
            <p className={`text-xl font-black flex items-center gap-1 ${
              summary.monthOverMonth > 0 ? "text-amber-400" : "text-emerald-400"
            }`}>
              {summary.monthOverMonth > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
              {Math.abs(summary.monthOverMonth).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Last Month</p>
            <p className="text-lg font-bold text-zinc-400">{fmtUsd(summary.prevMonthCost)}</p>
          </div>
        </div>
      </div>

      {/* ── Provider + Task Breakdown (side by side) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provider Breakdown */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800">
            <h2 className="text-base font-bold text-white">Cost by AI Provider</h2>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {costByProvider.length === 0 ? (
              <div className="p-8 text-center text-zinc-600 text-sm">No API calls yet.</div>
            ) : (
              costByProvider.sort((a, b) => b.cost - a.cost).map((p) => {
                const pct = totalProviderCost > 0 ? (p.cost / totalProviderCost) * 100 : 0;
                const colors = PROVIDER_COLORS[p.provider] || PROVIDER_COLORS.GEMINI;
                return (
                  <div key={p.provider} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                        <span className={`text-sm font-bold ${colors.text}`}>{p.provider}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-xs text-zinc-500">{fmtK(p.tokens)} tokens</span>
                        <span className="text-xs text-zinc-400">{p.calls} calls</span>
                        <span className="text-sm font-bold text-white">{fmtUsd(p.cost)}</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${colors.dot} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Task Type Breakdown */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-zinc-800">
            <h2 className="text-base font-bold text-white">Cost by Task Type</h2>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {costByTask.length === 0 ? (
              <div className="p-8 text-center text-zinc-600 text-sm">No API calls yet.</div>
            ) : (
              costByTask.sort((a, b) => b.cost - a.cost).map((t) => {
                const totalTaskCost = costByTask.reduce((s, x) => s + x.cost, 0);
                const pct = totalTaskCost > 0 ? (t.cost / totalTaskCost) * 100 : 0;
                return (
                  <div key={t.taskType} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{TASK_LABELS[t.taskType] || t.taskType}</p>
                      <p className="text-[10px] text-zinc-600">{t.calls} calls · {fmtK(t.tokens)} tokens</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-sm font-bold text-white w-16 text-right">{fmtUsd(t.cost)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Per-Client Cost Breakdown ── */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <Building2 className="w-5 h-5 text-violet-400" />
            <div>
              <h2 className="text-base font-bold text-white">Per-Client Cost Breakdown</h2>
              <p className="text-xs text-zinc-500 mt-0.5">{costByOrg.length} clients with AI usage</p>
            </div>
          </div>
        </div>

        {costByOrg.length === 0 ? (
          <div className="p-8 text-center text-zinc-600 text-sm">No per-org cost data available yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-5 py-3 font-semibold">Organization</th>
                  <th className="px-4 py-3 font-semibold text-right">Total Cost</th>
                  <th className="px-4 py-3 font-semibold text-right">Tokens</th>
                  <th className="px-4 py-3 font-semibold text-right">API Calls</th>
                  <th className="px-4 py-3 font-semibold text-right">Cost/Call</th>
                  <th className="px-4 py-3 font-semibold">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                {costByOrg.map((org) => {
                  const pct = summary.allTime > 0 ? (org.cost / summary.allTime) * 100 : 0;
                  const costPerCall = org.calls > 0 ? org.cost / org.calls : 0;
                  return (
                    <tr key={org.orgId} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-white">{org.orgName}</p>
                        <p className="text-[10px] text-zinc-600 font-mono">{org.orgId.slice(0, 20)}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-rose-400">{fmtUsd(org.cost)}</td>
                      <td className="px-4 py-3 text-right">{fmtK(org.tokens)}</td>
                      <td className="px-4 py-3 text-right">{formatNumber(org.calls)}</td>
                      <td className="px-4 py-3 text-right text-zinc-500">{fmt(costPerCall)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="text-xs text-zinc-500">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recent API Calls ── */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800">
          <h2 className="text-base font-bold text-white">Recent API Calls</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Provider</th>
                <th className="px-4 py-2.5 font-semibold">Model</th>
                <th className="px-4 py-2.5 font-semibold">Task</th>
                <th className="px-4 py-2.5 font-semibold text-right">Tokens</th>
                <th className="px-4 py-2.5 font-semibold text-right">Cost</th>
                <th className="px-4 py-2.5 font-semibold text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {recentLogs.map((log) => {
                const colors = PROVIDER_COLORS[log.provider] || PROVIDER_COLORS.GEMINI;
                return (
                  <tr key={log.id} className="hover:bg-zinc-800/20 transition-colors">
                    <td className="px-5 py-2.5">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${colors.bg} ${colors.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                        {log.provider}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-zinc-500">{log.model}</td>
                    <td className="px-4 py-2.5 text-zinc-400">{TASK_LABELS[log.taskType] || log.taskType}</td>
                    <td className="px-4 py-2.5 text-right">{formatNumber(log.totalTokens)}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-rose-400">{fmt(log.estimatedCost)}</td>
                    <td className="px-4 py-2.5 text-right text-zinc-600">
                      {formatTime(new Date(log.createdAt), { showTimezone: false })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Manual Cost Entries ── */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Manual Cost Entries</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Non-API costs (Tavus, R2, Clerk, etc.)</p>
          </div>
        </div>

        {/* Predefined Services Grid */}
        <div className="p-5 border-b border-zinc-800/50">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">Quick Add Service Cost</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {[
              { id: "VERCEL", name: "Vercel", icon: Globe },
              { id: "CLERK", name: "Clerk", icon: UserCircle },
              { id: "TAVUS_VIDEO", name: "Tavus", icon: Video },
              { id: "LIVEKIT", name: "LiveKit", icon: Radio },
              { id: "CLOUDFLARE_R2", name: "Cloudflare", icon: Cloud },
              { id: "ASSEMBLYAI", name: "AssemblyAI", icon: Mic },
              { id: "SENDGRID", name: "SendGrid", icon: Mail },
              { id: "OTHER", name: "Other", icon: Plus }
            ].map(svc => (
              <button
                key={svc.id}
                onClick={() => {
                  setSelectedCategory(svc.id);
                  setShowManualForm(true);
                }}
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 hover:border-zinc-700 transition-colors text-center"
              >
                <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <svc.icon className="w-4 h-4" />
                </div>
                <span className="text-xs font-medium text-zinc-300">{svc.name}</span>
              </button>
            ))}
          </div>
        </div>

        {showManualForm && <ManualCostForm initialCategory={selectedCategory} onClose={() => setShowManualForm(false)} />}

        {manualEntries.length === 0 ? (
          <div className="p-8 text-center text-zinc-600 text-sm">No manual entries yet.</div>
        ) : (
          <div className="divide-y divide-zinc-800/60">
            {manualEntries.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded mr-2">
                    {e.category}
                  </span>
                  <span className="text-sm text-zinc-300">{e.description}</span>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="text-xs text-zinc-500">
                    {formatDate(new Date(e.periodStart))} – {formatDate(new Date(e.periodEnd))}
                  </span>
                  <span className="text-sm font-bold text-amber-400">{fmtUsd(e.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Manual Cost Entry Form ──────────────────────────────────────────────────

function ManualCostForm({ initialCategory, onClose }: { initialCategory: string, onClose: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    category: initialCategory,
    amount: "",
    description: "",
    periodStart: new Date().toISOString().slice(0, 10),
    periodEnd: new Date().toISOString().slice(0, 10),
  });

  const CATEGORIES = [
    "TAVUS_VIDEO", "CLOUDFLARE_R2", "ASSEMBLYAI", "LIVEKIT", "PISTON", "CLERK", "VERCEL", "SENDGRID", "OTHER",
  ];

  const handleSubmit = () => {
    startTransition(async () => {
      await createManualCostEntry({
        category: form.category,
        amount: parseFloat(form.amount),
        description: form.description,
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
      });
      onClose();
    });
  };

  return (
    <div className="p-5 border-b border-zinc-800 bg-zinc-900/80 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">Category</label>
          <select
            value={form.category}
            onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-sm text-white outline-none"
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">Amount (USD)</label>
          <input
            type="number"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-sm text-white outline-none"
            placeholder="12.50"
          />
        </div>
        <div>
          <label className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">Period Start</label>
          <input
            type="date"
            value={form.periodStart}
            onChange={(e) => setForm((p) => ({ ...p, periodStart: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-sm text-white outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] text-zinc-500 mb-1 uppercase tracking-wider">Period End</label>
          <input
            type="date"
            value={form.periodEnd}
            onChange={(e) => setForm((p) => ({ ...p, periodEnd: e.target.value }))}
            className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-sm text-white outline-none"
          />
        </div>
      </div>
      <input
        type="text"
        value={form.description}
        onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-sm text-white outline-none"
        placeholder="Description — e.g., Tavus video minutes May 2026"
      />
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-xs hover:bg-zinc-800">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isPending || !form.amount || !form.description}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-500 disabled:opacity-40"
        >
          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
          Save Entry
        </button>
      </div>
    </div>
  );
}
