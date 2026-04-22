"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Building2, Mail, CheckCircle2, XCircle, Loader2, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { dispatchToVendorByEmail, revokeVendorAction } from "./actions";

type DispatchedVendor = {
  id: string;
  vendorOrgId: string;
  vendorOrgName: string;
  vendorDomain: string | null;
  status: string;
  resumeCount: number;
  dispatchedAt: Date;
};

export function DispatchVendorsModal({
  positionId,
  positionTitle,
  dispatches,
}: {
  positionId: string;
  positionTitle: string;
  dispatches: DispatchedVendor[];
}) {
  const [open, setOpen] = useState(false);
  const [vendorEmail, setVendorEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleDispatch = async () => {
    if (!vendorEmail.trim()) return;
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await dispatchToVendorByEmail(positionId, vendorEmail.trim());
      if (!result.success) throw new Error(result.error);
      setSuccessMessage(
        result.wasAutoProvisioned
          ? `✨ Created vendor org "${result.vendorOrgName}" and dispatched position.`
          : `✅ Dispatched to "${result.vendorOrgName}".`
      );
      setVendorEmail("");
    } catch (err: any) {
      setError(err.message || "Failed to dispatch.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async (vendorOrgId: string) => {
    setRevokingId(vendorOrgId);
    setError(null);
    try {
      const result = await revokeVendorAction(positionId, vendorOrgId);
      if (!result.success) throw new Error(result.error);
    } catch (err: any) {
      setError(err.message || "Failed to revoke.");
    } finally {
      setRevokingId(null);
    }
  };

  const activeDispatches = dispatches.filter(d => d.status === "ACTIVE");
  const revokedDispatches = dispatches.filter(d => d.status === "REVOKED");

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(null); setSuccessMessage(null); }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl hover:-translate-y-0.5 transition-transform text-sm text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 dark:bg-indigo-900/40 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-900/60"
        >
          <Building2 className="w-4 h-4 mr-1.5" />
          Dispatch to Vendors {activeDispatches.length > 0 && `(${activeDispatches.length})`}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-500" />
            Dispatch to Vendor Agency
          </DialogTitle>
          <DialogDescription className="pt-2 text-zinc-500 dark:text-zinc-400">
            Enter a vendor agency email to dispatch <strong>{positionTitle}</strong>. If the agency isn&apos;t on IQMela yet, we&apos;ll auto-create their account.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-4">
          {/* Error/Success Messages */}
          {error && (
            <div className="p-3 text-sm bg-red-50 text-red-600 rounded-xl dark:bg-red-950/40 dark:text-red-400 border border-red-100 dark:border-red-900/50 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
          {successMessage && (
            <div className="p-3 text-sm bg-emerald-50 text-emerald-700 rounded-xl dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              {successMessage}
            </div>
          )}

          {/* Email Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                placeholder="vendor@agency.com"
                value={vendorEmail}
                onChange={(e) => setVendorEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDispatch()}
                disabled={isSubmitting}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:opacity-50 transition-all"
              />
            </div>
            <Button
              className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 shrink-0"
              disabled={!vendorEmail.trim() || isSubmitting}
              onClick={handleDispatch}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1.5" />
                  Dispatch
                </>
              )}
            </Button>
          </div>

          {/* Active Dispatches */}
          {activeDispatches.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-500">
                Active Vendor Agencies ({activeDispatches.length})
              </h4>
              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {activeDispatches.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 px-3 py-2.5 bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-xl"
                  >
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 flex items-center justify-center font-bold text-sm">
                      {d.vendorOrgName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {d.vendorOrgName}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
                        {d.vendorDomain && <span>{d.vendorDomain}</span>}
                        <span>·</span>
                        <span>{d.resumeCount} resume{d.resumeCount !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevoke(d.vendorOrgId)}
                      disabled={revokingId === d.vendorOrgId}
                      className="text-xs font-medium text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors disabled:opacity-50 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      {revokingId === d.vendorOrgId ? "Revoking..." : "Revoke"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revoked Dispatches */}
          {revokedDispatches.length > 0 && (
            <div className="space-y-2 pt-1">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-600">
                Revoked ({revokedDispatches.length})
              </h4>
              <div className="space-y-1.5">
                {revokedDispatches.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 px-3 py-2 bg-gray-50/50 dark:bg-zinc-900/20 border border-gray-100 dark:border-zinc-800/50 rounded-xl opacity-60"
                  >
                    <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-400 flex items-center justify-center font-bold text-xs">
                      {d.vendorOrgName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-500 dark:text-zinc-500 truncate">
                        {d.vendorOrgName}
                      </p>
                    </div>
                    <XCircle className="w-4 h-4 text-gray-300 dark:text-zinc-600" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
