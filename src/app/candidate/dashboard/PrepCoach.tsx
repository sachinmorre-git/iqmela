"use client";

import { useState } from "react";
import {
  Brain, Sparkles, RotateCcw, Loader2,
  ChevronDown, ChevronUp, Send, CheckCircle2,
} from "lucide-react";

interface PrepQuestion { question: string; modelAnswer: string }
interface Evaluation    { score: number; feedback: string; tips: string[] }

interface Props {
  interviewId:   string;
  positionTitle: string;
  jdSnippet:     string | null;
  roundLabel:    string;
}

function ScoreBadge({ score }: { score: number }) {
  const [cls, label] =
    score >= 80 ? ["text-emerald-400 bg-emerald-500/10 border-emerald-500/25", "Excellent"]   :
    score >= 65 ? ["text-rose-400    bg-rose-500/10    border-rose-500/25",    "Strong"]       :
    score >= 50 ? ["text-amber-400   bg-amber-500/10   border-amber-500/25",   "Adequate"]     :
                  ["text-red-400     bg-red-500/10     border-red-500/25",     "Needs work"];
  return (
    <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl border ${cls} shrink-0`}>
      <span className="text-2xl font-black leading-none">{score}</span>
      <span className="text-[9px] font-bold mt-0.5 opacity-60">{label}</span>
    </div>
  );
}

function FlipCard({ q, index }: { q: PrepQuestion; index: number }) {
  const [showModel,  setShowModel]  = useState(false);
  const [answer,     setAnswer]     = useState("");
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  const evaluate = async () => {
    if (!answer.trim() || evaluating) return;
    setEvaluating(true);
    setError(null);
    try {
      const res  = await fetch("/api/candidate/evaluate-answer", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ question: q.question, userAnswer: answer }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Evaluation failed");
      setEvaluation(data);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally { setEvaluating(false); }
  };

  return (
    <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-950/50 hover:border-zinc-700 transition-colors">
      {/* Question */}
      <div className="px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="w-6 h-6 rounded-lg bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-[10px] font-black text-rose-400 shrink-0 mt-0.5">
            {index + 1}
          </span>
          <p className="text-sm font-medium text-white leading-relaxed">{q.question}</p>
        </div>
      </div>

      {/* Model answer accordion */}
      <div className="border-t border-zinc-800/60">
        <button
          onClick={() => setShowModel(!showModel)}
          className="w-full flex items-center justify-between px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <span>✨ Model answer approach</span>
          {showModel ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showModel && (
          <div className="px-5 pb-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <p className="text-xs text-zinc-400 leading-relaxed border-l-2 border-rose-500/40 pl-4">
              {q.modelAnswer}
            </p>
          </div>
        )}
      </div>

      {/* Answer textarea + evaluate */}
      <div className="border-t border-zinc-800/60 px-5 py-4 space-y-3">
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type your answer here to get it scored by AI…"
          rows={3}
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-zinc-700 resize-none focus:outline-none focus:border-rose-500 transition-colors"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={evaluate}
            disabled={!answer.trim() || evaluating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs transition-all"
          >
            {evaluating
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Evaluating…</>
              : <><Send className="w-3.5 h-3.5" /> Score my answer</>}
          </button>
          {evaluation && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* Evaluation result */}
        {evaluation && (
          <div className="mt-1 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-start gap-4">
              <ScoreBadge score={evaluation.score} />
              <p className="text-xs text-zinc-400 leading-relaxed pt-1 flex-1">{evaluation.feedback}</p>
            </div>
            {evaluation.tips.length > 0 && (
              <div className="space-y-1.5 pl-1">
                {evaluation.tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-zinc-500">
                    <span className="text-amber-400 shrink-0 font-bold">→</span>
                    <span className="leading-relaxed">{tip}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function PrepCoach({ interviewId, positionTitle, jdSnippet, roundLabel }: Props) {
  const [questions,    setQuestions]    = useState<PrepQuestion[]>([]);
  const [generating,   setGenerating]   = useState(false);
  const [generated,    setGenerated]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res  = await fetch("/api/candidate/prep-questions", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ interviewId }),
      });
      const data = await res.json();
      if (!res.ok || !data.questions) throw new Error(data.error ?? "Generation failed");
      setQuestions(data.questions);
      setGenerated(true);
    } catch (e: any) {
      setError(e.message ?? "Network error — please try again");
    } finally { setGenerating(false); }
  };

  return (
    <div className="border border-zinc-800 rounded-2xl bg-zinc-900/40 p-6 space-y-5 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-pink-600/20 border border-pink-500/30 flex items-center justify-center">
            <Brain className="w-4 h-4 text-pink-400" />
          </div>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">AI Prep Coach</h2>
        </div>
        {generated && (
          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1 text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors font-bold uppercase tracking-widest"
          >
            <RotateCcw className="w-3 h-3" /> Regenerate
          </button>
        )}
      </div>

      {!generated ? (
        /* Pre-generate state */
        <div className="flex-1 flex flex-col items-center justify-center text-center py-6 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-pink-600/10 border border-pink-500/20 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6 text-pink-400" />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-bold text-white">5 tailored prep questions</p>
            <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
              Generated from your <span className="text-zinc-300">{roundLabel}</span> brief
              for <span className="text-zinc-300">{positionTitle}</span>.
              Type your answers and get scored 0–100 instantly.
            </p>
          </div>
          <button
            onClick={generate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-lg shadow-pink-600/25"
          >
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              : <><Sparkles className="w-4 h-4" /> Generate my prep questions</>}
          </button>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      ) : (
        /* Questions list */
        <div className="space-y-3 flex-1 overflow-y-auto max-h-[560px] pr-0.5">
          {questions.map((q, i) => <FlipCard key={i} q={q} index={i} />)}
        </div>
      )}
    </div>
  );
}
