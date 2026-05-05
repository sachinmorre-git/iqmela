"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Code Execution Service — Triple-fallback cascade:
//   1. Self-hosted Piston (set PISTON_API_URL)
//   2. Public Piston (emkc.org — ~100 req/day)
//   3. Judge0 CE (set JUDGE0_API_URL + JUDGE0_API_KEY, or defaults to public)
//   4. Graceful "unavailable" message
// ─────────────────────────────────────────────────────────────────────────────

const PISTON_SELF_HOSTED = process.env.PISTON_API_URL
  ? `${process.env.PISTON_API_URL.replace(/\/$/, "")}/api/v2/piston/execute`
  : null;
const PISTON_PUBLIC = "https://emkc.org/api/v2/piston/execute";

const JUDGE0_URL = process.env.JUDGE0_API_URL
  ? `${process.env.JUDGE0_API_URL.replace(/\/$/, "")}/submissions?base64_encoded=false&wait=true`
  : "https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=false&wait=true";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY ?? "";
const JUDGE0_IS_RAPIDAPI = !process.env.JUDGE0_API_URL; // Using public RapidAPI host

// Language → Piston runtime mapping
const LANGUAGE_MAP: Record<string, { language: string; version: string }> = {
  javascript: { language: "javascript", version: "18.15.0" },
  typescript: { language: "typescript", version: "5.0.3" },
  python:     { language: "python",     version: "3.10.0" },
  java:       { language: "java",       version: "15.0.2" },
  cpp:        { language: "c++",        version: "10.2.0" },
  go:         { language: "go",         version: "1.16.2" },
  rust:       { language: "rust",       version: "1.68.2" },
  ruby:       { language: "ruby",       version: "3.0.1" },
  csharp:     { language: "csharp",     version: "6.12.0" },
  sql:        { language: "sqlite3",    version: "3.36.0" },
};

// Language → Judge0 language_id mapping
// See: https://ce.judge0.com/#statuses-and-languages-language-list
const JUDGE0_LANGUAGE_MAP: Record<string, number> = {
  javascript: 63,  // JavaScript (Node.js 12.14.0)
  typescript: 74,  // TypeScript (3.7.4)
  python:     71,  // Python (3.8.1)
  java:       62,  // Java (OpenJDK 13.0.1)
  cpp:        54,  // C++ (GCC 9.2.0)
  go:         60,  // Go (1.13.5)
  rust:       73,  // Rust (1.40.0)
  ruby:       72,  // Ruby (2.7.0)
  csharp:     51,  // C# (Mono 6.6.0.161)
  sql:        82,  // SQL (SQLite 3.27.2)
};

export type ExecutionResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTimeMs: number;
  timedOut: boolean;
  /** Which engine actually ran the code */
  engine?: "piston-self" | "piston-public" | "judge0";
};

// ── Piston executor ──────────────────────────────────────────────────────────

async function executePiston(
  url: string,
  runtime: { language: string; version: string },
  code: string,
  stdin: string
): Promise<ExecutionResult | null> {
  try {
    const start = Date.now();
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        language: runtime.language,
        version: runtime.version,
        files: [{ name: "main", content: code }],
        stdin: stdin || "",
        run_timeout: 10000,
        compile_timeout: 10000,
        compile_memory_limit: 256_000_000,
        run_memory_limit: 256_000_000,
      }),
      signal: AbortSignal.timeout(15000), // 15s max wait
    });

    if (!response.ok) return null; // Signal to try next fallback

    const data = await response.json();
    const run = data.run || {};

    const engine = url === PISTON_PUBLIC ? "piston-public" : "piston-self";

    return {
      stdout: (run.stdout || "").slice(0, 65536),
      stderr: (run.stderr || "").slice(0, 65536),
      exitCode: run.code ?? -1,
      executionTimeMs: Date.now() - start,
      timedOut: run.signal === "SIGKILL",
      engine: engine as any,
    };
  } catch {
    return null; // Network error — try next fallback
  }
}

// ── Judge0 executor ──────────────────────────────────────────────────────────

async function executeJudge0(
  languageId: number,
  code: string,
  stdin: string
): Promise<ExecutionResult | null> {
  try {
    const start = Date.now();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // RapidAPI requires specific headers
    if (JUDGE0_IS_RAPIDAPI && JUDGE0_API_KEY) {
      headers["X-RapidAPI-Key"] = JUDGE0_API_KEY;
      headers["X-RapidAPI-Host"] = "judge0-ce.p.rapidapi.com";
    } else if (JUDGE0_API_KEY) {
      headers["X-Auth-Token"] = JUDGE0_API_KEY;
    }

    const response = await fetch(JUDGE0_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        language_id: languageId,
        source_code: code,
        stdin: stdin || "",
        cpu_time_limit: 10,
        wall_time_limit: 15,
        memory_limit: 256000,
      }),
      signal: AbortSignal.timeout(20000), // 20s — Judge0 can be slower
    });

    if (!response.ok) return null;

    const data = await response.json();

    // Judge0 status IDs: 3 = Accepted, 5 = TLE, 6 = Compilation Error, etc.
    const timedOut = data.status?.id === 5;

    return {
      stdout: (data.stdout || "").slice(0, 65536),
      stderr: (data.stderr || data.compile_output || "").slice(0, 65536),
      exitCode: data.exit_code ?? (data.status?.id === 3 ? 0 : 1),
      executionTimeMs: Date.now() - start,
      timedOut,
      engine: "judge0",
    };
  } catch {
    return null;
  }
}

// ── Main Action ──────────────────────────────────────────────────────────────

export async function executeCodeAction(
  code: string,
  language: string,
  stdin?: string
): Promise<{ success: true; result: ExecutionResult } | { success: false; error: string }> {
  const runtime = LANGUAGE_MAP[language];
  if (!runtime) return { success: false, error: `Unsupported language: ${language}` };
  if (!code.trim()) return { success: false, error: "No code to execute" };

  // ── Tier 1: Self-hosted Piston ──────────────────────────────────────────
  if (PISTON_SELF_HOSTED) {
    const result = await executePiston(PISTON_SELF_HOSTED, runtime, code, stdin || "");
    if (result) return { success: true, result };
    console.warn("[executeCode] Self-hosted Piston failed — falling back to public Piston");
  }

  // ── Tier 2: Public Piston ──────────────────────────────────────────────
  {
    const result = await executePiston(PISTON_PUBLIC, runtime, code, stdin || "");
    if (result) return { success: true, result };
    console.warn("[executeCode] Public Piston failed — falling back to Judge0");
  }

  // ── Tier 3: Judge0 CE ──────────────────────────────────────────────────
  const judge0LangId = JUDGE0_LANGUAGE_MAP[language];
  if (judge0LangId) {
    const result = await executeJudge0(judge0LangId, code, stdin || "");
    if (result) return { success: true, result };
    console.warn("[executeCode] Judge0 also failed — all execution engines unavailable");
  }

  // ── Tier 4: Graceful failure ───────────────────────────────────────────
  return {
    success: false,
    error: "Code execution is temporarily unavailable. Your code has been saved — please try again in a moment.",
  };
}

export async function getSupportedLanguages() {
  return Object.keys(LANGUAGE_MAP).map((key) => ({
    id: key,
    label: key === "cpp" ? "C++" : key === "csharp" ? "C#" : key.charAt(0).toUpperCase() + key.slice(1),
  }));
}

