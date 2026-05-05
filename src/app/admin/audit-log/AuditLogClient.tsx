"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import {
  ScrollText, Search, Filter, Download, RefreshCw,
  ChevronLeft, ChevronRight, Clock, User, Building2,
  Zap, FileText, Shield, Bot, Calendar, X, Loader2,
  TrendingUp, Activity, Hash,
} from "lucide-react";
import {
  fetchAuditLogs,
  fetchAuditStats,
  fetchAuditFilterOptions,
  exportAuditLogsCsv,
} from "./actions";

// ── Types ──────────────────────────────────────────────────────────────────

type AuditEntry = {
  id: string;
  organizationId: string | null;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, any> | null;
  createdAt: string;
};

type AuditStats = {
  total: number;
  last24h: number;
  last7d: number;
  actionBreakdown: { action: string; count: number }[];
};

// ── Action color mapping ───────────────────────────────────────────────────

const ACTION_STYLES: Record<string, { bg: string; text: string; icon: any }> = {
  CREATED:   { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: Zap },
  UPDATED:   { bg: "bg-blue-500/10", text: "text-blue-400", icon: RefreshCw },
  DELETED:   { bg: "bg-red-500/10", text: "text-red-400", icon: X },
  INVITED:   { bg: "bg-violet-500/10", text: "text-violet-400", icon: User },
  STARTED:   { bg: "bg-amber-500/10", text: "text-amber-400", icon: Activity },
  COMPLETED: { bg: "bg-sky-500/10", text: "text-sky-400", icon: FileText },
  EVALUATED: { bg: "bg-rose-500/10", text: "text-rose-400", icon: Bot },
};

const RESOURCE_STYLES: Record<string, { bg: string; text: string; icon: any }> = {
  POSITION:    { bg: "bg-indigo-500/10", text: "text-indigo-400", icon: FileText },
  RESUME:      { bg: "bg-teal-500/10", text: "text-teal-400", icon: User },
  INVITE:      { bg: "bg-violet-500/10", text: "text-violet-400", icon: Zap },
  AI_SESSION:  { bg: "bg-rose-500/10", text: "text-rose-400", icon: Bot },
  DEPARTMENT:  { bg: "bg-amber-500/10", text: "text-amber-400", icon: Building2 },
  SETTINGS:    { bg: "bg-zinc-500/10", text: "text-zinc-400", icon: Shield },
};

function getActionStyle(action: string) {
  return ACTION_STYLES[action] ?? { bg: "bg-zinc-500/10", text: "text-zinc-400", icon: Hash };
}

function getResourceStyle(rt: string) {
  return RESOURCE_STYLES[rt] ?? { bg: "bg-zinc-500/10", text: "text-zinc-400", icon: Hash };
}

// ── Stats Banner ───────────────────────────────────────────────────────────

function StatsBanner({ stats }: { stats: AuditStats | null }) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 animate-pulse">
            <div className="h-8 w-16 bg-zinc-800 rounded mb-2" />
            <div className="h-3 w-24 bg-zinc-800 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const cards = [
    {
      label: "Total Events",
      value: stats.total.toLocaleString(),
      icon: ScrollText,
      color: "text-white",
      gradient: "from-zinc-800/50 to-zinc-900",
      border: "border-zinc-700/50",
    },
    {
      label: "Last 24 Hours",
      value: stats.last24h.toLocaleString(),
      icon: Clock,
      color: "text-emerald-400",
      gradient: "from-emerald-900/20 to-zinc-900",
      border: "border-emerald-500/20",
    },
    {
      label: "Last 7 Days",
      value: stats.last7d.toLocaleString(),
      icon: TrendingUp,
      color: "text-blue-400",
      gradient: "from-blue-900/20 to-zinc-900",
      border: "border-blue-500/20",
    },
    {
      label: "Action Types",
      value: stats.actionBreakdown.length.toString(),
      icon: Activity,
      color: "text-amber-400",
      gradient: "from-amber-900/20 to-zinc-900",
      border: "border-amber-500/20",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className={`bg-gradient-to-br ${card.gradient} border ${card.border} rounded-2xl p-5 transition-all hover:scale-[1.02]`}
          >
            <div className="flex items-center justify-between mb-2">
              <Icon className={`w-5 h-5 ${card.color} opacity-60`} />
            </div>
            <div className={`text-3xl font-black ${card.color} tracking-tight`}>{card.value}</div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold mt-1">{card.label}</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Filter Bar ─────────────────────────────────────────────────────────────

function FilterBar({
  actions,
  resourceTypes,
  filters,
  setFilters,
  onSearch,
  onExport,
  isExporting,
}: {
  actions: string[];
  resourceTypes: string[];
  filters: {
    action: string;
    resourceType: string;
    search: string;
    startDate: string;
    endDate: string;
  };
  setFilters: (f: any) => void;
  onSearch: () => void;
  onExport: () => void;
  isExporting: boolean;
}) {
  const hasActiveFilters = filters.action || filters.resourceType || filters.search || filters.startDate || filters.endDate;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-3">
      {/* Top row: search + export */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by user ID, resource ID..."
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && onSearch()}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSearch}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl transition-colors"
          >
            <Filter className="w-3.5 h-3.5" /> Apply
          </button>
          <button
            onClick={onExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export CSV
          </button>
        </div>
      </div>

      {/* Bottom row: dropdowns + date */}
      <div className="flex flex-wrap gap-3">
        <select
          value={filters.action}
          onChange={(e) => setFilters({ ...filters, action: e.target.value })}
          className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-zinc-600 min-w-[140px]"
        >
          <option value="">All Actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={filters.resourceType}
          onChange={(e) => setFilters({ ...filters, resourceType: e.target.value })}
          className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-zinc-600 min-w-[140px]"
        >
          <option value="">All Resources</option>
          {resourceTypes.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-zinc-600"
          />
          <span className="text-zinc-600 text-xs">→</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white font-medium focus:outline-none focus:border-zinc-600"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={() => {
              setFilters({ action: "", resourceType: "", search: "", startDate: "", endDate: "" });
              setTimeout(onSearch, 0);
            }}
            className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>
    </div>
  );
}

// ── Metadata Drawer ────────────────────────────────────────────────────────

function MetadataDrawer({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);

  if (!entry.metadata || Object.keys(entry.metadata).length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] font-bold text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors"
      >
        {expanded ? "▾" : "▸"} Metadata ({Object.keys(entry.metadata).length} fields)
      </button>
      {expanded && (
        <pre className="mt-1.5 p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-[11px] text-zinc-400 font-mono overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
          {JSON.stringify(entry.metadata, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ── Audit Timeline Row ─────────────────────────────────────────────────────

function AuditRow({ entry }: { entry: AuditEntry }) {
  const actionStyle = getActionStyle(entry.action);
  const resourceStyle = getResourceStyle(entry.resourceType);
  const ActionIcon = actionStyle.icon;
  const ResourceIcon = resourceStyle.icon;

  return (
    <div className="group px-5 py-4 border-b border-zinc-800/30 hover:bg-zinc-900/40 transition-colors">
      <div className="flex items-start gap-4">
        {/* Timeline dot */}
        <div className="shrink-0 mt-1">
          <div className={`w-8 h-8 rounded-lg ${actionStyle.bg} flex items-center justify-center`}>
            <ActionIcon className={`w-4 h-4 ${actionStyle.text}`} />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Action badge */}
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${actionStyle.bg} ${actionStyle.text} uppercase tracking-wider`}>
              {entry.action}
            </span>

            {/* Resource badge */}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${resourceStyle.bg} ${resourceStyle.text} uppercase tracking-wider flex items-center gap-1`}>
              <ResourceIcon className="w-3 h-3" />
              {entry.resourceType}
            </span>

            {/* Timestamp */}
            <span className="text-[10px] text-zinc-600 font-mono ml-auto shrink-0">
              {new Date(entry.createdAt).toLocaleString()}
            </span>
          </div>

          {/* IDs */}
          <div className="flex items-center gap-4 mt-2 text-[11px]">
            <div className="flex items-center gap-1.5 text-zinc-500">
              <User className="w-3 h-3" />
              <span className="font-mono truncate max-w-[200px]">{entry.userId}</span>
            </div>
            {entry.organizationId && (
              <div className="flex items-center gap-1.5 text-zinc-500">
                <Building2 className="w-3 h-3" />
                <span className="font-mono truncate max-w-[200px]">{entry.organizationId}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-zinc-500">
              <Hash className="w-3 h-3" />
              <span className="font-mono truncate max-w-[200px]">{entry.resourceId}</span>
            </div>
          </div>

          {/* Metadata */}
          <MetadataDrawer entry={entry} />
        </div>
      </div>
    </div>
  );
}

// ── Pagination ─────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 bg-zinc-950/50">
      <p className="text-xs text-zinc-500">
        Page <span className="font-bold text-zinc-300">{page}</span> of{" "}
        <span className="font-bold text-zinc-300">{totalPages}</span>
        <span className="text-zinc-700 ml-2">({total.toLocaleString()} total events)</span>
      </p>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Page numbers */}
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const start = Math.max(1, Math.min(page - 2, totalPages - 4));
          const p = start + i;
          if (p > totalPages) return null;
          return (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                p === page
                  ? "bg-rose-600 text-white"
                  : "hover:bg-zinc-800 text-zinc-500 hover:text-white"
              }`}
            >
              {p}
            </button>
          );
        })}

        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function AuditLogClient() {
  const [isPending, startTransition] = useTransition();
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterOptions, setFilterOptions] = useState<{ actions: string[]; resourceTypes: string[] }>({ actions: [], resourceTypes: [] });
  const [isExporting, setIsExporting] = useState(false);

  const [filters, setFilters] = useState({
    action: "",
    resourceType: "",
    search: "",
    startDate: "",
    endDate: "",
  });

  const loadData = useCallback(
    (pageNum: number = 1) => {
      startTransition(async () => {
        try {
          const [logResult, statsResult, optionsResult] = await Promise.all([
            fetchAuditLogs({
              page: pageNum,
              limit: 50,
              action: filters.action || undefined,
              resourceType: filters.resourceType || undefined,
              userId: filters.search || undefined,
              startDate: filters.startDate || undefined,
              endDate: filters.endDate || undefined,
            }),
            fetchAuditStats(),
            fetchAuditFilterOptions(),
          ]);

          setLogs(logResult.logs);
          setPage(logResult.page);
          setTotalPages(logResult.totalPages);
          setTotal(logResult.total);
          setStats(statsResult);
          setFilterOptions(optionsResult);
        } catch (err) {
          console.error("[AuditLog] Failed to load:", err);
        }
      });
    },
    [filters]
  );

  useEffect(() => {
    loadData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const csv = await exportAuditLogsCsv({
        action: filters.action || undefined,
        resourceType: filters.resourceType || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      });

      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `iqmela-audit-log-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[AuditLog] Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="p-6 lg:p-10 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-600/20">
              <ScrollText className="w-5 h-5 text-white" />
            </div>
            Audit Trail
          </h1>
          <p className="text-xs text-zinc-500 mt-1 ml-[52px]">
            Immutable record of all platform events — compliance ready
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <Activity className="w-3.5 h-3.5" />
          {isPending ? "Loading..." : `${total.toLocaleString()} events`}
          <button
            onClick={() => loadData(page)}
            disabled={isPending}
            className="flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50 ml-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPending ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats Banner */}
      <StatsBanner stats={stats} />

      {/* Filter Bar */}
      <FilterBar
        actions={filterOptions.actions}
        resourceTypes={filterOptions.resourceTypes}
        filters={filters}
        setFilters={setFilters}
        onSearch={() => loadData(1)}
        onExport={handleExport}
        isExporting={isExporting}
      />

      {/* Log Timeline */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-zinc-800">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-zinc-400" /> Event Timeline
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Showing {logs.length} of {total.toLocaleString()} events
          </p>
        </div>

        {isPending && logs.length === 0 ? (
          <div className="p-12 text-center">
            <Loader2 className="w-6 h-6 text-zinc-600 animate-spin mx-auto mb-3" />
            <p className="text-xs text-zinc-500">Loading audit trail...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <ScrollText className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
            <p className="text-sm text-zinc-500 font-bold">No events found</p>
            <p className="text-xs text-zinc-600 mt-1">Try adjusting your filters or date range</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-zinc-800/30">
              {logs.map((entry) => (
                <AuditRow key={entry.id} entry={entry} />
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              onPageChange={(p) => loadData(p)}
            />
          </>
        )}
      </div>
    </div>
  );
}
