/**
 * POST /api/tts/elevenlabs
 *
 * Secure server-side proxy for ElevenLabs Text-to-Speech.
 * Keeps ELEVENLABS_API_KEY on the server — never exposed to the browser.
 *
 * Body:   { text: string; voiceId?: string }
 * Returns: audio/mpeg binary stream
 *
 * Required env vars:
 *   ELEVENLABS_API_KEY   — ElevenLabs API key
 *   ELEVENLABS_VOICE_ID  — optional voice override (default: "Rachel" = 21m00Tcm4TlvDq8ikWAM)
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// ElevenLabs default "Rachel" voice — professional, neutral American English
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

// Model: "eleven_turbo_v2_5" is the fastest + cheapest; "eleven_multilingual_v2" for quality
const MODEL_ID = "eleven_turbo_v2_5";

export async function POST(req: Request) {
  try {
    // Auth guard — only authenticated candidates can generate TTS
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      // Graceful degradation: tell client to fall back to browser TTS
      return NextResponse.json(
        { error: "ElevenLabs not configured — set ELEVENLABS_API_KEY" },
        { status: 503 }
      );
    }

    const { text, voiceId } = (await req.json()) as {
      text?: string;
      voiceId?: string;
    };

    if (!text || text.trim().length === 0) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    // Hard limit to avoid runaway costs
    const safeText = text.slice(0, 1000);
    const voice = voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;

    const elRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: safeText,
          model_id: MODEL_ID,
          voice_settings: {
            stability: 0.5,        // 0–1: higher = more consistent but robotic
            similarity_boost: 0.8, // 0–1: higher = closer to original voice clone
            style: 0.2,            // 0–1: expressiveness (turbo model supports this)
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!elRes.ok) {
      const errText = await elRes.text();
      console.error("[ElevenLabs proxy] API error:", elRes.status, errText);
      return NextResponse.json(
        { error: `ElevenLabs API error: ${elRes.status}` },
        { status: 502 }
      );
    }

    // Stream the audio buffer straight back to the browser
    const audioBuffer = await elRes.arrayBuffer();

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
        // Short cache — same question text returns same audio
        "Cache-Control": "private, max-age=300",
      },
    });

  } catch (err) {
    console.error("[ElevenLabs proxy]", err);
    return NextResponse.json({ error: "TTS proxy failed" }, { status: 500 });
  }
}
