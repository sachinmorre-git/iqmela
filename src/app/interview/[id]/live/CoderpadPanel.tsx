"use client";

import { useState, useCallback, useTransition, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Play, ChevronDown, Terminal, Clock, X, Loader2,
  Maximize2, Minimize2, Copy, Check, RotateCcw, BookOpen, Search,
} from "lucide-react";
import { executeCodeAction, type ExecutionResult } from "./execute-code";
import { fetchQuestionsForCoderpad, trackQuestionUsage } from "./question-actions";

// Lazy-load Monaco (2MB) — only when coderpad is opened
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// ── Language Config ──────────────────────────────────────────────────────────

const LANGUAGES = [
  { id: "javascript",  label: "JavaScript",  icon: "JS",  color: "text-yellow-400",  defaultCode: '// JavaScript\nconsole.log("Hello, World!");' },
  { id: "typescript",  label: "TypeScript",  icon: "TS",  color: "text-blue-400",    defaultCode: '// TypeScript\nconst greet = (name: string): string => `Hello, ${name}!`;\nconsole.log(greet("World"));' },
  { id: "python",      label: "Python",      icon: "PY",  color: "text-emerald-400", defaultCode: '# Python\nprint("Hello, World!")' },
  { id: "java",        label: "Java",        icon: "JV",  color: "text-orange-400",  defaultCode: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, World!");\n  }\n}' },
  { id: "cpp",         label: "C++",         icon: "C+",  color: "text-pink-400",    defaultCode: '#include <iostream>\nusing namespace std;\n\nint main() {\n  cout << "Hello, World!" << endl;\n  return 0;\n}' },
  { id: "python",      label: "Python",      icon: "PY",  color: "text-emerald-400", defaultCode: '# Python\nprint("Hello, World!")' },
  { id: "go",          label: "Go",          icon: "GO",  color: "text-cyan-400",    defaultCode: 'package main\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello, World!")\n}' },
  { id: "rust",        label: "Rust",        icon: "RS",  color: "text-orange-300",  defaultCode: 'fn main() {\n  println!("Hello, World!");\n}' },
  { id: "ruby",        label: "Ruby",        icon: "RB",  color: "text-red-400",     defaultCode: '# Ruby\nputs "Hello, World!"' },
];

// Deduplicate (python appears twice above - remove duplicate)
const UNIQUE_LANGUAGES = LANGUAGES.filter((l, i, arr) => arr.findIndex(x => x.id === l.id) === i);

// ── Monaco language ID mapping ───────────────────────────────────────────────
const MONACO_LANG: Record<string, string> = {
  javascript: "javascript", typescript: "typescript", python: "python",
  java: "java", cpp: "cpp", go: "go", rust: "rust", ruby: "ruby",
  csharp: "csharp", sql: "sql",
};

// ── Component ────────────────────────────────────────────────────────────────

export function CoderpadPanel({ onClose }: { onClose: () => void }) {
  const [language, setLanguage] = useState(UNIQUE_LANGUAGES[0]);
  const [code, setCode] = useState(UNIQUE_LANGUAGES[0].defaultCode);
  const [stdin, setStdin] = useState("");
  const [showStdin, setShowStdin] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);

  // Question picker
  const [showQuestions, setShowQuestions] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [qSearch, setQSearch] = useState("");
  const [qLoading, setQLoading] = useState(false);

  // Execution
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll output
  useEffect(() => {
    if (result && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [result]);

  const handleLanguageChange = useCallback((lang: typeof UNIQUE_LANGUAGES[0]) => {
    setLanguage(lang);
    setCode(lang.defaultCode);
    setShowLangMenu(false);
    setResult(null);
    setExecError(null);
  }, []);

  const handleRun = useCallback(() => {
    setExecError(null);
    startTransition(async () => {
      const res = await executeCodeAction(code, language.id, stdin || undefined);
      if (res.success) {
        setResult(res.result);
      } else {
        setExecError(res.error);
      }
    });
  }, [code, language.id, stdin]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  const handleReset = useCallback(() => {
    setCode(language.defaultCode);
    setResult(null);
    setExecError(null);
    setActiveQuestion(null);
  }, [language]);

  // Question picker
  const loadQuestions = useCallback(async (search?: string) => {
    setQLoading(true);
    const data = await fetchQuestionsForCoderpad(search || undefined);
    setQuestions(data);
    setQLoading(false);
  }, []);

  useEffect(() => {
    if (showQuestions && questions.length === 0) loadQuestions();
  }, [showQuestions, questions.length, loadQuestions]);

  const handleSelectQuestion = useCallback((q: any) => {
    // Auto-switch language if coding question
    if (q.language) {
      const match = UNIQUE_LANGUAGES.find(l => l.id === q.language);
      if (match) setLanguage(match);
    }
    // Load starter code or description
    if (q.starterCode) setCode(q.starterCode);
    else if (q.type === "CODING") setCode(`// ${q.title}\n// ${q.description?.slice(0, 200)}\n\n`);
    // Load sample input
    if (q.sampleInput) { setStdin(q.sampleInput); setShowStdin(true); }
    setActiveQuestion(q.title);
    setShowQuestions(false);
    setResult(null);
    setExecError(null);
    trackQuestionUsage(q.id);
  }, []);

  return (
    <div className={`flex flex-col bg-[#1e1e1e] rounded-2xl border border-zinc-700/50 overflow-hidden shadow-2xl transition-all duration-300 ${
      isFullscreen ? "fixed inset-4 z-50" : "h-full"
    }`}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#252526] border-b border-zinc-700/50">
        <div className="flex items-center gap-2">
          {/* Traffic lights */}
          <div className="flex gap-1.5 mr-2">
            <button onClick={onClose} className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-400 transition-colors" title="Close" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>

          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setShowLangMenu(!showLangMenu)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-600/50 text-xs font-bold text-zinc-300 transition-colors"
            >
              <span className={`text-[10px] font-black ${language.color}`}>{language.icon}</span>
              {language.label}
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </button>

            {showLangMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowLangMenu(false)} />
                <div className="absolute top-full left-0 mt-1 z-20 w-44 bg-zinc-800 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  {UNIQUE_LANGUAGES.map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => handleLanguageChange(lang)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors ${
                        lang.id === language.id
                          ? "bg-rose-600/20 text-rose-400"
                          : "text-zinc-300 hover:bg-zinc-700"
                      }`}
                    >
                      <span className={`text-[10px] font-black w-5 ${lang.color}`}>{lang.icon}</span>
                      {lang.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowQuestions(!showQuestions)}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-colors ${showQuestions ? "bg-rose-600/20 text-rose-400" : "text-zinc-400 hover:text-white hover:bg-zinc-700"}`}
            title="Question Bank">
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Questions</span>
          </button>
          <div className="w-px h-5 bg-zinc-700 mx-1" />
          <button onClick={handleCopy} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors" title="Copy code">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button onClick={handleReset} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors" title="Reset">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors" title="Fullscreen">
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-400 hover:bg-zinc-700 transition-colors" title="Close">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Active question banner */}
      {activeQuestion && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-600/10 border-b border-rose-600/20">
          <BookOpen className="w-3 h-3 text-rose-400" />
          <span className="text-[11px] font-bold text-rose-300 truncate flex-1">{activeQuestion}</span>
          <button onClick={() => setActiveQuestion(null)} className="text-rose-400/60 hover:text-rose-300 transition"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* ── Content: Editor + Question Panel side-by-side ──────────────── */}
      <div className="flex-1 min-h-0 flex relative">
        {/* Editor */}
        <div className={`${showQuestions ? "flex-1" : "w-full"} min-w-0 transition-all`}>
          <MonacoEditor
          height="100%"
          language={MONACO_LANG[language.id] || "plaintext"}
          value={code}
          onChange={(val) => setCode(val ?? "")}
          theme="vs-dark"
          options={{
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 12, bottom: 12 },
            lineNumbers: "on",
            renderLineHighlight: "gutter",
            bracketPairColorization: { enabled: true },
            automaticLayout: true,
            tabSize: 2,
            wordWrap: "on",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
          }}
        />
        </div>

        {/* Question Picker Panel */}
        {showQuestions && (
          <div className="w-64 bg-[#1a1a1a] border-l border-zinc-700/50 flex flex-col overflow-hidden animate-in slide-in-from-right-4 duration-200">
            <div className="px-3 py-2 border-b border-zinc-800">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
                <input
                  value={qSearch}
                  onChange={(e) => { setQSearch(e.target.value); loadQuestions(e.target.value); }}
                  placeholder="Search questions..."
                  className="w-full pl-7 pr-2 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700/50 text-[11px] text-zinc-300 focus:outline-none focus:border-rose-600 transition placeholder:text-zinc-600"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {qLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-4 h-4 text-zinc-500 animate-spin" /></div>
              ) : questions.length === 0 ? (
                <div className="text-center py-8 px-3">
                  <BookOpen className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                  <p className="text-[10px] text-zinc-600">No questions found</p>
                  <p className="text-[9px] text-zinc-700 mt-0.5">Add questions in the Question Bank</p>
                </div>
              ) : (
                questions.map((q) => (
                  <button key={q.id} onClick={() => handleSelectQuestion(q)}
                    className="w-full text-left px-3 py-2.5 border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors group">
                    <p className="text-[11px] font-bold text-zinc-300 group-hover:text-white truncate">{q.title}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`w-1.5 h-1.5 rounded-full ${q.difficulty === "EASY" ? "bg-emerald-500" : q.difficulty === "MEDIUM" ? "bg-amber-500" : "bg-red-500"}`} />
                      <span className="text-[9px] text-zinc-500">{q.difficulty}</span>
                      {q.category && <span className="text-[9px] text-zinc-600">· {q.category}</span>}
                      {q.language && <span className="text-[9px] text-zinc-600 ml-auto">{q.language}</span>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Run Bar ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#252526] border-t border-zinc-700/50">
        <button
          onClick={handleRun}
          disabled={isPending || !code.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          {isPending ? "Running..." : "Run ▶"}
        </button>

        <button
          onClick={() => setShowStdin(!showStdin)}
          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
            showStdin ? "bg-zinc-700 text-zinc-200" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          Stdin
        </button>

        {result && (
          <div className="flex items-center gap-3 ml-auto text-[10px] font-mono">
            <span className="flex items-center gap-1 text-zinc-400">
              <Clock className="w-3 h-3" />
              {result.executionTimeMs}ms
            </span>
            <span className={`font-bold ${result.exitCode === 0 ? "text-emerald-400" : "text-red-400"}`}>
              exit: {result.exitCode}
            </span>
          </div>
        )}
      </div>

      {/* ── Stdin Input ────────────────────────────────────────────────── */}
      {showStdin && (
        <div className="px-3 py-2 bg-[#1a1a2e] border-t border-zinc-700/30">
          <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1 block">Standard Input</label>
          <textarea
            value={stdin}
            onChange={(e) => setStdin(e.target.value)}
            rows={2}
            placeholder="Enter input data..."
            className="w-full bg-zinc-900 text-zinc-300 text-xs font-mono rounded-lg border border-zinc-700/50 px-3 py-2 resize-none focus:outline-none focus:border-emerald-600 transition-colors placeholder:text-zinc-600"
          />
        </div>
      )}

      {/* ── Output Console ─────────────────────────────────────────────── */}
      <div className="border-t border-zinc-700/50 bg-[#1a1a1a]">
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-800">
          <Terminal className="w-3 h-3 text-zinc-500" />
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Console</span>
          {result?.timedOut && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-900/30 text-red-400 border border-red-800/50">TIMEOUT</span>
          )}
        </div>
        <div ref={outputRef} className="px-3 py-2 max-h-32 overflow-y-auto font-mono text-xs">
          {execError && (
            <p className="text-red-400">{execError}</p>
          )}
          {result?.stderr && (
            <pre className="text-red-400 whitespace-pre-wrap break-words">{result.stderr}</pre>
          )}
          {result?.stdout ? (
            <pre className="text-emerald-300 whitespace-pre-wrap break-words">{result.stdout}</pre>
          ) : !execError && !result?.stderr && (
            <p className="text-zinc-600 italic">Output will appear here after running code...</p>
          )}
        </div>
      </div>

      {/* Fullscreen backdrop */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm -z-10" onClick={() => setIsFullscreen(false)} />
      )}
    </div>
  );
}
