"use client";

import { useState, useTransition } from "react";
import { AiQuestionCategory } from "@prisma/client";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateQuestionBankAction, toggleQuestionApprovalAction, editQuestionTextAction, deleteQuestionAction, saveQuestionOrderAction } from "./ai-interview-actions";
import { AlertCircle, CheckCircle, Trash2, Edit2, GripVertical, Plus } from "lucide-react";

interface AiInterviewQuestion {
  id: string;
  positionId: string;
  questionText: string;
  category: string;
  isApproved: boolean;
  sortOrder: number;
}

export function AiQuestionBankPanel({
  positionId,
  questions: initialQuestions,
}: {
  positionId: string;
  questions: AiInterviewQuestion[];
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = () => {
    startTransition(async () => {
      setError(null);
      const res = await generateQuestionBankAction(positionId);
      if (!res.success) {
        setError(res.error || "Failed to generate questions");
      } else {
        window.location.reload(); // Quick refresh to get updated questions
      }
    });
  };

  const handleToggleApprove = (id: string, currentlyApproved: boolean) => {
    // optimistic update
    setQuestions(questions.map(q => q.id === id ? { ...q, isApproved: !currentlyApproved } : q));
    startTransition(async () => {
      await toggleQuestionApprovalAction(id, !currentlyApproved);
    });
  };

  const handleDelete = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
    startTransition(async () => {
      await deleteQuestionAction(id);
    });
  };

  const handleTextEdit = (id: string, newText: string) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, questionText: newText } : q));
  };

  const saveTextEdit = (id: string, newText: string) => {
    startTransition(async () => {
      await editQuestionTextAction(id, newText);
    });
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const newQuestions = [...questions];
    if (direction === "up" && index > 0) {
      [newQuestions[index - 1], newQuestions[index]] = [newQuestions[index], newQuestions[index - 1]];
    } else if (direction === "down" && index < newQuestions.length - 1) {
      [newQuestions[index + 1], newQuestions[index]] = [newQuestions[index], newQuestions[index + 1]];
    }
    
    // update sortOrder locally
    newQuestions.forEach((q, i) => { q.sortOrder = i; });
    setQuestions(newQuestions);

    startTransition(async () => {
      await saveQuestionOrderAction(positionId, newQuestions.map(q => q.id));
    });
  };

  const hasUnapproved = questions.some(q => !q.isApproved);
  const totalApproved = questions.filter(q => q.isApproved).length;

  return (
    <Card className="border-gray-100 dark:border-zinc-800 shadow-sm mt-4">
      <CardHeader className="pb-3 pt-5 px-6 border-b border-gray-100 dark:border-zinc-800/60 sticky top-0 bg-white/95 dark:bg-zinc-900/95 backdrop-blur z-10 flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-sm font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
             AI Question Bank
          </CardTitle>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Build and approve the exact questions the AI avatar will ask candidates during the interview. Only approved questions will be used.
          </p>
        </div>
        <div className="flex gap-3">
           <div className="text-xs font-semibold px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
             {totalApproved} Approved
           </div>
           {questions.length === 0 ? (
             <Button size="sm" onClick={handleGenerate} disabled={isPending} className="bg-indigo-600 hover:bg-indigo-500 transition-all font-bold">
                {isPending ? "Generating..." : "Generate from JD"}
             </Button>
           ) : (
            <Button size="sm" onClick={handleGenerate} disabled={isPending} variant="outline" className="font-bold border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                {isPending ? "Regenerating..." : "Regenerate All"}
             </Button>
           )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {error && (
          <div className="p-4 m-4 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-lg text-sm font-semibold flex items-center gap-2 border border-red-100 dark:border-red-900/30">
            <AlertCircle className="w-4 h-4" /> {error}
          </div>
        )}

        {questions.length === 0 && !isPending && !error ? (
          <div className="p-16 text-center border-b border-gray-100 dark:border-zinc-800 last:border-0 bg-gray-50/30 dark:bg-zinc-900/10">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-3">
               <svg className="text-indigo-400" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Your Question Bank is empty</p>
            <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">Click "Generate from JD" to automatically build a foundational set of technical and behavioral questions tailored to this position.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100 dark:divide-zinc-800/60">
            {questions.sort((a,b) => a.sortOrder - b.sortOrder).map((q, i) => (
              <div key={q.id} className={`flex items-start gap-3 p-4 transition-colors ${q.isApproved ? 'bg-white dark:bg-zinc-900' : 'bg-gray-50/50 dark:bg-zinc-900/30'}`}>
                
                {/* Drag / Reorder Handle */}
                <div className="flex flex-col items-center gap-1 mt-1 opacity-40 hover:opacity-100 transition-opacity">
                   <button onClick={() => moveQuestion(i, "up")} disabled={i === 0} className="disabled:opacity-20">
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                   </button>
                   <button onClick={() => moveQuestion(i, "down")} disabled={i === questions.length - 1} className="disabled:opacity-20">
                     <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                   </button>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col gap-2">
                   <div className="flex items-center gap-2">
                     <span className={`text-[10px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-full border ${
                        q.category === 'TECHNICAL' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' :
                        q.category === 'BEHAVIORAL' ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800' :
                        'bg-gray-100 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                     }`}>
                       {q.category}
                     </span>
                   </div>
                   
                   <textarea 
                     value={q.questionText}
                     onChange={(e) => handleTextEdit(q.id, e.target.value)}
                     onBlur={(e) => saveTextEdit(q.id, e.target.value)}
                     className={`flex min-h-[60px] w-full rounded-md border text-base shadow-sm px-3 pt-2 resize-none text-sm font-semibold transition-colors focus:ring-1 focus:ring-indigo-500 focus:outline-none ${
                       q.isApproved 
                         ? 'text-gray-900 dark:text-white border-transparent hover:border-gray-200 dark:hover:border-zinc-700 bg-transparent' 
                         : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-950'
                     }`}
                   />
                </div>

                {/* Actions */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <button 
                    onClick={() => handleToggleApprove(q.id, q.isApproved)}
                    className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all ${
                      q.isApproved 
                        ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm hover:bg-emerald-600' 
                        : 'bg-white border-gray-200 text-gray-400 shadow-sm hover:text-emerald-500 hover:border-emerald-300 dark:bg-zinc-800 dark:border-zinc-700'
                    }`}
                    title={q.isApproved ? "Approved" : "Approve"}
                  >
                    <CheckCircle className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(q.id)}
                    className="flex items-center justify-center w-8 h-8 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
