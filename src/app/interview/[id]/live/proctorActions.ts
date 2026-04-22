"use server";

import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";
import { put } from "@vercel/blob";

export async function reportProctorViolationAction(interviewId: string, violationType: string, metadata: any = {}) {
  try {
    // Determine the caller's auth context (Could be candidate logging their own breach, or interviewer manually flagging)
    const perms = await getCallerPermissions();
    if (!perms) return { success: false, error: "Unauthorized endpoint access." };

    console.warn(`[Proctor Guard] Violation Captured for Interview ${interviewId}: ${violationType}`);

    // Map severity structurally based on exactly what they did
    let severity = "WARNING";
    if (violationType === "SCREEN_SHARE_DECLINED" || violationType === "AUDIO_LIP_MISMATCH") {
      severity = "CRITICAL";
    } else if (violationType === "COPY_PASTE_ATTEMPT" || violationType === "FULLSCREEN_ESCAPED_REPEAT") {
      severity = "SEVERE";
    } else if (violationType === "NEW_TAB_ATTEMPT" || violationType === "DEVTOOLS_ATTEMPT") {
      severity = "HIGH";
    }

    // Persist securely to Database
    const violation = await prisma.interviewViolation.create({
      data: {
        interviewId,
        violationType,
        severity,
        metadata: JSON.stringify({
           ...metadata,
           reportedByIP: "Client-Side Payload",
           timestamp: new Date().toISOString()
        })
      }
    });

    return { success: true, violationId: violation.id };
  } catch (error: any) {
    console.error("[Proctor Guard] Backend Write Error:", error);
    return { success: false, error: "Failed to persist proctor logs." };
  }
}

// ───────────────────────────────────────────────────────────────────────────────
// saveSessionSignalsAction
// Uploads the full signal buffer to Vercel Blob at session end.
// Called fire-and-forget on RoomEvent.Disconnected (candidate only).
// Consumed by processIntegrityAnalysis() in the webhook post-session.
// ───────────────────────────────────────────────────────────────────────────────
export async function saveSessionSignalsAction(
  interviewId: string,
  data: { startedAt: string; durationMs: number; signals: any[] }
) {
  try {
    const perms = await getCallerPermissions();
    if (!perms) return { success: false };

    const blob = await put(
      `signals/${interviewId}.json`,
      JSON.stringify({ interviewId, ...data }),
      { access: "public", contentType: "application/json", addRandomSuffix: false }
    );

    console.log(`[Signal Flush] Saved ${data.signals.length} signals for interview ${interviewId}`);
    return { success: true, url: blob.url };
  } catch (error: any) {
    console.error("[Signal Flush] Failed to save signals:", error);
    return { success: false, error: error.message };
  }
}
