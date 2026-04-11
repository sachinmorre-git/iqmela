"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Star, CheckCircle, Loader2 } from "lucide-react";
import { submitInterviewFeedback } from "./submitFeedback";
import Link from "next/link";

export function FeedbackForm({ interviewId }: { interviewId: string }) {
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [recommendation, setRecommendation] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating || !recommendation || !summary) {
      setError("Please fill out rating, recommendation, and summary blocks completely.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await submitInterviewFeedback(interviewId, { rating, recommendation, summary, notes });
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex-1 w-full max-w-2xl mx-auto flex flex-col items-center justify-center p-8 text-center min-h-[60vh] gap-6 animate-in fade-in zoom-in duration-500">
        <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-500 rounded-full flex items-center justify-center mb-2">
          <CheckCircle className="w-10 h-10" />
        </div>
        <h1 className="text-3xl font-black text-gray-900 dark:text-white">Feedback Logged Successfully</h1>
        <p className="text-gray-500 dark:text-gray-400 font-medium">
          Your evaluation has been securely locked into the database. The interview session is now classified as COMPLETED.
        </p>
        <Link href="/interviewer/dashboard" className="mt-4">
           <Button size="lg" className="rounded-2xl font-bold px-8 bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-200">Return to Dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
        
        <div className="bg-indigo-600 px-8 py-10 text-white">
          <h2 className="text-3xl font-black mb-2">Post-Interview Evaluation</h2>
          <p className="text-indigo-100 font-medium opacity-90">Please securely conclude this session by grading the candidate's technical performance.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 lg:p-10 flex flex-col gap-10">
          
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm font-bold border border-red-200 dark:border-red-900/50">
              {error}
            </div>
          )}

          {/* Rating Section */}
          <div>
            <h3 className="text-sm font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-4">Overall Score</h3>
            <div className="flex items-center gap-2">
               {[1, 2, 3, 4, 5].map((star) => (
                 <button
                   key={star}
                   type="button"
                   onMouseEnter={() => setHoverRating(star)}
                   onMouseLeave={() => setHoverRating(0)}
                   onClick={() => setRating(star)}
                   className="p-1 transition-transform hover:scale-110 active:scale-95"
                 >
                   <Star 
                     className={`w-12 h-12 transition-all ${
                       star <= (hoverRating || rating) 
                         ? 'fill-amber-400 text-amber-400 filter drop-shadow-md' 
                         : 'fill-transparent text-gray-200 dark:text-zinc-800'
                     }`} 
                   />
                 </button>
               ))}
            </div>
          </div>

          {/* Recommendation Flags */}
          <div>
             <h3 className="text-sm font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-4">Final Verdict</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {[
                 { id: 'STRONG_HIRE', label: 'Strong Hire', color: 'bg-green-500', bg: 'bg-green-50 dark:bg-green-500/10 hover:bg-green-100 dark:hover:bg-green-500/20 border-green-200 dark:border-green-500/30' },
                 { id: 'HIRE', label: 'Hire', color: 'bg-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border-indigo-200 dark:border-indigo-500/30' },
                 { id: 'NO_HIRE', label: 'No Hire', color: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 border-red-200 dark:border-red-500/30' }
               ].map((rec) => (
                 <button
                   key={rec.id}
                   type="button"
                   onClick={() => setRecommendation(rec.id)}
                   className={`relative p-5 rounded-2xl flex items-center justify-center gap-3 transition-all border-2 text-sm font-bold overflow-hidden ${
                     recommendation === rec.id 
                       ? `border-${rec.color.replace('bg-', '')} bg-${rec.color.replace('bg-', '')}/10 text-${rec.color.replace('bg-', '')} shadow-sm ring-1 ring-${rec.color.replace('bg-', '')}/50` 
                       : `border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800/80`
                   }`}
                 >
                   {recommendation === rec.id && <span className={`absolute top-0 left-0 w-full h-1 ${rec.color}`}></span>}
                   {rec.label}
                 </button>
               ))}
             </div>
          </div>

          <div className="space-y-6">
             {/* Summary Textarea */}
             <div>
               <label className="block text-sm font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Executive Summary</label>
               <textarea 
                 value={summary}
                 onChange={(e) => setSummary(e.target.value)}
                 className="w-full h-32 px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-indigo-500 transition-all resize-none shadow-sm dark:text-zinc-200"
                 placeholder="Summarize the core technical strengths and weaknesses..."
               />
             </div>

             {/* Private Notes Sync Textarea */}
             <div>
               <label className="block text-sm font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-wider mb-2">Supplemental Notes</label>
               <textarea 
                 value={notes}
                 onChange={(e) => setNotes(e.target.value)}
                 className="w-full h-32 px-4 py-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50 text-sm focus:ring-2 focus:ring-indigo-500 transition-all resize-none dark:text-zinc-400"
                 placeholder="Any additional private interview notes (optional)..."
               />
             </div>
          </div>

          <Button 
            type="submit" 
            disabled={isSubmitting || !rating || !recommendation || !summary}
            size="lg"
            className="w-full h-16 rounded-2xl text-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl shadow-indigo-600/20 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : "Lock In Final Feedback"}
          </Button>

        </form>
      </div>
    </div>
  );
}
