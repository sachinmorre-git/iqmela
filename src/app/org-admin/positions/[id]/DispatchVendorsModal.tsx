"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Send, Building2, Mail, CheckCircle2, XCircle, Loader2, AlertCircle, CheckSquare, Square, Plus, Copy, Link2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { revokeVendorAction, dispatchVendorInvites } from "./actions";
import { addVendorAction } from "../../vendors/actions";

type DispatchedVendor = {
  id: string;
  vendorOrgId: string;
  vendorOrgName: string;
  vendorDomain: string | null;
  status: string;
  resumeCount: number;
  dispatchedAt: Date;
};

type PastVendor = {
  id: string;
  name: string;
  domain: string | null;
  email: string;
  phone: string;
};

export function DispatchVendorsModal({
  positionId,
  positionTitle,
  dispatches,
  pastVendors = [],
}: {
  positionId: string;
  positionTitle: string;
  dispatches: DispatchedVendor[];
  pastVendors?: PastVendor[];
}) {
  const [open, setOpen] = useState(false);
  const [vendorEmail, setVendorEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const dropzoneUrl = `${appUrl}/vendor/positions/${positionId}`;

  const activeDispatches = dispatches.filter(d => d.status === "ACTIVE");
  const revokedDispatches = dispatches.filter(d => d.status === "REVOKED");

  // Keep only vendors that are not currently active
  const availablePastVendors = pastVendors.filter(
    pv => !activeDispatches.some(ad => ad.vendorOrgId === pv.id)
  );

  const [showAddForm, setShowAddForm] = useState(false);
  const [vendorName, setVendorName] = useState("");
  const [vendorPhone, setVendorPhone] = useState("");
  const handleAddNewVendorAndDispatch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!vendorEmail.trim()) return;
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      // 1. Add explicitly to the directory
      const formData = new FormData();
      formData.append("email", vendorEmail.trim());
      formData.append("name", vendorName.trim());
      formData.append("phone", vendorPhone.trim());
      
      const addResult = await addVendorAction(formData);
      if (!addResult.success || !addResult.vendorOrgId) {
        throw new Error(addResult.error || "Failed to add vendor to directory");
      }

      // 2. Automatically dispatch to this new vendor
      const dispatchResult = await dispatchVendorInvites(positionId, [addResult.vendorOrgId]);
      if (!dispatchResult.success) {
        throw new Error("Vendor added to directory, but failed to dispatch: " + dispatchResult.error);
      }

      setSuccessMessage(`✅ Added "${addResult.vendorOrgName}" to directory and dispatched.`);
      setVendorEmail("");
      setVendorName("");
      setVendorPhone("");
      setShowAddForm(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkDispatch = async () => {
    if (selectedVendors.size === 0) return;
    setIsSubmittingBulk(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const result = await dispatchVendorInvites(positionId, Array.from(selectedVendors));
      if (!result.success) throw new Error(result.error);
      setSuccessMessage(`✅ Successfully dispatched to ${selectedVendors.size} vendor(s).`);
      setSelectedVendors(new Set()); // clear selection
    } catch (err: any) {
      setError(err.message || "Failed to dispatch to selected vendors.");
    } finally {
      setIsSubmittingBulk(false);
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

  const toggleVendorSelection = (vendorId: string) => {
    setSelectedVendors(prev => {
      const newSet = new Set(prev);
      if (newSet.has(vendorId)) newSet.delete(vendorId);
      else newSet.add(vendorId);
      return newSet;
    });
  };

  const toggleAllVendors = () => {
    if (selectedVendors.size === availablePastVendors.length) {
      setSelectedVendors(new Set());
    } else {
      setSelectedVendors(new Set(availablePastVendors.map(v => v.id)));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); setError(null); setSuccessMessage(null); }}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl hover:-translate-y-0.5 transition-transform text-sm text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100 hover:border-rose-300 dark:bg-rose-900/40 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-900/60"
        >
          <Building2 className="w-4 h-4 mr-1.5" />
          Dispatch to Vendors {activeDispatches.length > 0 && `(${activeDispatches.length})`}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-rose-500" />
            Dispatch to Vendor Agency
          </DialogTitle>
          <DialogDescription className="pt-2 text-zinc-500 dark:text-zinc-400">
            Dispatch <strong>{positionTitle}</strong> to vendor agencies. Enter a new email, or select from your previous vendors below.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-6">
          {/* Messages */}
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

          {/* Add New Vendor Form */}
          <div className="flex flex-col gap-2 bg-gray-50 dark:bg-zinc-900/50 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-zinc-300">
                Add New Vendor
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddForm(!showAddForm)}
                className="text-xs h-7 rounded-lg text-rose-600 hover:text-rose-700 dark:text-rose-400"
              >
                {showAddForm ? "Cancel" : "+ Open Vendor Form"}
              </Button>
            </div>
            
            {showAddForm && (
              <form onSubmit={handleAddNewVendorAndDispatch} className="space-y-3 mt-2 animate-in fade-in slide-in-from-top-2">
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    placeholder="Agency Email (Required)"
                    value={vendorEmail}
                    onChange={(e) => setVendorEmail(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full pl-10 pr-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Contact Name (Optional)"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <input
                    type="text"
                    placeholder="Phone (Optional)"
                    value={vendorPhone}
                    onChange={(e) => setVendorPhone(e.target.value)}
                    disabled={isSubmitting}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full rounded-xl bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                  disabled={!vendorEmail.trim() || isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-1.5" />
                      Add & Dispatch
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>

          {/* Saved Vendors Directory */}
          {availablePastVendors.length > 0 && (
            <div className="flex flex-col gap-2">
               <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                 Saved Vendors Directory
               </h4>
               <div className="border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm max-h-[250px] overflow-y-auto">
                 <table className="w-full text-left text-sm text-gray-700 dark:text-gray-300">
                   <thead className="bg-gray-50 dark:bg-zinc-900/50 text-xs uppercase font-semibold text-gray-500 dark:text-zinc-400 border-b border-gray-200 dark:border-zinc-800 sticky top-0 z-10">
                     <tr>
                       <th className="px-4 py-3 w-10 text-center">
                         <button onClick={toggleAllVendors} className="focus:outline-none flex items-center justify-center">
                           {selectedVendors.size === availablePastVendors.length ? (
                              <CheckSquare className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                           ) : (
                              <Square className="w-4 h-4 text-gray-400" />
                           )}
                         </button>
                       </th>
                       <th className="px-4 py-3">Vendor Name</th>
                       <th className="px-4 py-3">Email</th>
                       <th className="px-4 py-3">Phone</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                     {availablePastVendors.map(vendor => (
                       <tr key={vendor.id} className={`hover:bg-gray-50 dark:hover:bg-zinc-900/20 transition-colors cursor-pointer ${selectedVendors.has(vendor.id) ? 'bg-rose-50/30 dark:bg-rose-900/10' : ''}`} onClick={() => toggleVendorSelection(vendor.id)}>
                         <td className="px-4 py-3 w-10 text-center">
                           {selectedVendors.has(vendor.id) ? (
                              <CheckSquare className="w-4 h-4 text-rose-600 dark:text-rose-400 inline-block" />
                           ) : (
                              <Square className="w-4 h-4 text-gray-300 inline-block" />
                           )}
                         </td>
                         <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                           {vendor.name}
                         </td>
                         <td className="px-4 py-3 text-gray-500 dark:text-zinc-400" title={vendor.email}>
                           {vendor.email}
                         </td>
                         <td className="px-4 py-3 text-gray-500 dark:text-zinc-400">
                           {vendor.phone}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
                
                {/* Bulk Dispatch action */}
               <div className="flex justify-end pt-2">
                 <Button
                   variant="default"
                   className="rounded-xl shadow bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition-all font-semibold"
                   disabled={selectedVendors.size === 0 || isSubmittingBulk}
                   onClick={handleBulkDispatch}
                 >
                   {isSubmittingBulk ? (
                     <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                   ) : (
                     <Send className="w-4 h-4 mr-1.5" />
                   )}
                   Dispatch to Selected ({selectedVendors.size})
                 </Button>
               </div>
            </div>
          )}

          {/* Active Dispatches */}
          {activeDispatches.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-green-600 dark:text-green-500 mt-4">
                Active Vendor Agencies ({activeDispatches.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[240px] overflow-y-auto pr-1">
                {activeDispatches.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 px-3 py-2.5 bg-green-50/50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 rounded-xl"
                  >
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-400 flex items-center justify-center font-bold text-sm shrink-0">
                      {d.vendorOrgName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {d.vendorOrgName}
                      </p>
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-zinc-400">
                        {d.vendorDomain && <span className="truncate max-w-[100px]" title={d.vendorDomain}>{d.vendorDomain}</span>}
                        <span>·</span>
                        <span className="whitespace-nowrap">{d.resumeCount} res</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(dropzoneUrl);
                            setCopiedId(d.vendorOrgId);
                            setTimeout(() => setCopiedId(null), 2000);
                          } catch { /* clipboard API unavailable */ }
                        }}
                        className="text-xs font-medium text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors px-2 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 shrink-0"
                        title="Copy dropzone link to clipboard"
                      >
                        {copiedId === d.vendorOrgId ? (
                          <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Copied</span>
                        ) : (
                          <span className="flex items-center gap-1"><Link2 className="w-3 h-3" /> Link</span>
                        )}
                      </button>
                      <button
                        onClick={() => handleRevoke(d.vendorOrgId)}
                        disabled={revokingId === d.vendorOrgId}
                        className="text-xs font-medium text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors disabled:opacity-50 px-2 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                      >
                        {revokingId === d.vendorOrgId ? "Revoking..." : "Revoke"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revoked Dispatches */}
          {revokedDispatches.length > 0 && (
            <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-zinc-800">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-600 mt-4">
                Revoked Vendors ({revokedDispatches.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {revokedDispatches.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 px-3 py-2 bg-gray-50/50 dark:bg-zinc-900/20 border border-gray-100 dark:border-zinc-800/50 rounded-xl opacity-60"
                  >
                    <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-zinc-800 text-gray-400 flex items-center justify-center font-bold text-xs shrink-0">
                      {d.vendorOrgName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-500 dark:text-zinc-500 truncate">
                        {d.vendorOrgName}
                      </p>
                    </div>
                    <XCircle className="w-4 h-4 text-gray-400 shrink-0" />
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
