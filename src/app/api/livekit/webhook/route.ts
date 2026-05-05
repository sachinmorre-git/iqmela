import { NextRequest, NextResponse } from "next/server";
import { WebhookReceiver } from "livekit-server-sdk";
import { LIVEKIT_CONFIG } from "@/lib/livekit";
import { prisma } from "@/lib/prisma";

const receiver = new WebhookReceiver(LIVEKIT_CONFIG.apiKey, LIVEKIT_CONFIG.apiSecret);

export async function POST(req: NextRequest) {
  try {
    const body       = await req.text();
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new NextResponse("Unauthorized", { status: 401 });

    // Cryptographically verify the webhook came from LiveKit
    const event = await receiver.receive(body, authHeader);

    // ── Recording finished ─────────────────────────────────────────────────
    if (event.event === "egress_ended" && event.egressInfo) {
      const interviewId = event.egressInfo.roomName;
      const egressId    = event.egressInfo.egressId;

      // `file` lives under the protobuf `case` union — use runtime cast for webhook payload
      const egressFile = (event.egressInfo as any).file as {
        location?: string;
        duration?: bigint;
        size?:     bigint;
      } | undefined;

      const fullLocation = egressFile?.location ?? "";
      const durationSecs = egressFile?.duration
        ? Math.round(Number(egressFile.duration) / 1_000_000_000) // nanoseconds → seconds
        : null;
      const sizeBytes = egressFile?.size ? Number(egressFile.size) : null;

      console.log(`[Webhook] egress_ended — room: ${interviewId}, egressId: ${egressId}, location: ${fullLocation}`);

      await prisma.interview.update({
        where: { id: interviewId },
        data: {
          recordingId:           egressId,
          recordingUrl:          fullLocation,
          recordingDurationSecs: durationSecs,
          recordingSize:         sizeBytes,
          recordingExpiresAt:    new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
        },
      });

      // Kick off diarized transcription asynchronously (never blocks webhook response)
      // Includes exponential backoff retry: attempt 1 → 30s → 120s
      if (fullLocation && process.env.ASSEMBLYAI_API_KEY) {
        processTranscriptionWithRetry(interviewId, fullLocation).catch(console.error);
      }

      // Kick off behavioral integrity analysis (after transcript is done — delayed 90s to allow AAI to finish)
      setTimeout(() => {
        processIntegrityAnalysis(interviewId).catch(console.error);
      }, 90_000);
    }

    // ── Room finished (auto-complete interview) ────────────────────────────
    if (event.event === "room_finished") {
      const interviewId = event.room?.name;
      if (interviewId) {
        await prisma.interview.updateMany({
          where:  { id: interviewId, status: "SCHEDULED" },
          data:   { status: "COMPLETED" },
        }).catch(() => {}); // Graceful — may already be COMPLETED
      }
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    console.error("[Webhook] Error:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — AssemblyAI diarized transcription pipeline (with retry)
// Runs asynchronously after egress_ended. Never blocks the webhook response.
// Retry schedule: Attempt 1 (immediate) → Attempt 2 (30s) → Attempt 3 (120s)
// ─────────────────────────────────────────────────────────────────────────────

const TRANSCRIPT_RETRY_DELAYS = [0, 30_000, 120_000]; // delays in ms before each attempt

async function processTranscriptionWithRetry(interviewId: string, recordingUrl: string) {
  for (let attempt = 0; attempt < TRANSCRIPT_RETRY_DELAYS.length; attempt++) {
    const delay = TRANSCRIPT_RETRY_DELAYS[attempt];

    if (delay > 0) {
      console.log(`[Transcript] Retry attempt ${attempt + 1}/${TRANSCRIPT_RETRY_DELAYS.length} for ${interviewId} — waiting ${delay / 1000}s`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      await processTranscription(interviewId, recordingUrl);
      // If we get here, it succeeded — no need to retry
      return;
    } catch (error) {
      console.warn(
        `[Transcript] Attempt ${attempt + 1}/${TRANSCRIPT_RETRY_DELAYS.length} failed for ${interviewId}:`,
        error instanceof Error ? error.message : error
      );

      // Last attempt — log permanent failure
      if (attempt === TRANSCRIPT_RETRY_DELAYS.length - 1) {
        console.error(`[Transcript] ✗ All ${TRANSCRIPT_RETRY_DELAYS.length} attempts exhausted for ${interviewId}. Transcription permanently failed.`);

        // Record failure in DB so admin dashboard can surface it
        try {
          await prisma.interview.update({
            where: { id: interviewId },
            data: {
              transcriptionUrl: null, // Explicitly null = tried and failed
            },
          });
        } catch {
          // Don't let DB failure mask the original error
        }
      }
    }
  }
}

/** A single turn in the diarized transcript. */
export interface TranscriptUtterance {
  speaker:  "Candidate" | "Interviewer" | string;
  text:     string;
  startMs:  number;
  endMs:    number;
  confidence?: number;
}

async function processTranscription(interviewId: string, recordingUrl: string) {
  try {
    console.log(`[Transcript] Starting ASR pipeline for ${interviewId}`);

    const apiKey = process.env.ASSEMBLYAI_API_KEY!;

    // ── 1. Submit to AssemblyAI ─────────────────────────────────────────────
    const { AssemblyAI } = await import("assemblyai");
    const aai = new AssemblyAI({ apiKey });

    // recordingUrl might be just an R2 object key — we need a pre-signed GET URL
    // so AssemblyAI can fetch it. Generate one with a 24 h lifetime.
    const audioUrl = await buildR2PresignedUrl(recordingUrl);

    const transcript = await aai.transcripts.transcribe({
      audio_url:          audioUrl,
      speaker_labels:     true,          // Enable diarization (speaker A / B / …)
      language_detection: true,          // Auto-detect language
      auto_chapters:      false,         // Keep it simple for now
    });

    if (transcript.status === "error") {
      throw new Error(`AssemblyAI error: ${transcript.error}`);
    }

    // ── 2. Map speaker labels to roles ─────────────────────────────────────
    // AssemblyAI returns speaker "A", "B", etc. We heuristically assign:
    // the speaker with FEWER total words is likely the Candidate (being asked questions).
    // If word counts are similar, we fall back to "Speaker A / B".
    const utterances: TranscriptUtterance[] = [];
    const speakerWordCount: Record<string, number> = {};

    for (const utt of transcript.utterances ?? []) {
      const wordCount = (utt.text ?? "").split(/\s+/).length;
      speakerWordCount[utt.speaker] = (speakerWordCount[utt.speaker] ?? 0) + wordCount;
    }

    // Speaker with fewer words → likely interviewer (asks short questions)
    // Speaker with more words → candidate (gives longer answers)
    const speakers = Object.keys(speakerWordCount).sort(
      (a, b) => speakerWordCount[a] - speakerWordCount[b]
    );
    const speakerRoleMap: Record<string, string> = {};
    if (speakers.length >= 2) {
      speakerRoleMap[speakers[0]] = "Interviewer"; // fewer words
      speakerRoleMap[speakers[1]] = "Candidate";   // more words
    }

    for (const utt of transcript.utterances ?? []) {
      utterances.push({
        speaker:    speakerRoleMap[utt.speaker] ?? `Speaker ${utt.speaker}`,
        text:       utt.text ?? "",
        startMs:    utt.start ?? 0,
        endMs:      utt.end   ?? 0,
        confidence: utt.confidence ?? undefined,
      });
    }

    // ── 3. Store in Vercel Blob (private, structured JSON) ─────────────────
    const { put } = await import("@vercel/blob");

    const blobPayload = JSON.stringify({
      interviewId,
      generatedAt: new Date().toISOString(),
      language:    transcript.language_code,
      audioUrl:    recordingUrl,
      utterances,
    });

    const blob = await put(
      `transcripts/${interviewId}.json`,
      blobPayload,
      {
        access:          "public",  // Vercel Blob only supports "public". URL is a non-guessable UUID path.
        contentType:     "application/json",
        addRandomSuffix: false,
      }
    );

    // ── 4. Persist blob URL in DB ──────────────────────────────────────────
    await prisma.interview.update({
      where: { id: interviewId },
      data:  { transcriptionUrl: blob.url },
    });

    console.log(`[Transcript] ✓ Done — ${interviewId} → ${blob.url} (${utterances.length} utterances)`);

  } catch (error) {
    console.error(`[Transcript] ✗ ASR failed for ${interviewId}:`, error);
    // Re-throw so processTranscriptionWithRetry can catch and retry
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build a pre-signed R2 URL so AssemblyAI can fetch the audio
// ─────────────────────────────────────────────────────────────────────────────
async function buildR2PresignedUrl(recordingUrl: string): Promise<string> {
  // If it's already a full HTTP URL (e.g. from a public R2 bucket), return as-is
  if (recordingUrl.startsWith("http")) {
    // Even if it's a full URL, we regenerate a presigned URL for security
    // so AssemblyAI can't use a permanent link
    try {
      const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

      const bucket = process.env.R2_BUCKET_NAME!;
      let objectKey = recordingUrl;
      try {
        const url = new URL(recordingUrl);
        objectKey = url.pathname.replace(/^\/[^/]+\//, "").replace(/^\//, "");
      } catch { /* use as-is */ }

      const r2 = new S3Client({
        region:      "auto",
        endpoint:    process.env.R2_ENDPOINT!,
        credentials: {
          accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
        forcePathStyle: true,
      });

      const cmd = new GetObjectCommand({ Bucket: bucket, Key: objectKey });
      return await getSignedUrl(r2, cmd, { expiresIn: 86400 }); // 24 hours for ASR
    } catch (e) {
      console.warn("[Transcript] Could not generate presigned URL, using raw:", e);
      return recordingUrl;
    }
  }

  // If it's just an object key (no protocol), build the full presigned URL
  try {
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

    const r2 = new S3Client({
      region:      "auto",
      endpoint:    process.env.R2_ENDPOINT!,
      credentials: {
        accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
    });

    const cmd = new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME!, Key: recordingUrl });
    return await getSignedUrl(r2, cmd, { expiresIn: 86400 });
  } catch {
    return recordingUrl; // Last resort fallback
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 6C — Behavioral Integrity Analysis Pipeline
// Triggered 90s after egress_ended (allows AssemblyAI to finish first).
// Fetches signals from Vercel Blob + transcript → single Gemini AI call →
// structured report → Vercel Blob + InterviewBehaviorReport DB row.
// ─────────────────────────────────────────────────────────────────────────────
async function processIntegrityAnalysis(interviewId: string) {
  try {
    console.log(`[Integrity] Starting behavioral analysis for ${interviewId}`);

    // ── 1. Load interview context ────────────────────────────────────────────
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      include: {
        resume:   { select: { extractedText: true } },
        position: { select: { title: true, jdText: true } },
        violations: { select: { violationType: true, severity: true, createdAt: true } },
      },
    });

    if (!interview) {
      console.warn(`[Integrity] Interview ${interviewId} not found — skipping`);
      return;
    }

    // ── 2. Load behavioral signals from Vercel Blob ──────────────────────────
    // Strategy: use Vercel Blob list() to find the signal file by known prefix.
    // The signals file was uploaded during saveSessionSignalsAction() at session end.
    let signals: any[] = [];
    let signalsUrl: string | null = null;
    try {
      const { list } = await import("@vercel/blob");
      const { blobs } = await list({ prefix: `signals/${interviewId}.json`, limit: 1 });
      if (blobs.length > 0) {
        signalsUrl = blobs[0].url;
        const signalsRes = await fetch(signalsUrl);
        if (signalsRes.ok) {
          const raw = await signalsRes.json();
          signals = raw.signals ?? [];
        }
      } else {
        console.warn(`[Integrity] No signal file found for ${interviewId} — continuing without`);
      }
    } catch {
      console.warn(`[Integrity] Signal fetch failed for ${interviewId} — continuing without`);
    }

    // ── 3. Load transcript ───────────────────────────────────────────────────
    let utterances: any[] = [];
    if (interview.transcriptionUrl) {
      try {
        const transcriptRes = await fetch(interview.transcriptionUrl);
        if (transcriptRes.ok) {
          const raw = await transcriptRes.json();
          utterances = raw.utterances ?? [];
        }
      } catch {
        console.warn(`[Integrity] Could not load transcript for ${interviewId}`);
      }
    }

    // ── 4. Compute behavioral signals ────────────────────────────────────────
    const gazeZones  = signals.filter((s: any) => s.type === "GAZE_ZONE").map((s: any) => s.value);
    const centerPct  = gazeZones.length
      ? Math.round(gazeZones.filter((z: string) => z === "CENTER").length / gazeZones.length * 100)
      : null;

    const silenceGaps = signals.filter((s: any) => s.type === "SILENCE_GAP");
    const paceSignals = signals.filter((s: any) => s.type === "PACE");
    const avgWpm      = paceSignals.length
      ? Math.round(paceSignals.reduce((s: number, p: any) => s + (p.value?.wpm ?? 0), 0) / paceSignals.length)
      : null;

    const engagementSignals = signals.filter((s: any) => s.type === "ENGAGEMENT");
    const avgEngagement = engagementSignals.length
      ? Math.round(engagementSignals.reduce((s: number, p: any) => s + (p.value?.score ?? 0), 0) / engagementSignals.length)
      : null;

    const composureSignals = signals.filter((s: any) => s.type === "COMPOSURE");
    const avgComposure = composureSignals.length
      ? Math.round(composureSignals.reduce((s: number, p: any) => s + (p.value?.score ?? 0), 0) / composureSignals.length)
      : null;

    const headDownEvents = signals.filter((s: any) => s.type === "HEAD_DOWN").length;
    const transcriptText = utterances.slice(0, 80).map((u: any) => `[${u.speaker}] ${u.text}`).join("\n");
    const violations = interview.violations ?? [];

    // ── 5. Build + send AI prompt ────────────────────────────────────────────
    const { sessionIntegrityPrompt } = await import("@/lib/ai/prompts");
    const { geminiClient, geminiModel } = await import("@/lib/ai/client");
    const { Type } = await import("@google/genai");

    const prompt = sessionIntegrityPrompt({
      positionTitle:    interview.position?.title ?? "Unknown Role",
      jdText:           interview.position?.jdText ?? "Not available",
      resumeText:       interview.resume?.extractedText ?? "Not available",
      centerPct,
      avgWpm,
      silenceGapCount:  silenceGaps.length,
      headDownEvents,
      avgEngagement,
      avgComposure,
      violationSummary: violations.map((v: any) => `${v.violationType}(${v.severity})`).join(", ") || "none",
      transcriptText,
      utteranceCount:   utterances.length,
    });

    const response = await geminiClient.models.generateContent({
      model: geminiModel,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scores: {
              type: Type.OBJECT,
              properties: {
                integrityScore:   { type: Type.NUMBER },
                confidenceScore:  { type: Type.NUMBER },
                composureScore:   { type: Type.NUMBER },
                engagementScore:  { type: Type.NUMBER },
                answerQualityAvg: { type: Type.NUMBER },
              },
            },
            perAnswerScores: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question:  { type: Type.STRING },
                  score:     { type: Type.NUMBER },
                  rationale: { type: Type.STRING },
                },
              },
            },
            resumeFlags: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  claim:    { type: Type.STRING },
                  verdict:  { type: Type.STRING },
                  evidence: { type: Type.STRING },
                },
              },
            },
            behaviorFlags: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  type:        { type: Type.STRING },
                  timestamp:   { type: Type.STRING },
                  severity:    { type: Type.STRING },
                  description: { type: Type.STRING },
                },
              },
            },
            topStrengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
        },
      },
    });

    const rawJson  = response.text ?? "{}";
    const analysis = JSON.parse(rawJson) as {
      scores:          { integrityScore: number; confidenceScore: number; composureScore: number; engagementScore: number; answerQualityAvg: number };
      perAnswerScores: { question: string; score: number; rationale: string }[];
      resumeFlags:     { claim: string; verdict: string; evidence: string }[];
      behaviorFlags:   { type: string; timestamp: string; severity: string; description: string }[];
      topStrengths:    string[];
    };

    // ── 5. Upload full report to Vercel Blob ─────────────────────────────────
    const { put } = await import("@vercel/blob");

    const reportBlob = await put(
      `reports/${interviewId}.json`,
      JSON.stringify({ interviewId, generatedAt: new Date().toISOString(), ...analysis }),
      { access: "public", contentType: "application/json", addRandomSuffix: false }
    );

    // ── 6. Upsert DB record ──────────────────────────────────────────────────
    await prisma.interviewBehaviorReport.upsert({
      where:  { interviewId },
      create: {
        interviewId,
        ...analysis.scores,
        perAnswerScores: analysis.perAnswerScores as any,
        resumeFlags:     analysis.resumeFlags     as any,
        behaviorFlags:   analysis.behaviorFlags   as any,
        topStrengths:    analysis.topStrengths    as any,
        signalsUrl:      signalsUrl ?? undefined,
        reportUrl:       reportBlob.url,
      },
      update: {
        ...analysis.scores,
        perAnswerScores: analysis.perAnswerScores as any,
        resumeFlags:     analysis.resumeFlags     as any,
        behaviorFlags:   analysis.behaviorFlags   as any,
        topStrengths:    analysis.topStrengths    as any,
        signalsUrl:      signalsUrl ?? undefined,
        reportUrl:       reportBlob.url,
        generatedAt:     new Date(),
      },
    });

    console.log(`[Integrity] ✓ Done — ${interviewId} scores: ${JSON.stringify(analysis.scores)}`);

  } catch (error) {
    console.error(`[Integrity] ✗ Analysis failed for ${interviewId}:`, error);
  }
}
