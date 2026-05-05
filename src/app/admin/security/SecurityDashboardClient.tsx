"use client";

import { useState, useEffect, useTransition } from "react";
import { fetchActiveBlocks, fetchBlockHistory, createManualBlock, removeBlock } from "./actions";
import { Shield, ShieldAlert, ShieldCheck, Lock, Unlock, Plus, Clock, AlertTriangle, Ban, Globe } from "lucide-react";

type Block = {
  id: string;
  targetType: string;
  targetValue: string;
  reason: string;
  severity: string;
  isActive: boolean;
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
};

export default function SecurityDashboardClient() {
  const [activeBlocks, setActiveBlocks] = useState<Block[]>([]);
  const [history, setHistory] = useState<Block[]>([]);
  const [tab, setTab] = useState<"active" | "history">("active");
  const [showAddForm, setShowAddForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = () => {
    startTransition(async () => {
      const [active, hist] = await Promise.all([
        fetchActiveBlocks(),
        fetchBlockHistory(),
      ]);
      setActiveBlocks(active);
      setHistory(hist);
    });
  };

  useEffect(() => { refresh(); }, []);

  const handleUnblock = (blockId: string) => {
    startTransition(async () => {
      const result = await removeBlock(blockId);
      if ("error" in result) {
        setError(result.error ?? "Failed to unblock");
      } else {
        setSuccess("Successfully unblocked!");
        setTimeout(() => setSuccess(null), 3000);
        refresh();
      }
    });
  };

  const handleAddBlock = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createManualBlock(formData);
      if ("error" in result) {
        setError(result.error ?? "Failed to create block");
      } else {
        setSuccess("Block created successfully!");
        setShowAddForm(false);
        setTimeout(() => setSuccess(null), 3000);
        refresh();
      }
    });
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  const timeUntil = (expiresAt: string | null) => {
    if (!expiresAt) return "Permanent";
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return "Expired";
    const mins = Math.floor(ms / 60_000);
    if (mins < 60) return `${mins}m remaining`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m remaining`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
            <Shield className="w-7 h-7 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Security & Blocks</h1>
            <p className="text-sm text-zinc-500">Manage IP blocks, view threat history, and enforce access policies</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            disabled={isPending}
            className="px-4 py-2 text-sm font-bold bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-300 hover:bg-zinc-700 transition-all disabled:opacity-50"
          >
            {isPending ? "Refreshing..." : "Refresh"}
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Block IP / User
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-400">✕</button>
        </div>
      )}
      {success && (
        <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> {success}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
          <div className="text-3xl font-black text-white">{activeBlocks.length}</div>
          <div className="text-xs text-zinc-500 font-medium mt-1">Active Blocks</div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
          <div className="text-3xl font-black text-amber-400">{activeBlocks.filter(b => b.severity === "auto").length}</div>
          <div className="text-xs text-zinc-500 font-medium mt-1">Auto-Bans</div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
          <div className="text-3xl font-black text-rose-400">{activeBlocks.filter(b => b.severity === "manual").length}</div>
          <div className="text-xs text-zinc-500 font-medium mt-1">Manual Blocks</div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
          <div className="text-3xl font-black text-zinc-400">{history.filter(b => !b.isActive).length}</div>
          <div className="text-xs text-zinc-500 font-medium mt-1">Resolved</div>
        </div>
      </div>

      {/* Add Block Form */}
      {showAddForm && (
        <div className="bg-zinc-900/80 border border-amber-500/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Ban className="w-5 h-5 text-amber-400" /> New Block
            </h3>
            <button onClick={() => setShowAddForm(false)} className="text-zinc-500 hover:text-white text-xl">✕</button>
          </div>
          <form onSubmit={handleAddBlock} className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-zinc-400 block mb-1">Target Type</label>
              <select name="targetType" required className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm">
                <option value="IP">IP Address</option>
                <option value="USER">User ID</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 block mb-1">Target Value</label>
              <input name="targetValue" required placeholder="e.g. 192.168.1.100 or user_2abc..." className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm placeholder-zinc-600" />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 block mb-1">Reason</label>
              <input name="reason" required placeholder="Suspicious activity..." className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm placeholder-zinc-600" />
            </div>
            <div>
              <label className="text-xs font-bold text-zinc-400 block mb-1">Duration (hours, 0 = permanent)</label>
              <input name="durationHours" type="number" defaultValue={24} min={0} className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2 flex justify-end gap-3">
              <button type="button" onClick={() => setShowAddForm(false)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition">
                Cancel
              </button>
              <button type="submit" disabled={isPending} className="px-6 py-2 text-sm font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all disabled:opacity-50">
                {isPending ? "Blocking..." : "Block Now"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-1">
        <button
          onClick={() => setTab("active")}
          className={`px-4 py-2 text-sm font-bold rounded-t-lg transition ${tab === "active" ? "bg-amber-500/10 text-amber-400 border-b-2 border-amber-400" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          <ShieldAlert className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Active Blocks ({activeBlocks.length})
        </button>
        <button
          onClick={() => setTab("history")}
          className={`px-4 py-2 text-sm font-bold rounded-t-lg transition ${tab === "history" ? "bg-zinc-700/30 text-white border-b-2 border-zinc-400" : "text-zinc-500 hover:text-zinc-300"}`}
        >
          <Clock className="w-4 h-4 inline mr-1.5 -mt-0.5" />
          Full History ({history.length})
        </button>
      </div>

      {/* Block List */}
      <div className="space-y-3">
        {(tab === "active" ? activeBlocks : history).length === 0 ? (
          <div className="text-center py-16 text-zinc-600">
            <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="font-medium">
              {tab === "active" ? "No active blocks — all clear!" : "No block history yet."}
            </p>
          </div>
        ) : (
          (tab === "active" ? activeBlocks : history).map((block) => (
            <div
              key={block.id}
              className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                block.isActive && !isExpired(block.expiresAt)
                  ? "bg-red-500/5 border-red-500/20"
                  : "bg-zinc-900/40 border-zinc-800 opacity-60"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-xl ${block.targetType === "IP" ? "bg-amber-500/10" : "bg-purple-500/10"}`}>
                  {block.targetType === "IP" ? (
                    <Globe className="w-5 h-5 text-amber-400" />
                  ) : (
                    <Lock className="w-5 h-5 text-purple-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white font-mono text-sm">{block.targetValue}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      block.severity === "auto"
                        ? "bg-amber-500/20 text-amber-400"
                        : block.severity === "critical"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-zinc-700 text-zinc-400"
                    }`}>
                      {block.severity.toUpperCase()}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      block.isActive && !isExpired(block.expiresAt)
                        ? "bg-red-500/20 text-red-400"
                        : "bg-zinc-700 text-zinc-500"
                    }`}>
                      {block.isActive && !isExpired(block.expiresAt) ? "ACTIVE" : "RESOLVED"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{block.reason}</p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-[10px] text-zinc-600">Created: {formatDate(block.createdAt)}</span>
                    <span className="text-[10px] text-zinc-600">By: {block.createdBy}</span>
                    <span className="text-[10px] text-zinc-600">
                      {timeUntil(block.expiresAt)}
                    </span>
                  </div>
                </div>
              </div>

              {block.isActive && !isExpired(block.expiresAt) && (
                <button
                  onClick={() => handleUnblock(block.id)}
                  disabled={isPending}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 rounded-xl transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Unlock className="w-3.5 h-3.5" /> Unblock
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
