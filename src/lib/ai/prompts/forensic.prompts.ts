/**
 * src/lib/ai/prompts/forensic.prompts.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Prompts for post-interview forensic/integrity analysis:
 *   - Transcript-level behavioral grading (interview-grader.ts)
 *   - Session integrity analysis (livekit webhook)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface GradeTranscriptCtx {
  transcriptText:   string;
  violationSummary: string;
}

export interface IntegrityAnalysisCtx {
  positionTitle:  string;
  jdText:         string;
  resumeText:     string;
  centerPct:      number | null;
  avgWpm:         number | null;
  silenceGapCount: number;
  headDownEvents: number;
  avgEngagement:  number | null;
  avgComposure:   number | null;
  violationSummary: string;
  transcriptText: string;
  utteranceCount: number;
}

// ── Prompt Functions ─────────────────────────────────────────────────────────

/**
 * Deep forensic grading of an interview transcript.
 * Detects AI-synthesised speech patterns, cross-references against violations.
 * Outputs JSON: { technicalScore, softSkillScore, suspicionScore, aiToneDetected, fraudNotes, strengths, weaknesses }
 *
 * @version forensic-v1
 */
export function gradeTranscriptPrompt(ctx: GradeTranscriptCtx): string {
  return `
You are an elite Silicon Valley forensic hiring committee. 
Evaluate this candidate's interview transcript. Look specifically for unnatural pauses, overly-perfect "ChatGPT-like" vocabulary, and correlate it directly against their platform violations below.

### RAW TRANSCRIPT:
${ctx.transcriptText.substring(0, 5000)}

### SYSTEM PROCTOR VIOLATIONS (Tab Switching/Copying):
${ctx.violationSummary || "No explicit system violations detected."}

Grade them strictly on a scale of 0-100 for Technical Mastery and Soft Skills.
Most importantly, generate a 'suspicionScore' (0-100). If the transcript reads like an AI speaking, or there are many system violations aligning with long pauses, make this score aggressively high!
`.trim();
}
gradeTranscriptPrompt.version = "forensic-v1" as const;

/**
 * Session-level behavioral integrity report — combines transcript, signals,
 * resume claims, and proctor violations into a structured report.
 * Used by the LiveKit webhook post-session pipeline.
 * Outputs JSON: { scores, perAnswerScores[], resumeFlags[], behaviorFlags[], topStrengths[] }
 *
 * @version integrity-v1
 */
export function sessionIntegrityPrompt(ctx: IntegrityAnalysisCtx): string {
  return `
You are an expert interview analyst. Analyze this interview session and produce a structured behavioral report.

CRITICAL RULES:
- All flags must say "flagged for review" — NEVER "cheating confirmed"
- Do NOT make hiring recommendations or pass/fail judgments
- Scores represent behavioral signals, not personal character assessments
- All information is for interviewer awareness only

POSITION: ${ctx.positionTitle}
JOB DESCRIPTION: ${ctx.jdText.slice(0, 800)}

CANDIDATE RESUME (excerpt):
${ctx.resumeText.slice(0, 1000)}

BEHAVIORAL SIGNALS:
- Eye gaze: ${ctx.centerPct !== null ? `${ctx.centerPct}% time looking at screen (${ctx.centerPct >= 70 ? "focused" : ctx.centerPct >= 45 ? "slightly distracted" : "notably distracted"})` : "No gaze data"}
- Speaking pace: ${ctx.avgWpm !== null ? `~${ctx.avgWpm} words per minute` : "No pace data"}
- Silence gaps >5s: ${ctx.silenceGapCount} occurrence(s)
- Head-down events: ${ctx.headDownEvents} time(s)
- Engagement score (blendshapes): ${ctx.avgEngagement !== null ? `${ctx.avgEngagement}/100` : "No data"}
- Composure score (stress markers): ${ctx.avgComposure !== null ? `${ctx.avgComposure}/100` : "No data"}
- Browser violations: ${ctx.violationSummary || "none"}

INTERVIEW TRANSCRIPT (${ctx.utteranceCount} utterances):
${ctx.transcriptText}

Produce a JSON report with the exact schema provided. For perAnswerScores, identify the distinct questions asked by the Interviewer and score each Candidate answer for correctness, depth, and specificity relative to the position requirements.
For resumeFlags, identify specific resume claims (technologies, years of experience, certifications) and cross-reference them against what the candidate demonstrated in the transcript.
For behaviorFlags, reference specific timestamps (use utterance order if no explicit time) and categorize each by LOW/MEDIUM/HIGH severity.
  `.trim();
}
sessionIntegrityPrompt.version = "integrity-v1" as const;
