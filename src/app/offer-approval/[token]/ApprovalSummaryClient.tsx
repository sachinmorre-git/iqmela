"use client";

import { useState } from "react";
import { formatDate, formatTime, formatDateTime } from "@/lib/locale-utils";
import { Check, X, FileText, Building2, User, HelpCircle, Loader2 } from "lucide-react";
import { submitApprovalStepAction } from "@/app/org-admin/offer-actions";
import { useRouter } from "next/navigation";

interface ApprovalSummaryClientProps {
  approval: any;
  token: string;
}

export function ApprovalSummaryClient({ approval, token }: ApprovalSummaryClientProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [view, setView] = useState<"SUMMARY" | "REJECT">("SUMMARY");

  const isProcessed = approval.status !== "PENDING";
  const offer = approval.offer;
  const candidateName = offer.resume.candidateName ?? "Unknown Candidate";

  const handleAction = async (action: "APPROVE" | "REJECT") => {
    if (action === "REJECT" && view === "SUMMARY") {
      setView("REJECT");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await submitApprovalStepAction(token, action, notes);
      if (res.success) {
        // Just reload the page so the server component rehydrates the status
        router.refresh();
      } else {
        setError(res.error || "Failed to process approval");
      }
    } catch (e) {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isProcessed) {
    return (
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center animate-in fade-in zoom-in duration-300">
        <div className={`w-12 h-12 rounded-full mx-auto flex items-center justify-center mb-4 ${approval.status === "APPROVED" ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
          {approval.status === "APPROVED" ? <Check className="w-6 h-6" /> : <X className="w-6 h-6" />}
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Step Processed</h1>
        <p className="text-gray-500">You have {approval.status.toLowerCase()} this offer for {candidateName}. You may close this tab.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
      
      <div className="bg-rose-600 p-10 text-white relative overflow-hidden">
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="relative z-10">
          <p className="text-rose-200 text-sm font-semibold tracking-wider uppercase mb-2">Offer Approval Required</p>
          <h1 className="text-3xl font-bold mb-2">{candidateName}</h1>
          <p className="text-rose-100 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            {offer.position.title} • {offer.position.department || "No Dept"}
          </p>
        </div>
      </div>

      {view === "SUMMARY" ? (
        <div className="p-8 space-y-8">
          
          {error && (
            <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl font-medium border border-red-100">
              {error}
            </div>
          )}

          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Total Compensation Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Base Salary</p>
                <p className="text-xl font-bold text-gray-900">${offer.baseSalary.toLocaleString()} <span className="text-sm font-normal text-gray-400">{offer.currency}</span></p>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Sign-on Bonus</p>
                <p className="text-xl font-bold text-gray-900">{offer.signOnBonus ? `$${offer.signOnBonus.toLocaleString()}` : "—"}</p>
              </div>
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 col-span-2 md:col-span-1">
                <p className="text-xs text-gray-500 mb-1">Equity</p>
                <p className="text-base font-bold text-gray-900 mt-1">{offer.equityAmount || "—"}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
               <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Key Dates</h3>
               <div className="space-y-2 text-sm text-gray-700">
                 <p><span className="text-gray-400 w-20 inline-block">Start:</span> <strong className="text-gray-900">{formatDate(new Date(offer.startDate))}</strong></p>
                 <p><span className="text-gray-400 w-20 inline-block">Expires:</span> <strong className="text-gray-900">{formatDate(new Date(offer.expirationDate))}</strong></p>
               </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Document Preview</h3>
            <div className="border border-gray-200 rounded-xl p-6 bg-gray-50 h-64 overflow-y-auto">
              <p className="text-sm text-gray-500 mb-4 italic">Draft template: {offer.template?.name}</p>
              {/* Note: In reality we would render the HTML or a PDF preview here */}
              <div className="prose prose-sm text-gray-700 max-w-none" dangerouslySetInnerHTML={{ __html: offer.template?.contentHtml || "<p>Standard Offer Text...</p>" }} />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-4">
            <button
              onClick={() => handleAction("APPROVE")}
              disabled={isSubmitting}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm shadow-emerald-500/20 transition-all disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
              Approve Offer
            </button>
            <button
              onClick={() => handleAction("REJECT")}
              disabled={isSubmitting}
              className="px-6 py-3 bg-gray-100 hover:bg-red-50 text-gray-700 hover:text-red-700 font-bold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 border border-gray-200 hover:border-red-200"
            >
              Request Changes
            </button>
          </div>
        </div>
      ) : (
        <div className="p-8 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Request Changes</h3>
            <p className="text-sm text-gray-500 mt-1">Please provide notes for the recruiter on what needs to be adjusted in this offer.</p>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Base salary exceeds the approved band. Please lower to $115k."
            className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none"
          />

          <div className="flex gap-3">
             <button
              onClick={() => setView("SUMMARY")}
              className="px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleAction("REJECT")}
              disabled={isSubmitting || !notes.trim()}
              className="flex-1 bg-red-600 text-white px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Feedback & Reject"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
