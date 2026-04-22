"use client";

import React, { useState, useTransition } from "react";
import { submitInterviewFeedbackAction } from "./feedback-actions";

type InterviewFeedbackFormProps = {
  interviewId: string;
  candidateName: string;
  positionTitle?: string;
  onClose: () => void;
};

export function InterviewFeedbackForm({ interviewId, candidateName, positionTitle, onClose }: InterviewFeedbackFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  
  const [rating, setRating] = useState<number>(75);
  const [recommendation, setRecommendation] = useState("HIRE");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    formData.set("interviewId", interviewId);
    
    startTransition(async () => {
      const res = await submitInterviewFeedbackAction(formData);
      if (!res.success) {
        setError(res.error || "Failed to submit feedback");
      } else {
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-gray-200 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-zinc-800 flex justify-between items-center bg-gray-50/50 dark:bg-zinc-900/50">
          <div>
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">Submit Evaluation</h2>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
              For {candidateName} ({positionTitle || "General Interview"})
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-full transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm font-medium border border-red-100 dark:border-red-900/30 flex items-start gap-3">
               <svg className="w-5 h-5 shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
               {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Rating Slider */}
            <div className="space-y-3 col-span-1 md:col-span-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
                Overall Score ({rating}/100)
              </label>
              <input 
                type="range" 
                name="rating" 
                min="0" 
                max="100" 
                value={rating}
                onChange={(e) => setRating(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 accent-teal-600"
              />
              <div className="flex justify-between text-xs font-semibold text-gray-400">
                <span>0 (Poor)</span>
                <span>100 (Exceptional)</span>
              </div>
            </div>

            {/* Recommendation Select */}
            <div className="col-span-1 md:col-span-2 space-y-3 border-t border-gray-100 dark:border-zinc-800 pt-5 mt-2">
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-200">
                Final Recommendation
              </label>
              <div className="grid grid-cols-3 gap-3">
                {["STRONG_NO_HIRE", "NO_HIRE", "HIRE", "STRONG_HIRE"].map((rec) => {
                  const isSelected = recommendation === rec;
                  const getColors = (r: string) => {
                    if (r.includes("NO")) return isSelected ? "bg-red-100 border-red-300 text-red-800 dark:bg-red-900/40 dark:border-red-500/50 dark:text-red-300" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800";
                    return isSelected ? "bg-emerald-100 border-emerald-300 text-emerald-800 dark:bg-emerald-900/40 dark:border-emerald-500/50 dark:text-emerald-300" : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800";
                  };

                  return (
                    <button
                      key={rec}
                      type="button"
                      onClick={() => setRecommendation(rec)}
                      className={`py-3 px-2 rounded-xl border text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all ${getColors(rec)} ${rec === recommendation ? 'col-span-1 scale-105 shadow-sm' : 'col-span-1'}`}
                      style={{ gridColumn: rec === "NO_HIRE" || rec === "HIRE" ? "span 1" : rec.includes("STRONG") && isSelected ? "span 1" : "" }}
                    >
                      {rec.replace(/_/g, " ")}
                    </button>
                  );
                })}
              </div>
              <input type="hidden" name="recommendation" value={recommendation} />
            </div>

            {/* Summary */}
            <div className="space-y-1.5 col-span-1 md:col-span-2 border-t border-gray-100 dark:border-zinc-800 pt-5 mt-2">
              <label htmlFor="summary" className="block text-sm font-bold text-gray-700 dark:text-gray-200">
                TL;DR Summary (Required)
              </label>
              <textarea 
                id="summary" 
                name="summary" 
                rows={2} 
                required
                placeholder="A couple of sentences summarizing your overall impression..."
                className="w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder-gray-400 dark:text-white transition-shadow shadow-sm"
              />
            </div>

            {/* Detailed Notes */}
            <div className="space-y-1.5 col-span-1 md:col-span-2">
              <label htmlFor="notes" className="block text-sm font-bold text-gray-700 dark:text-gray-200 flex items-center justify-between">
                <span>Detailed Technical & Behavioral Notes</span>
                <span className="text-xs font-normal text-gray-400">Optional</span>
              </label>
              <textarea 
                id="notes" 
                name="notes" 
                rows={4} 
                placeholder="Details regarding technical competency, communication skills, cultural fit..."
                className="w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 placeholder-gray-400 dark:text-white transition-shadow shadow-sm"
              />
            </div>

          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-zinc-800 flex justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-5 py-2.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50 dark:bg-zinc-900 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800 transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-teal-600 rounded-xl hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 transition-colors shadow-sm"
            >
              {isPending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Submitting Feedback...
                </>
              ) : (
                "Complete Evaluation"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
