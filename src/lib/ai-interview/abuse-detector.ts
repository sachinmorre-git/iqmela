/**
 * src/lib/ai-interview/abuse-detector.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Detects potential AI-assisted cheating during AI interviews.
 *
 * Heuristics:
 *   1. Paste detection — answer arrived via clipboard, not typing
 *   2. Impossible speed — answer delivered faster than human speech/typing
 *   3. Response uniformity — LLM outputs have suspiciously uniform structure
 *   4. Tab-switch correlation — tab switch right before answer submission
 *   5. Length anomaly — abnormally long answers relative to question complexity
 *
 * Outputs a normalized abuse confidence score (0–100):
 *   0–20:  Clean (no flags)
 *   21–50: Suspicious (logged, no action)
 *   51–80: Likely AI-assisted (flagged in report)
 *   81–100: Almost certainly AI-generated (hard flag + admin alert)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface AbuseSignals {
  /** How the answer was captured: "voice" | "typed" | "pasted" */
  inputMethod?: "voice" | "typed" | "pasted";
  /** Time in milliseconds the candidate spent answering */
  answerDurationMs?: number;
  /** Number of words in the answer */
  wordCount?: number;
  /** Number of tab switches that occurred during this question */
  tabSwitchesDuringQuestion?: number;
  /** Number of paste events detected during this question */
  pasteEventsDuringQuestion?: number;
  /** Whether the answer appeared all at once (not incrementally) */
  appearedInstantly?: boolean;
  /** The answer text itself (for structure analysis) */
  answerText?: string;
  /** The question that was asked (for context) */
  questionText?: string;
}

export interface AbuseAnalysis {
  /** Overall confidence score (0–100) */
  score: number;
  /** Human-readable risk level */
  level: "clean" | "suspicious" | "likely_ai" | "definite_ai";
  /** Individual flag details */
  flags: AbuseFlag[];
}

interface AbuseFlag {
  type: string;
  description: string;
  weight: number; // How much this contributes to the score (0–30)
}

// ── Average human speech/typing benchmarks ──────────────────────────────────
const AVG_SPEECH_WPM = 130;          // Average spoken words per minute
const AVG_TYPING_WPM = 40;           // Average typing words per minute
const MIN_THINKING_TIME_MS = 3000;   // At least 3s to think before answering

// ── Structural patterns common in LLM outputs ──────────────────────────────
const LLM_PATTERNS = [
  /^(Sure|Certainly|Absolutely|Of course|Great question)[,!.]/i,
  /\b(In summary|To summarize|In conclusion|Overall)\b/i,
  /\b(First(?:ly)?|Second(?:ly)?|Third(?:ly)?|Finally)\b[\s\S]*\b(First(?:ly)?|Second(?:ly)?|Third(?:ly)?|Finally)\b/i,
  /\b(key (takeaway|point|aspect)|important to note|worth mentioning)\b/i,
  /\b(As an AI|As a language model|I don't have personal)\b/i, // Dead giveaway
];

// ── Analyze a single answer for abuse ───────────────────────────────────────

export function analyzeAnswer(signals: AbuseSignals): AbuseAnalysis {
  const flags: AbuseFlag[] = [];

  // ── 1. Paste detection ──────────────────────────────────────────────────
  if (signals.inputMethod === "pasted" || (signals.pasteEventsDuringQuestion ?? 0) > 0) {
    flags.push({
      type: "PASTE_DETECTED",
      description: `Answer was pasted (${signals.pasteEventsDuringQuestion ?? 1} paste events)`,
      weight: 25,
    });
  }

  // ── 2. Impossible speed ─────────────────────────────────────────────────
  if (signals.answerDurationMs && signals.wordCount) {
    const wpm = (signals.wordCount / signals.answerDurationMs) * 60_000;
    const expectedWpm = signals.inputMethod === "voice" ? AVG_SPEECH_WPM : AVG_TYPING_WPM;

    if (wpm > expectedWpm * 3) {
      flags.push({
        type: "IMPOSSIBLE_SPEED",
        description: `Answer delivered at ${Math.round(wpm)} WPM (expected ~${expectedWpm} for ${signals.inputMethod ?? "unknown"})`,
        weight: 30,
      });
    } else if (wpm > expectedWpm * 2) {
      flags.push({
        type: "UNUSUAL_SPEED",
        description: `Answer delivered at ${Math.round(wpm)} WPM (above normal)`,
        weight: 15,
      });
    }
  }

  // ── 3. Instant appearance ───────────────────────────────────────────────
  if (signals.appearedInstantly && (signals.wordCount ?? 0) > 20) {
    flags.push({
      type: "INSTANT_ANSWER",
      description: "Long answer appeared all at once without typing/speech progression",
      weight: 20,
    });
  }

  // ── 4. No thinking time ─────────────────────────────────────────────────
  if (
    signals.answerDurationMs &&
    signals.answerDurationMs < MIN_THINKING_TIME_MS &&
    (signals.wordCount ?? 0) > 30
  ) {
    flags.push({
      type: "NO_THINKING_TIME",
      description: `Answered in ${Math.round(signals.answerDurationMs / 1000)}s with ${signals.wordCount} words — no human reflection time`,
      weight: 20,
    });
  }

  // ── 5. Tab-switch correlation ───────────────────────────────────────────
  if ((signals.tabSwitchesDuringQuestion ?? 0) >= 2) {
    flags.push({
      type: "TAB_SWITCH_CORRELATION",
      description: `${signals.tabSwitchesDuringQuestion} tab switches during this question`,
      weight: 15,
    });
  }

  // ── 6. LLM structural patterns ──────────────────────────────────────────
  if (signals.answerText) {
    let patternMatches = 0;
    for (const pattern of LLM_PATTERNS) {
      if (pattern.test(signals.answerText)) {
        patternMatches++;
      }
    }

    if (patternMatches >= 3) {
      flags.push({
        type: "LLM_STRUCTURE_DETECTED",
        description: `Answer matches ${patternMatches} known LLM output patterns`,
        weight: 25,
      });
    } else if (patternMatches >= 2) {
      flags.push({
        type: "LLM_STRUCTURE_POSSIBLE",
        description: `Answer matches ${patternMatches} LLM-like patterns`,
        weight: 10,
      });
    }
  }

  // ── 7. Length anomaly (suspiciously long for the question) ───────────────
  if (signals.wordCount && signals.wordCount > 200 && signals.questionText) {
    const questionWords = signals.questionText.split(/\s+/).length;
    // If the answer is 20x longer than the question, flag it
    if (signals.wordCount > questionWords * 20) {
      flags.push({
        type: "LENGTH_ANOMALY",
        description: `Answer (${signals.wordCount} words) is disproportionately long for the question (${questionWords} words)`,
        weight: 10,
      });
    }
  }

  // ── Compute final score ─────────────────────────────────────────────────
  const rawScore = flags.reduce((sum, f) => sum + f.weight, 0);
  const score = Math.min(100, rawScore); // Cap at 100

  let level: AbuseAnalysis["level"];
  if (score <= 20) level = "clean";
  else if (score <= 50) level = "suspicious";
  else if (score <= 80) level = "likely_ai";
  else level = "definite_ai";

  return { score, level, flags };
}

// ── Analyze all answers in a session ────────────────────────────────────────

export function analyzeSession(answers: AbuseSignals[]): {
  overallScore: number;
  overallLevel: AbuseAnalysis["level"];
  perAnswer: AbuseAnalysis[];
  summary: string;
} {
  const perAnswer = answers.map(analyzeAnswer);
  const scores = perAnswer.map((a) => a.score);
  const overallScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  let overallLevel: AbuseAnalysis["level"];
  if (overallScore <= 20) overallLevel = "clean";
  else if (overallScore <= 50) overallLevel = "suspicious";
  else if (overallScore <= 80) overallLevel = "likely_ai";
  else overallLevel = "definite_ai";

  const flaggedCount = perAnswer.filter((a) => a.score > 20).length;
  const summary = flaggedCount === 0
    ? "No abuse signals detected."
    : `${flaggedCount}/${answers.length} answers flagged (overall: ${overallLevel}, score: ${overallScore}/100)`;

  return { overallScore, overallLevel, perAnswer, summary };
}
