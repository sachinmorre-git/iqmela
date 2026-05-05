"use client";

import { useState } from "react";
import { processIntelligenceReport } from "./intelligence-actions";
import { BrainCircuit, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

export function IntelligencePanel({ interviewId, analysis, violationsCount }: { interviewId: string, analysis: any, violationsCount: number }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsProcessing(true);
    setError(null);
    const result = await processIntelligenceReport(interviewId);
    if (!result.success) setError(result.error as string);
    setIsProcessing(false);
  };

  if (!analysis) {
    return (
      <div className="mt-4 p-4 rounded-xl border border-dashed border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/10 flex items-center justify-between">
         <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-900/50 flex flex-col items-center justify-center shrink-0">
             <BrainCircuit className="w-5 h-5 text-rose-600 dark:text-rose-400" />
           </div>
           <div>
             <h4 className="font-semibold text-sm text-gray-900 dark:text-zinc-200">Run Cognitive Fraud & Soft-Skills AI</h4>
             <p className="text-xs text-gray-500 dark:text-zinc-500">
               Cross-reference the audio transcript against the <span className="font-bold text-red-500 dark:text-red-400">{violationsCount} System Violations</span> detected during this session.
             </p>
           </div>
         </div>
         
         <button 
           onClick={handleGenerate} 
           disabled={isProcessing}
           className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-bold shadow-md transition disabled:opacity-50"
         >
           {isProcessing ? "Processing NLP..." : "Generate AI Report"}
         </button>
         
         {error && <p className="text-xs text-red-500 mt-2 absolute">{error}</p>}
      </div>
    );
  }

  // The Analysis is rendered securely
  return (
    <div className="mt-4 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900/50 shadow-sm relative">
      
      {/* Heavy Fraud Header */}
      <div className="bg-gradient-to-r from-gray-50 to-white dark:from-zinc-900 dark:to-zinc-900/50 p-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
           <BrainCircuit className="w-5 h-5 text-rose-500" />
           <h4 className="font-bold text-sm tracking-tight">AI Intelligence & Proctor Report</h4>
        </div>
        
        <div className="flex gap-2">
           {analysis.suspicionScore > 75 ? (
             <span className="px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-xs font-black flex items-center gap-1 border border-red-200 dark:border-red-900/50 uppercase tracking-wider">
               <ShieldAlert className="w-3.5 h-3.5" /> High Fraud Probability ({analysis.suspicionScore}%)
             </span>
           ) : (
             <span className="px-3 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-full text-xs font-black flex items-center gap-1 border border-emerald-200 dark:border-emerald-900/50 uppercase tracking-wider">
               <CheckCircle2 className="w-3.5 h-3.5" /> Clean Session ({analysis.suspicionScore}%)
             </span>
           )}
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6">
         {/* Technical & Soft Skills Bounds */}
         <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Technical Depth Validation</span>
                <span className="text-gray-900 dark:text-zinc-200">{analysis.technicalScore}/100</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-zinc-800 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${analysis.technicalScore}%` }}></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-xs font-bold mb-1">
                <span className="text-gray-500 dark:text-zinc-400 uppercase tracking-wider">Communication & Soft Skills</span>
                <span className="text-gray-900 dark:text-zinc-200">{analysis.softSkillScore}/100</span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-zinc-800 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${analysis.softSkillScore}%` }}></div>
              </div>
            </div>
         </div>

         {/* Behavioral Insights */}
         <div className="space-y-3 bg-gray-50 dark:bg-zinc-800/30 p-3 rounded-lg border border-gray-100 dark:border-zinc-800">
           {analysis.aiToneDetected && (
             <p className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-400 p-2 rounded flex items-start gap-2 font-medium">
               <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
               Warning: Unnatural 'ChatGPT-like' vocabulary structure frequently matched inside transcript cadence.
             </p>
           )}
           <div className="text-xs text-gray-600 dark:text-zinc-400 font-medium">
             <span className="font-bold text-gray-900 dark:text-zinc-200 block mb-1">AI Assessor Notes:</span>
             {analysis.fraudNotes || "Candidate displayed naturally consistent human speech timings."}
           </div>
         </div>
      </div>
    
    </div>
  );
}
