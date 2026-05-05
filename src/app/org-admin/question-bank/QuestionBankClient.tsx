"use client";

import { useState, useTransition, useCallback, useEffect } from "react";
import {
  Code2, FileText, CircleDot, CheckSquare, Paperclip,
  Plus, Search, Sparkles, Trash2, Loader2, X, ChevronDown,
} from "lucide-react";
import {
  listQuestionsAction, createQuestionAction, deleteQuestionAction,
  aiGenerateQuestionAction, type QuestionType, type McqOption,
} from "./actions";

const TYPE_CONFIG: Record<QuestionType, { icon: typeof Code2; label: string; color: string }> = {
  CODING:     { icon: Code2,       label: "Coding",       color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  PLAIN_TEXT: { icon: FileText,    label: "Plain Text",   color: "text-blue-400 bg-blue-400/10 border-blue-400/30" },
  MCQ_SINGLE: { icon: CircleDot,   label: "MCQ (Single)", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30" },
  MCQ_MULTI:  { icon: CheckSquare, label: "MCQ (Multi)",  color: "text-pink-400 bg-pink-400/10 border-pink-400/30" },
  FILE_BASED: { icon: Paperclip,   label: "File-Based",   color: "text-amber-400 bg-amber-400/10 border-amber-400/30" },
};

const DIFF_COLORS = { EASY: "bg-emerald-500", MEDIUM: "bg-amber-500", HARD: "bg-red-500" };

export function QuestionBankClient() {
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [filterType, setFilterType] = useState<string>("");
  const [filterDiff, setFilterDiff] = useState<string>("");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadQuestions = useCallback(() => {
    setLoading(true);
    listQuestionsAction({
      type: filterType || undefined,
      difficulty: filterDiff || undefined,
      search: search || undefined,
    }).then((res) => {
      if (res.success) setQuestions(res.data);
      setLoading(false);
    });
  }, [filterType, filterDiff, search]);

  useEffect(() => { loadQuestions(); }, [loadQuestions]);

  const handleDelete = (id: string) => {
    if (!confirm("Delete this question?")) return;
    startTransition(async () => {
      await deleteQuestionAction(id);
      loadQuestions();
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Question Bank</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">{questions.length} questions</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAI(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-pink-600 to-rose-600 text-white text-xs font-bold shadow-lg shadow-pink-500/20 hover:shadow-pink-500/30 transition-all hover:scale-[1.02]">
            <Sparkles className="w-3.5 h-3.5" /> AI Generate
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold shadow-lg hover:scale-[1.02] transition-all">
            <Plus className="w-3.5 h-3.5" /> New Question
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition dark:text-white placeholder:text-gray-400" />
        </div>
        {(["", "CODING", "PLAIN_TEXT", "MCQ_SINGLE", "MCQ_MULTI", "FILE_BASED"] as const).map((t) => (
          <button key={t} onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${filterType === t ? "bg-rose-600 text-white" : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700"}`}>
            {t ? TYPE_CONFIG[t as QuestionType].label : "All"}
          </button>
        ))}
        <div className="flex gap-1 ml-2">
          {(["", "EASY", "MEDIUM", "HARD"] as const).map((d) => (
            <button key={d} onClick={() => setFilterDiff(d)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${filterDiff === d ? "bg-rose-600 text-white" : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700"}`}>
              {d || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Question List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-20 space-y-3">
          <Code2 className="w-10 h-10 text-gray-300 dark:text-zinc-600 mx-auto" />
          <p className="text-sm font-bold text-gray-500 dark:text-zinc-400">No questions yet</p>
          <p className="text-xs text-gray-400 dark:text-zinc-500">Create your first question or generate one with AI</p>
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q) => {
            const cfg = TYPE_CONFIG[q.type as QuestionType] || TYPE_CONFIG.PLAIN_TEXT;
            const Icon = cfg.icon;
            return (
              <div key={q.id} className="group flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 hover:border-rose-200 dark:hover:border-rose-800/40 transition-all">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center border ${cfg.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{q.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${DIFF_COLORS[q.difficulty as keyof typeof DIFF_COLORS]}`} />
                    <span className="text-[10px] text-gray-500 dark:text-zinc-500">{q.difficulty}</span>
                    {q.category && <span className="text-[10px] text-gray-400 dark:text-zinc-600">· {q.category}</span>}
                    {q.isFromSeedBank && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40">Seed</span>}
                    <span className="text-[10px] text-gray-400 dark:text-zinc-600">· Used {q.usageCount}×</span>
                  </div>
                </div>
                <button onClick={() => handleDelete(q.id)} className="p-1.5 rounded-lg text-gray-300 dark:text-zinc-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && <CreateQuestionModal onClose={() => setShowCreate(false)} onCreated={loadQuestions} />}
      {showAI && <AIGenerateModal onClose={() => setShowAI(false)} onCreated={loadQuestions} />}
    </div>
  );
}

// ── Create Question Modal ────────────────────────────────────────────────────

function CreateQuestionModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<QuestionType>("CODING");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");
  const [category, setCategory] = useState("");
  const [language, setLanguage] = useState("javascript");
  const [starterCode, setStarterCode] = useState("");
  const [sampleInput, setSampleInput] = useState("");
  const [expectedOutput, setExpectedOutput] = useState("");
  const [options, setOptions] = useState<McqOption[]>([
    { id: "a", text: "", isCorrect: false },
    { id: "b", text: "", isCorrect: false },
  ]);
  const [explanation, setExplanation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const addOption = () => {
    const id = String.fromCharCode(97 + options.length);
    setOptions([...options, { id, text: "", isCorrect: false }]);
  };

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createQuestionAction({
        type, title, description, difficulty, category: category || undefined,
        language: type === "CODING" ? language : undefined,
        starterCode: type === "CODING" ? starterCode : undefined,
        sampleInput: type === "CODING" ? sampleInput : undefined,
        expectedOutput: type === "CODING" ? expectedOutput : undefined,
        options: type.startsWith("MCQ") ? options : undefined,
        explanation: type.startsWith("MCQ") ? explanation : undefined,
      });
      if (res.success) { onCreated(); onClose(); }
      else setError(res.error);
    });
  };

  const inputCls = "w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition dark:text-white placeholder:text-gray-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-black text-gray-900 dark:text-white">New Question</h2>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Type Selector */}
          <div className="grid grid-cols-5 gap-2">
            {(Object.entries(TYPE_CONFIG) as [QuestionType, typeof TYPE_CONFIG.CODING][]).map(([key, cfg]) => {
              const Icon = cfg.icon;
              return (
                <button key={key} onClick={() => setType(key)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all text-center ${type === key ? "border-rose-500 bg-rose-50 dark:bg-rose-900/20" : "border-gray-100 dark:border-zinc-800 hover:border-gray-200"}`}>
                  <Icon className={`w-4 h-4 ${type === key ? "text-rose-500" : "text-gray-400"}`} />
                  <span className={`text-[10px] font-bold ${type === key ? "text-rose-600 dark:text-rose-400" : "text-gray-500"}`}>{cfg.label}</span>
                </button>
              );
            })}
          </div>

          {/* Difficulty */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 w-16">Difficulty</span>
            {(["EASY", "MEDIUM", "HARD"] as const).map((d) => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${difficulty === d
                  ? d === "EASY" ? "bg-emerald-500 text-white" : d === "MEDIUM" ? "bg-amber-500 text-white" : "bg-red-500 text-white"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-500"}`}>
                {d}
              </button>
            ))}
          </div>

          {/* Common fields */}
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Question title" className={inputCls} />
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Problem description (Markdown supported)" className={`${inputCls} resize-none`} />
          <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Category (e.g., Arrays, System Design)" className={inputCls} />

          {/* Coding fields */}
          {type === "CODING" && (
            <div className="space-y-3 p-4 rounded-xl bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800">
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className={inputCls}>
                {[
                  { value: "javascript", label: "JavaScript" },
                  { value: "typescript", label: "TypeScript" },
                  { value: "python", label: "Python" },
                  { value: "java", label: "Java" },
                  { value: "cpp", label: "C++" },
                  { value: "csharp", label: "C#" },
                  { value: "go", label: "Go" },
                  { value: "rust", label: "Rust" },
                  { value: "ruby", label: "Ruby" },
                  { value: "sql", label: "SQL" },
                  { value: "swift", label: "Swift" },
                  { value: "kotlin", label: "Kotlin" },
                  { value: "php", label: "PHP" },
                  { value: "scala", label: "Scala" },
                  { value: "shell", label: "Shell / Bash" },
                  { value: "r", label: "R" },
                  { value: "other", label: "Other" },
                ].map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <textarea value={starterCode} onChange={(e) => setStarterCode(e.target.value)} rows={4} placeholder="Starter code template..." className={`${inputCls} font-mono text-xs resize-none`} />
              <div className="grid grid-cols-2 gap-3">
                <textarea value={sampleInput} onChange={(e) => setSampleInput(e.target.value)} rows={2} placeholder="Sample input (stdin)" className={`${inputCls} font-mono text-xs resize-none`} />
                <textarea value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} rows={2} placeholder="Expected output" className={`${inputCls} font-mono text-xs resize-none`} />
              </div>
            </div>
          )}

          {/* MCQ fields */}
          {(type === "MCQ_SINGLE" || type === "MCQ_MULTI") && (
            <div className="space-y-3 p-4 rounded-xl bg-gray-50 dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Options — {type === "MCQ_SINGLE" ? "select 1 correct" : "select multiple correct"}</p>
              {options.map((opt, i) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <button onClick={() => {
                    const updated = [...options];
                    if (type === "MCQ_SINGLE") updated.forEach(o => o.isCorrect = false);
                    updated[i].isCorrect = !updated[i].isCorrect;
                    setOptions(updated);
                  }} className={`w-6 h-6 rounded-${type === "MCQ_SINGLE" ? "full" : "md"} border-2 flex items-center justify-center transition ${opt.isCorrect ? "border-emerald-500 bg-emerald-500 text-white" : "border-gray-300 dark:border-zinc-600"}`}>
                    {opt.isCorrect && <span className="text-xs">✓</span>}
                  </button>
                  <input value={opt.text} onChange={(e) => { const u = [...options]; u[i].text = e.target.value; setOptions(u); }}
                    placeholder={`Option ${opt.id.toUpperCase()}`} className={`${inputCls} flex-1`} />
                  {options.length > 2 && (
                    <button onClick={() => setOptions(options.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500 transition"><X className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              ))}
              {options.length < 8 && (
                <button onClick={addOption} className="text-xs font-bold text-rose-600 hover:text-rose-700 transition">+ Add Option</button>
              )}
              <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} rows={2} placeholder="Explanation (why the correct answer is right)" className={`${inputCls} resize-none`} />
            </div>
          )}

          {/* Error */}
          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          {/* Submit */}
          <button onClick={handleSubmit} disabled={isPending || !title.trim() || !description.trim()}
            className="w-full py-3 rounded-2xl text-sm font-bold bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg shadow-pink-500/20 disabled:opacity-50 transition-all hover:scale-[1.01] flex items-center justify-center gap-2">
            {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : "Save Question"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AI Generate Modal ────────────────────────────────────────────────────────

function AIGenerateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [role, setRole] = useState("");
  const [techStack, setTechStack] = useState("");
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");
  const [type, setType] = useState<QuestionType>("CODING");
  const [count, setCount] = useState(3);
  const [generated, setGenerated] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();
  const [saving, startSaving] = useTransition();
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = () => {
    if (!role.trim()) { setError("Enter a role"); return; }
    setError(null);
    setGenerated([]);
    setSavedIds(new Set());
    startTransition(async () => {
      const res = await aiGenerateQuestionAction({ role, difficulty, type, techStack: techStack || undefined, count });
      if (res.success) setGenerated(Array.isArray(res.data) ? res.data : [res.data]);
      else setError(res.error);
    });
  };

  const handleSaveOne = (index: number) => {
    const q = generated[index];
    if (!q) return;
    startSaving(async () => {
      const res = await createQuestionAction({
        type, title: q.title, description: q.description,
        difficulty, category: q.category,
        tags: q.tags, language: q.language,
        starterCode: q.starterCode, sampleInput: q.sampleInput,
        expectedOutput: q.expectedOutput, options: q.options,
        explanation: q.explanation,
      });
      if (res.success) {
        setSavedIds((prev) => new Set([...prev, index]));
        onCreated();
      } else setError(res.error || "Save failed");
    });
  };

  const handleSaveAll = () => {
    startSaving(async () => {
      for (let i = 0; i < generated.length; i++) {
        if (savedIds.has(i)) continue;
        const q = generated[i];
        const res = await createQuestionAction({
          type, title: q.title, description: q.description,
          difficulty, category: q.category,
          tags: q.tags, language: q.language,
          starterCode: q.starterCode, sampleInput: q.sampleInput,
          expectedOutput: q.expectedOutput, options: q.options,
          explanation: q.explanation,
        });
        if (res.success) setSavedIds((prev) => new Set([...prev, i]));
      }
      onCreated();
    });
  };

  const allSaved = generated.length > 0 && savedIds.size >= generated.length;

  const inputCls = "w-full rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 transition dark:text-white placeholder:text-gray-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-100 dark:border-zinc-800 animate-in zoom-in-95 duration-200">
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md border-b border-gray-100 dark:border-zinc-800 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-pink-500" />
            <h2 className="text-lg font-black text-gray-900 dark:text-white">AI Generate</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role (e.g., Senior Data Engineer)" className={inputCls} />
          <input value={techStack} onChange={(e) => setTechStack(e.target.value)} placeholder="Tech stack (optional: Python, Kafka, Spark...)" className={inputCls} />

          {/* Difficulty */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-gray-500 dark:text-zinc-400 w-16">Difficulty</span>
            {(["EASY", "MEDIUM", "HARD"] as const).map(d => (
              <button key={d} onClick={() => setDifficulty(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${difficulty === d
                  ? d === "EASY" ? "bg-emerald-500 text-white" : d === "MEDIUM" ? "bg-amber-500 text-white" : "bg-red-500 text-white"
                  : "bg-gray-100 dark:bg-zinc-800 text-gray-500"}`}>{d}</button>
            ))}
          </div>

          {/* Type */}
          <div className="flex gap-1.5 flex-wrap">
            {(Object.keys(TYPE_CONFIG) as QuestionType[]).map(t => (
              <button key={t} onClick={() => setType(t)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${type === t ? "bg-rose-600 text-white" : "bg-gray-100 dark:bg-zinc-800 text-gray-500"}`}>
                {TYPE_CONFIG[t].label}
              </button>
            ))}
          </div>

          {/* Quantity Selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-500 dark:text-zinc-400">Questions</span>
            <div className="flex items-center bg-gray-100 dark:bg-zinc-800 rounded-xl border border-gray-200 dark:border-zinc-700 overflow-hidden">
              <button onClick={() => setCount(Math.max(1, count - 1))} disabled={count <= 1}
                className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-zinc-700 transition disabled:opacity-30 font-bold text-lg">
                −
              </button>
              <span className="w-10 text-center text-sm font-black text-gray-900 dark:text-white tabular-nums">{count}</span>
              <button onClick={() => setCount(Math.min(10, count + 1))} disabled={count >= 10}
                className="w-9 h-9 flex items-center justify-center text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-zinc-700 transition disabled:opacity-30 font-bold text-lg">
                +
              </button>
            </div>
            <span className="text-[10px] text-gray-400 dark:text-zinc-500">max 10</span>
          </div>

          {/* Generate Button */}
          <button onClick={handleGenerate} disabled={isPending || !role.trim()}
            className="w-full py-3 rounded-2xl text-sm font-bold bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-lg shadow-pink-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating {count} question{count > 1 ? "s" : ""}...</> : <><Sparkles className="w-4 h-4" /> Generate {count} Question{count > 1 ? "s" : ""}</>}
          </button>

          {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

          {/* Generated Questions List */}
          {generated.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-500 dark:text-zinc-400">{generated.length} generated · {savedIds.size} saved</p>
                {!allSaved && generated.length > 1 && (
                  <button onClick={handleSaveAll} disabled={saving}
                    className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 transition flex items-center gap-1">
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "✓"} Save All
                  </button>
                )}
              </div>

              {generated.map((q, i) => (
                <div key={i} className={`p-3 rounded-xl border transition-all ${savedIds.has(i) ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/40" : "bg-pink-50/50 dark:bg-pink-900/10 border-pink-200 dark:border-pink-800/40"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xs font-black text-gray-900 dark:text-white truncate">{q.title}</h3>
                      <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5 line-clamp-2">{q.description?.slice(0, 120)}...</p>
                      {q.tags && (
                        <div className="flex gap-1 flex-wrap mt-1.5">
                          {q.tags.slice(0, 4).map((t: string) => <span key={t} className="text-[8px] font-bold px-1 py-0.5 rounded bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400">{t}</span>)}
                        </div>
                      )}
                    </div>
                    {savedIds.has(i) ? (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-1 rounded-lg shrink-0">Saved ✓</span>
                    ) : (
                      <button onClick={() => handleSaveOne(i)} disabled={saving}
                        className="text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-lg transition shrink-0">
                        Save
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
