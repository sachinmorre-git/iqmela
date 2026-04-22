"use server";

import { EgressClient, EncodedFileOutput, EncodedFileType } from "livekit-server-sdk";
import { S3Upload } from "@livekit/protocol";
import { LIVEKIT_CONFIG } from "@/lib/livekit";
import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";

const egressClient = new EgressClient(
  LIVEKIT_CONFIG.url,
  LIVEKIT_CONFIG.apiKey,
  LIVEKIT_CONFIG.apiSecret
);

/**
 * Builds the S3Upload config for Cloudflare R2 from environment variables.
 * Credentials are injected per-egress call — no LiveKit dashboard storage config needed.
 */
function buildR2Config(): S3Upload {
  const accessKey     = process.env.R2_ACCESS_KEY_ID;
  const secret        = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint      = process.env.R2_ENDPOINT;
  const bucket        = process.env.R2_BUCKET_NAME;

  if (!accessKey || !secret || !endpoint || !bucket) {
    throw new Error(
      "[Recording] R2 is not fully configured. " +
      "Ensure R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, and R2_BUCKET_NAME are set."
    );
  }

  return new S3Upload({
    accessKey,
    secret,
    endpoint,
    bucket,
    region:        "auto",   // Cloudflare R2 uses 'auto'
    forcePathStyle: true,    // Required for S3-compatible endpoints
  });
}
export async function startRecordingAction(interviewId: string) {
  try {
    const perms = await getCallerPermissions();
    if (!perms) throw new Error("Unauthorized");

    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      select: {
        roomName: true,
        panelists: { select: { interviewerId: true } },
        interviewerId: true,
      },
    });

    if (!interview) throw new Error("Interview not found");

    const isAuthorized =
      interview.interviewerId === perms.userId ||
      interview.panelists.some((p) => p.interviewerId === perms.userId) ||
      perms.canManageInvites;

    if (!isAuthorized) throw new Error("Only an interviewer or admin can start recording.");

    // File output — R2 credentials passed directly (no dashboard config needed)
    const fileOutput = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: `recordings/${interviewId}-${Date.now()}.mp4`,
      output: {
        case:  "s3",
        value: buildR2Config(),
      },
    });

    const info = await egressClient.startRoomCompositeEgress(
      interviewId,
      { file: fileOutput },
      { layout: "speaker" } // Active speaker prominently featured
    );

    if (info.egressId) {
      // Store the egressId — we'll resolve the final URL from the webhook
      await prisma.interview.update({
        where: { id: interviewId },
        data: { recordingId: info.egressId },
      });
      return { success: true, egressId: info.egressId };
    }

    return { success: false, error: "Egress pipeline did not start." };
  } catch (error: any) {
    console.error("[Recording] startRecordingAction error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Stop an active Egress and finalize the MP4 on R2.
 */
export async function stopRecordingAction(egressId: string) {
  try {
    const perms = await getCallerPermissions();
    if (!perms) throw new Error("Unauthorized");

    if (!egressId) throw new Error("Missing egressId");

    const info = await egressClient.stopEgress(egressId);
    return { success: true, status: info.status };
  } catch (error: any) {
    console.error("[Recording] stopRecordingAction error:", error);
    return { success: false, error: error.message };
  }
}
