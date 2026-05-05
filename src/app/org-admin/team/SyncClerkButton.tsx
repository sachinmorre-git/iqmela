"use client";

import { useState } from "react";
import { forceSyncClerkLocalDb } from "./sync-action";
import { RefreshCcw, Check, AlertCircle } from "lucide-react";

export function SyncClerkButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [count, setCount] = useState(0);

  const handleSync = async () => {
    setLoading(true);
    setStatus("idle");
    try {
       const result = await forceSyncClerkLocalDb();
       if (result.success) {
          setStatus("success");
          setCount(result.count || 0);
          setTimeout(() => setStatus("idle"), 3000);
       } else {
          setStatus("error");
       }
    } catch(e) {
       setStatus("error");
    }
    setLoading(false);
  };

  return (
    <button 
      onClick={handleSync}
      disabled={loading}
      className={`
        px-3 py-1.5 rounded-md flex items-center gap-2 text-xs font-bold transition-all
        ${status === "success" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : 
          status === "error" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : 
          "bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50"}
      `}
    >
      {loading ? (
        <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
      ) : status === "success" ? (
        <Check className="w-3.5 h-3.5" />
      ) : status === "error" ? (
        <AlertCircle className="w-3.5 h-3.5" />
      ) : (
        <RefreshCcw className="w-3.5 h-3.5" />
      )}
      
      {loading ? "Syncing..." : 
       status === "success" ? `Synced ${count} Users` : 
       status === "error" ? "Sync Failed" : 
       "Force Sync Clerk Tests"}
    </button>
  );
}
