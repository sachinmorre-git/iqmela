"use client";

import { useState, useMemo } from "react";
import {
  Code2, FileText, CircleDot, CheckSquare, Paperclip,
  Search, ChevronDown, ChevronUp, BookOpen, Eye, Plus
} from "lucide-react";
import { QuestionBuilderModal } from "./QuestionBuilderModal";

type Question = {
  id: string; type: string; title: string; description: string;
  difficulty: string; category: string | null; tags: string[];
  language: string | null; starterCode: string | null;
  sampleInput: string | null; expectedOutput: string | null;
  options: any; explanation: string | null;
  attachmentUrl: string | null; attachmentName: string | null;
  usageCount: number; isFromSeedBank: boolean;
};

const TYPE_ICONS: Record<string, typeof Code2> = {
  CODING: Code2, PLAIN_TEXT: FileText, MCQ_SINGLE: CircleDot,
  MCQ_MULTI: CheckSquare, FILE_BASED: Paperclip,
};

const TYPE_LABELS: Record<string, string> = {
  CODING: "Coding", PLAIN_TEXT: "Plain Text", MCQ_SINGLE: "MCQ (Single)",
  MCQ_MULTI: "MCQ (Multi)", FILE_BASED: "File-Based",
};

const DIFF_COLORS: Record<string, string> = {
  EASY: "bg-emerald-500", MEDIUM: "bg-amber-500", HARD: "bg-red-500",
};

export function QuestionBrowseClient({ questions }: { questions: Question[] }) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDiff, setFilterDiff] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (filterType && q.type !== filterType) return false;
      if (filterDiff && q.difficulty !== filterDiff) return false;
      if (search) {
        const s = search.toLowerCase();
        return q.title.toLowerCase().includes(s)
          || q.description?.toLowerCase().includes(s)
          || q.category?.toLowerCase().includes(s)
          || q.tags.some(t => t.toLowerCase().includes(s));
      }
      return true;
    });
  }, [questions, search, filterType, filterDiff]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    questions.forEach(q => q.category && cats.add(q.category));
    return Array.from(cats).sort();
  }, [questions]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Question Bank</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
            Browse {questions.length} questions · Prepare for your interviews
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-bold shadow-sm hover:bg-black dark:hover:bg-gray-100 transition"
        >
          <Plus className="w-4 h-4" />
          Create Question
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition dark:text-white placeholder:text-gray-400" />
        </div>
        {["", "CODING", "PLAIN_TEXT", "MCQ_SINGLE", "MCQ_MULTI", "FILE_BASED"].map((t) => (
          <button key={t} onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${filterType === t ? "bg-rose-600 text-white" : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700"}`}>
            {t ? TYPE_LABELS[t] : "All"}
          </button>
        ))}
        <div className="flex gap-1 ml-2">
          {["", "EASY", "MEDIUM", "HARD"].map((d) => (
            <button key={d} onClick={() => setFilterDiff(d)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${filterDiff === d ? "bg-rose-600 text-white" : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700"}`}>
              {d || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-400 dark:text-zinc-500">{filtered.length} question{filtered.length !== 1 ? "s" : ""}</p>

      {/* Question List */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <BookOpen className="w-10 h-10 text-gray-300 dark:text-zinc-600 mx-auto" />
          <p className="text-sm font-bold text-gray-500 dark:text-zinc-400">No questions match your filters</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => {
            const Icon = TYPE_ICONS[q.type] || FileText;
            const isOpen = expanded === q.id;
            return (
              <div key={q.id} className="rounded-xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 overflow-hidden transition-all">
                {/* Header row */}
                <button onClick={() => setExpanded(isOpen ? null : q.id)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-gray-500 dark:text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{q.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${DIFF_COLORS[q.difficulty]}`} />
                      <span className="text-[10px] text-gray-500 dark:text-zinc-500">{q.difficulty}</span>
                      {q.category && <span className="text-[10px] text-gray-400 dark:text-zinc-600">· {q.category}</span>}
                      {q.language && <span className="text-[10px] text-gray-400 dark:text-zinc-600">· {q.language}</span>}
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-zinc-800 pt-3 animate-in fade-in duration-150">
                    {/* Tags */}
                    {q.tags.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {q.tags.map(t => <span key={t} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400">{t}</span>)}
                      </div>
                    )}

                    {/* Description */}
                    <div className="text-xs text-gray-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                      {q.description}
                    </div>

                    {/* Starter code */}
                    {q.starterCode && (
                      <div className="rounded-lg bg-zinc-900 p-3">
                        <p className="text-[9px] font-bold text-zinc-500 uppercase mb-1">Starter Code</p>
                        <pre className="text-xs font-mono text-emerald-300 whitespace-pre-wrap">{q.starterCode}</pre>
                      </div>
                    )}

                    {/* Sample I/O */}
                    {(q.sampleInput || q.expectedOutput) && (
                      <div className="grid grid-cols-2 gap-2">
                        {q.sampleInput && (
                          <div className="rounded-lg bg-gray-50 dark:bg-zinc-800 p-2">
                            <p className="text-[9px] font-bold text-gray-500 dark:text-zinc-500 uppercase mb-1">Sample Input</p>
                            <pre className="text-[11px] font-mono text-gray-700 dark:text-zinc-300">{q.sampleInput}</pre>
                          </div>
                        )}
                        {q.expectedOutput && (
                          <div className="rounded-lg bg-gray-50 dark:bg-zinc-800 p-2">
                            <p className="text-[9px] font-bold text-gray-500 dark:text-zinc-500 uppercase mb-1">Expected Output</p>
                            <pre className="text-[11px] font-mono text-gray-700 dark:text-zinc-300">{q.expectedOutput}</pre>
                          </div>
                        )}
                      </div>
                    )}

                    {/* MCQ Options */}
                    {q.options && Array.isArray(q.options) && (
                      <div className="space-y-1.5">
                        <p className="text-[9px] font-bold text-gray-500 dark:text-zinc-500 uppercase">Options</p>
                        {(q.options as any[]).map((opt: any) => (
                          <div key={opt.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs ${opt.isCorrect ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-bold" : "bg-gray-50 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400"}`}>
                            <span className="font-bold uppercase w-4">{opt.id}.</span>
                            {opt.text}
                            {opt.isCorrect && <span className="ml-auto text-[9px]">✓ Correct</span>}
                          </div>
                        ))}
                        {q.explanation && (
                          <p className="text-[11px] text-gray-500 dark:text-zinc-500 mt-2 italic">💡 {q.explanation}</p>
                        )}
                      </div>
                    )}

                    {/* Attachment */}
                    {q.attachmentUrl && (
                      <a href={q.attachmentUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 transition">
                        <Paperclip className="w-3 h-3" /> {q.attachmentName || "Download attachment"}
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <QuestionBuilderModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  );
}
