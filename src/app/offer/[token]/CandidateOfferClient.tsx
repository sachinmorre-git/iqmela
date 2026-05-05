"use client";
import { toast } from "sonner";

import { useState, useEffect } from "react";
import { formatDate, formatTime, formatDateTime } from "@/lib/locale-utils";
import { Check, X, FileText, Calendar, DollarSign, MessageCircle, ArrowRight, Loader2, PenTool, ShieldCheck, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { JobOffer } from "@prisma/client";
import { renderOfferDocument, getExpirationLabel } from "@/lib/offer-utils";

interface CandidateOfferClientProps {
  offer: any; // Mapped from JobOffer relation tree
  token: string;
}

export function CandidateOfferClient({ offer, token }: CandidateOfferClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"SUMMARY" | "DOCUMENT">("SUMMARY");
  const [view, setView] = useState<"MAIN" | "DECLINE" | "QUESTION" | "SIGN">("MAIN");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [typedSignature, setTypedSignature] = useState("");
  const [esignConsent, setEsignConsent] = useState(false);

  const expiration = getExpirationLabel(offer.expirationDate);

  // Trigger confetti on initial load if pending
  useEffect(() => {
    if (offer.status === "FROZEN" || offer.status === "SENT" || offer.status === "APPROVED") {
      const duration = 3 * 1000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#4f46e5', '#10b981', '#3b82f6']
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#4f46e5', '#10b981', '#3b82f6']
        });

        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
  }, [offer.status]);

  const candidateName = offer.resume.candidateName?.split(" ")[0] || "there";
  const hasAccepted = offer.status === "ACCEPTED";
  const hasDeclined = offer.status === "DECLINED";

  const handleAction = async (action: "ACCEPT" | "DECLINE" | "QUESTION") => {
    setIsSubmitting(true);
    
    try {
        if (action === "ACCEPT") {
            const res = await fetch(`/api/offers/${token}/sign`, { method: "POST" });
            const data = await res.json();
            
            if (data.signatureUrl) {
                // DocuSign path — redirect to embedded signing
                window.location.href = data.signatureUrl;
            } else if (data.mode === "builtin") {
                // Built-in e-signature path — show signature modal
                setView("SIGN");
                setIsSubmitting(false);
            } else {
                toast.error(data.error || "Failed to initiate signature session.");
                setIsSubmitting(false);
            }
        } else if (action === "DECLINE") {
            const res = await fetch(`/api/offers/${token}/decline`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ notes: notes.trim() || undefined }),
            });
            const data = await res.json();
            if (data.success) {
              toast.info("Offer declined. The recruiter has been notified.");
              router.refresh();
            } else {
              toast.error(data.error || "Failed to decline offer.");
            }
            setIsSubmitting(false);
        } else {
            const res = await fetch(`/api/offers/${token}/question`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ question: notes.trim() }),
            });
            const data = await res.json();
            if (data.success) {
              toast.success("Question submitted to the recruiter!");
              setView("MAIN");
              setNotes("");
            } else {
              toast.error(data.error || "Failed to submit question.");
            }
            setIsSubmitting(false);
        }
    } catch (err) {
        setIsSubmitting(false);
        toast.error("Action failed. Please try again.");
    }
  };

  const handleBuiltinSign = async () => {
    if (!typedSignature.trim() || !esignConsent) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/offers/${token}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typedSignature: typedSignature.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        router.refresh();
      } else {
        toast.error(data.error || "Signing failed.");
      }
    } catch {
      toast.error("Signing failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (hasAccepted) {
      return (
          <div className="min-h-screen bg-[#F0F2F5] flex flex-col items-center pt-24 px-4 overflow-hidden">
             <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center text-white mb-8 shadow-xl shadow-emerald-500/30 animate-in zoom-in duration-500 delay-150">
                 <Check className="w-10 h-10" />
             </div>
             <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-4 text-center animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">Welcome to the team!</h1>
             <p className="text-lg text-gray-500 text-center max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500">
               Your signed documents are securely stored. The onboarding team will reach out with your next steps shortly!
             </p>
          </div>
      )
  }

  // Rendered offer document with variable substitution
  const renderedDoc = renderOfferDocument(
    offer.template?.contentHtml || "<p>Offer document not yet available.</p>",
    {
      candidateName: offer.resume?.candidateName,
      positionTitle: offer.position?.title,
      organizationName: offer.organization?.name,
      baseSalary: offer.baseSalary,
      currency: offer.currency,
      signOnBonus: offer.signOnBonus,
      equityAmount: offer.equityAmount,
      startDate: offer.startDate,
      expirationDate: offer.expirationDate,
    }
  );

  return (
    <div className="min-h-screen pb-24">
      {/* Expiration Banner */}
      {expiration.expired && (
        <div className="bg-red-600 text-white text-center py-3 px-4 text-sm font-bold flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          This offer has expired. Please contact the recruiter for next steps.
        </div>
      )}
      {!expiration.expired && expiration.urgency === "critical" && (
        <div className="bg-amber-500 text-white text-center py-2.5 px-4 text-sm font-bold flex items-center justify-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {expiration.label} — please review and respond soon
        </div>
      )}
      {/* Dynamic Header */}
      <div className="bg-[#111111] w-full pt-16 pb-32 px-4 relative overflow-hidden">
        {/* Subtle glowing orb */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-rose-500/20 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="max-w-4xl mx-auto relative z-10 text-center">
          <p className="text-rose-400 font-bold tracking-widest uppercase text-sm mb-4 animate-in fade-in duration-700">Official Offer</p>
          <h1 className="text-5xl md:text-6xl font-extrabold text-white tracking-tight mb-6 animate-in slide-in-from-bottom-8 duration-700 delay-100">
            Congratulations, {candidateName}.
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto font-medium animate-in slide-in-from-bottom-8 duration-700 delay-200">
             We are thrilled to offer you the position of <span className="text-white">{offer.position.title}</span> at <span className="text-white">{offer.organization.name}</span>.
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-4xl mx-auto px-4 -mt-16 relative z-20">
        
        {/* Tab Navigation */}
        <div className="flex p-1.5 bg-white/80 backdrop-blur-xl border border-white rounded-2xl shadow-sm max-w-sm mx-auto mb-8">
            <button
              onClick={() => setActiveTab("SUMMARY")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "SUMMARY" ? "bg-gray-900 text-white shadow-md" : "text-gray-500 hover:text-gray-900"}`}
            >
              Summary
            </button>
            <button
              onClick={() => setActiveTab("DOCUMENT")}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === "DOCUMENT" ? "bg-gray-900 text-white shadow-md" : "text-gray-500 hover:text-gray-900"}`}
            >
              Full Document
            </button>
        </div>

        {/* View States */}
        {view === "MAIN" && activeTab === "SUMMARY" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Visualizer Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    
                    {/* Primary Comp Card */}
                    <div className="md:col-span-2 bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all duration-700 pointer-events-none">
                            <DollarSign className="w-48 h-48" />
                        </div>
                        <h3 className="text-sm font-bold tracking-widest text-gray-400 uppercase mb-8">Base Compensation</h3>
                        <div className="flex items-baseline gap-2 mb-2">
                           <span className="text-6xl font-black text-gray-900 tracking-tighter">${offer.baseSalary.toLocaleString()}</span>
                           <span className="text-xl font-medium text-gray-400">/ yr</span>
                        </div>
                        {offer.signOnBonus && (
                            <div className="mt-8 pt-6 border-t border-gray-100">
                                <p className="text-sm font-bold text-emerald-600 mb-1">+ ${offer.signOnBonus.toLocaleString()} Sign-on Bonus</p>
                                <p className="text-sm text-gray-400">Paid on the first payroll cycle</p>
                            </div>
                        )}
                    </div>

                    {/* Equity Card */}
                    <div className="bg-gray-900 rounded-3xl p-8 shadow-xl shadow-gray-900/20 border border-gray-800 text-white relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/10 to-transparent"></div>
                        <div className="relative z-10">
                            <h3 className="text-sm font-bold tracking-widest text-gray-400 uppercase mb-8">Equity Grant</h3>
                            <span className="text-3xl font-black tracking-tight block mb-2">{offer.equityAmount || "N/A"}</span>
                            <p className="text-sm text-gray-400 font-medium leading-relaxed">Standard 4-year vesting schedule with a 1-year cliff.</p>
                        </div>
                    </div>

                    {/* Details Cards */}
                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="bg-white rounded-3xl p-6 shadow-lg shadow-gray-100 border border-gray-100 flex items-center gap-4">
                             <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                                 <Calendar className="w-6 h-6" />
                             </div>
                             <div>
                                 <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Target Start Date</p>
                                 <p className="text-lg font-bold text-gray-900">{formatDate(new Date(offer.startDate), { style: "long" })}</p>
                             </div>
                         </div>
                         <div className="bg-white rounded-3xl p-6 shadow-lg shadow-gray-100 border border-gray-100 flex items-center gap-4">
                             <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center text-red-600 shrink-0">
                                 <FileText className="w-6 h-6" />
                             </div>
                             <div>
                                 <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Offer Expires</p>
                                 <p className="text-lg font-bold text-gray-900">{formatDate(new Date(offer.expirationDate), { style: "long" })}</p>
                             </div>
                         </div>
                    </div>

                </div>

            </div>
        )}

        {view === "MAIN" && activeTab === "DOCUMENT" && (
            <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100 min-h-[600px] animate-in fade-in zoom-in-95 duration-300">
                 <div className="prose prose-gray max-w-none" dangerouslySetInnerHTML={{ __html: renderedDoc }} />
            </div>
        )}

        {/* ── Built-in E-Signature Modal ── */}
        {view === "SIGN" && (
            <div className="bg-white rounded-3xl p-10 shadow-xl shadow-gray-200/50 border border-gray-100 max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-300">
                <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-pink-600 text-white rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-rose-500/20">
                    <PenTool className="w-7 h-7" />
                </div>
                <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">Sign Your Offer</h2>
                <p className="text-gray-500 mb-8">Type your full legal name below to electronically sign this offer letter.</p>

                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Your Full Legal Name</label>
                        <input
                            type="text"
                            value={typedSignature}
                            onChange={(e) => setTypedSignature(e.target.value)}
                            placeholder={offer.resume?.candidateName || "Type your name"}
                            className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl text-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 outline-none transition-all"
                            style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive", fontSize: "1.5rem" }}
                        />
                    </div>

                    {typedSignature.trim() && (
                        <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200 animate-in fade-in duration-200">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Signature Preview</p>
                            <p className="text-3xl text-gray-900" style={{ fontFamily: "'Brush Script MT', 'Segoe Script', cursive" }}>
                                {typedSignature}
                            </p>
                        </div>
                    )}

                    <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={esignConsent}
                            onChange={(e) => setEsignConsent(e.target.checked)}
                            className="mt-1 w-5 h-5 rounded border-2 border-gray-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
                        />
                        <span className="text-sm text-gray-600 leading-relaxed group-hover:text-gray-900 transition-colors">
                            I agree to use electronic records and signatures. By typing my name above, I intend this to be my legally binding signature on this offer letter.
                        </span>
                    </label>

                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>ESIGN Act & UETA compliant · Your IP address and timestamp are recorded</span>
                    </div>
                </div>

                <div className="flex items-center gap-3 mt-8">
                    <button onClick={() => { setView("MAIN"); setTypedSignature(""); setEsignConsent(false); }} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl transition-colors">Cancel</button>
                    <button
                        onClick={handleBuiltinSign}
                        disabled={isSubmitting || !typedSignature.trim() || !esignConsent}
                        className="flex-1 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white py-4 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-rose-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><PenTool className="w-4 h-4" /> Sign & Accept Offer</>}
                    </button>
                </div>
            </div>
        )}

        {view === "QUESTION" && (
            <div className="bg-white rounded-3xl p-10 shadow-xl shadow-gray-200/50 border border-gray-100 max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-300">
                <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mb-6">
                    <MessageCircle className="w-7 h-7" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Clarification</h2>
                <p className="text-gray-500 mb-8">Have a question about compensation, benefits, or your start date? Ask the team directly below.</p>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Type your question here..."
                    className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500 outline-none mb-6"
                />
                <div className="flex items-center gap-3">
                    <button onClick={() => setView("MAIN")} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl transition-colors">Cancel</button>
                    <button onClick={() => handleAction("QUESTION")} disabled={isSubmitting || !notes.trim()} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3 rounded-xl font-bold shadow-md shadow-rose-500/20 transition-all flex items-center justify-center gap-2">
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send Message"}
                    </button>
                </div>
            </div>
        )}

        {view === "DECLINE" && (
            <div className="bg-white rounded-3xl p-10 shadow-xl shadow-gray-200/50 border border-gray-100 max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-300">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Decline Offer</h2>
                <p className="text-gray-500 mb-8">We're sorry to see you go! If you're open to sharing why, please leave a note for the recruiter.</p>
                <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional feedback..."
                    className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 outline-none mb-6"
                />
                <div className="flex items-center gap-3">
                    <button onClick={() => setView("MAIN")} className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold rounded-xl transition-colors">Cancel</button>
                    <button onClick={() => handleAction("DECLINE")} disabled={isSubmitting} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 rounded-xl font-bold shadow-md shadow-red-500/20 transition-all flex items-center justify-center gap-2">
                        {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirm Decline"}
                    </button>
                </div>
            </div>
        )}

      </div>

      {/* Floating Action Dock */}
      {view === "MAIN" && !hasDeclined && !expiration.expired && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-50 animate-in slide-in-from-bottom-12 duration-700 delay-500">
              <div className="bg-gray-900/90 backdrop-blur-xl p-2 rounded-2xl shadow-2xl flex items-center gap-2 border border-gray-800">
                  <button onClick={() => handleAction("ACCEPT")} disabled={isSubmitting} className="flex-1 bg-white hover:bg-gray-100 text-gray-900 py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                      {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin text-gray-900" /> : <>Accept & Sign <ArrowRight className="w-4 h-4" /></>}
                  </button>
                  <button onClick={() => setView("QUESTION")} className="px-6 py-4 text-white hover:bg-white/10 rounded-xl font-bold text-sm transition-colors">
                      Ask Question
                  </button>
                  <div className="w-[1px] h-8 bg-gray-700 mx-1"></div>
                  <button onClick={() => setView("DECLINE")} className="px-6 py-4 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl font-bold text-sm transition-colors">
                      Decline
                  </button>
              </div>
          </div>
      )}

    </div>
  );
}
