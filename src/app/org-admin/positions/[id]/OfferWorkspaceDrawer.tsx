"use client";

import { useState } from "react";
import { Loader2, X, FileText, CheckCircle, ChevronRight, Calculator, Calendar as CalendarIcon, UserCheck } from "lucide-react";
import { JobOffer } from "@prisma/client";
import { createJobOfferAction } from "@/app/org-admin/offer-actions";

interface OfferWorkspaceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  resumeId: string;
  positionId: string;
  candidateName: string;
}

export function OfferWorkspaceDrawer({
  isOpen,
  onClose,
  resumeId,
  positionId,
  candidateName,
}: OfferWorkspaceDrawerProps) {
  // Navigation states
  const [step, setStep] = useState<"DETAILS" | "APPROVALS" | "REVIEW">("DETAILS");
  
  // Data states
  const [baseSalary, setBaseSalary] = useState("");
  const [equity, setEquity] = useState("");
  const [bonus, setBonus] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [startDate, setStartDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [templateId, setTemplateId] = useState("");
  
  // Approval chain states
  const [approvers, setApprovers] = useState([{ name: "", email: "", designation: "" }]);

  if (!isOpen) return null;

  const handleAddApprover = () => {
    setApprovers([...approvers, { name: "", email: "", designation: "" }]);
  };

  const handleRemoveApprover = (idx: number) => {
    setApprovers(approvers.filter((_, i) => i !== idx));
  };
  
  const handleUpdateApprover = (idx: number, field: string, val: string) => {
    const updated = [...approvers];
    (updated[idx] as any)[field] = val;
    setApprovers(updated);
  };

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      const res = await createJobOfferAction({
        resumeId,
        positionId,
        templateId: templateId || undefined, // Fallback if no template selected
        baseSalary: Number(baseSalary),
        currency,
        signOnBonus: Number(bonus) || undefined,
        equityAmount: equity || undefined,
        startDate,
        expirationDate: expiryDate,
        approvers: approvers.filter(a => a.name && a.email)
      });

      if (res.success) {
        alert("Offer drafted and sent for internal approval successfully!");
        onClose();
      } else {
        alert(res.error || "Failed to create offer");
      }
    } catch (err) {
       alert("Network error.");
    } finally {
       setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed top-0 right-0 z-50 h-full w-full max-w-[600px] bg-white dark:bg-zinc-900 border-l border-gray-200 dark:border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-900">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" />
              Offer Studio
            </h2>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
              Drafting offer for <strong className="text-gray-900 dark:text-white">{candidateName}</strong>
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Workspace Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gray-50 dark:bg-black/20">

          {/* Stepper */}
          <div className="flex items-center justify-between relative mb-8">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-200 dark:bg-zinc-800 -z-10" />
            <div className={`flex flex-col items-center gap-2 ${step === "DETAILS" ? "text-indigo-600" : "text-gray-400"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 bg-white dark:bg-zinc-900 ${step === "DETAILS" ? "border-indigo-600 shadow-[0_0_0_4px_rgba(79,70,229,0.1)]" : "border-gray-200 dark:border-zinc-700"}`}>
                <Calculator className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">1. Structured Data</span>
            </div>
            <div className={`flex flex-col items-center gap-2 ${step === "APPROVALS" ? "text-indigo-600" : "text-gray-400"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 bg-white dark:bg-zinc-900 ${step === "APPROVALS" ? "border-indigo-600 shadow-[0_0_0_4px_rgba(79,70,229,0.1)]" : "border-gray-200 dark:border-zinc-700"}`}>
                <UserCheck className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">2. Approvals</span>
            </div>
            <div className={`flex flex-col items-center gap-2 ${step === "REVIEW" ? "text-indigo-600" : "text-gray-400"}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 bg-white dark:bg-zinc-900 ${step === "REVIEW" ? "border-indigo-600 shadow-[0_0_0_4px_rgba(79,70,229,0.1)]" : "border-gray-200 dark:border-zinc-700"}`}>
                <CheckCircle className="w-4 h-4" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider">3. Freeze & Route</span>
            </div>
          </div>

          {step === "DETAILS" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
              
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-gray-400" />
                  Compensation Details
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Base Salary</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input type="number" placeholder="120,000" className="w-full pl-7 pr-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={baseSalary} onChange={e => setBaseSalary(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Sign-on Bonus</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input type="number" placeholder="10,000" className="w-full pl-7 pr-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={bonus} onChange={e => setBonus(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Equity Grant (RSUs / Options)</label>
                    <input type="text" placeholder="e.g. 5,000 RSUs vesting over 4 years" className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={equity} onChange={e => setEquity(e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm space-y-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-gray-400" />
                  Key Dates & Template
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Expected Start Date</label>
                    <input type="date" className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Offer Expiration Date</label>
                    <input type="date" className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Document Template</label>
                    <select className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none">
                      <option value="">Standard Full-Time Offer</option>
                      <option value="">Executive Offer with Equity Addendum</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>
          )}

          {step === "APPROVALS" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
              <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-400 mb-1">Approval Chain Sequence</h4>
                <p className="text-xs text-amber-700 dark:text-amber-500/80">These stakeholders will receive a sequential, secure link to review the structured data and rendered offer document.</p>
              </div>

              <div className="space-y-4">
                {approvers.map((approver, idx) => (
                  <div key={idx} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm relative group">
                    <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-gray-100 dark:bg-zinc-800 border-2 border-white dark:border-zinc-900 flex items-center justify-center text-[10px] font-bold text-gray-500 dark:text-zinc-400 shadow-sm">
                      {idx + 1}
                    </div>
                    {approvers.length > 1 && (
                      <button onClick={() => handleRemoveApprover(idx)} className="absolute right-3 top-3 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Name</label>
                        <input type="text" placeholder="John Doe" className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm" value={approver.name} onChange={e => handleUpdateApprover(idx, "name", e.target.value)} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Designation / Role</label>
                        <input type="text" placeholder="VP of Engineering" className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm" value={approver.designation} onChange={e => handleUpdateApprover(idx, "designation", e.target.value)} />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <label className="text-xs font-medium text-gray-600 dark:text-zinc-400">Email Address (Secure Link Target)</label>
                        <input type="email" placeholder="john@company.com" className="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-800 rounded-lg text-sm" value={approver.email} onChange={e => handleUpdateApprover(idx, "email", e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}

                <button onClick={handleAddApprover} className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-zinc-800 rounded-xl text-sm font-medium text-gray-500 dark:text-zinc-400 hover:border-indigo-400 hover:text-indigo-600 dark:hover:border-indigo-500/50 dark:hover:text-indigo-400 transition-colors flex items-center justify-center gap-2 bg-white dark:bg-transparent">
                  + Add another approver
                </button>
              </div>
            </div>
          )}

          {step === "REVIEW" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
               <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 rounded-xl p-6 text-center">
                 <CheckCircle className="w-10 h-10 text-indigo-500 mx-auto mb-3" />
                 <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">Offer Ready to Freeze</h3>
                 <p className="text-sm text-gray-600 dark:text-zinc-400 max-w-sm mx-auto">Once submitted, this structured data package will be sent to the approval chain. No edits can be made without restarting the process.</p>
               </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 dark:border-zinc-800 shrink-0 bg-white dark:bg-zinc-900 flex items-center justify-between">
          {step !== "DETAILS" ? (
             <button onClick={() => setStep(step === "REVIEW" ? "APPROVALS" : "DETAILS")} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
               Back
             </button>
          ) : <div />}
          
          {step === "REVIEW" ? (
             <button onClick={handleSubmit} disabled={isSubmitting} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm shadow-indigo-600/20 flex items-center gap-2 transition-colors disabled:opacity-50">
               {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin"/> : "Freeze & Route to Approvers"}
             </button>
          ) : (
            <button onClick={() => setStep(step === "DETAILS" ? "APPROVALS" : "REVIEW")} className="px-5 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 text-sm font-medium rounded-lg shadow-sm flex items-center gap-2 transition-colors">
               Next Step <ChevronRight className="w-4 h-4" />
             </button>
          )}
        </div>
      </div>
    </>
  );
}
