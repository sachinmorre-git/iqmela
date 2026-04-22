import { NextRequest, NextResponse } from "next/server";
import { getCallerPermissions } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ── Cloudflare R2 client (S3-compatible) ─────────────────────────────────────
function getR2Client() {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 storage is not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in your environment.");
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true, // Required for R2 / S3-compatible endpoints
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ interviewId: string }> }
) {
  try {
    const { interviewId } = await params;

    // ── Auth: only assigned participants with appropriate role ────────────────
    const perms = await getCallerPermissions();
    if (!perms) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
      select: {
        recordingUrl:          true,
        recordingDurationSecs: true,
        recordingSize:         true,
        recordingExpiresAt:    true,
        consentGiven:          true,
        interviewerId:         true,
        organizationId:        true,
        panelists: { select: { interviewerId: true } },
      },
    });

    if (!interview) return NextResponse.json({ error: "Interview not found" }, { status: 404 });

    // ── Org scope ─────────────────────────────────────────────────────────────
    if (perms.orgId && interview.organizationId !== perms.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Role check: only interviewers + panelists + org admins/HMs ───────────
    const isAssignedInterviewer =
      interview.interviewerId === perms.userId ||
      interview.panelists.some((p) => p.interviewerId === perms.userId);

    const isHiringStaff = perms.roles?.some((r: string) =>
      ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER"].includes(r)
    );

    if (!isAssignedInterviewer && !isHiringStaff && !perms.canManageInvites) {
      return NextResponse.json({ error: "Forbidden: You do not have access to this recording" }, { status: 403 });
    }

    // ── No recording yet ──────────────────────────────────────────────────────
    if (!interview.recordingUrl) {
      return NextResponse.json({ error: "No recording available for this interview" }, { status: 404 });
    }

    // ── Check expiry ──────────────────────────────────────────────────────────
    if (interview.recordingExpiresAt && new Date() > interview.recordingExpiresAt) {
      return NextResponse.json({ error: "Recording has expired and been deleted" }, { status: 410 });
    }

    // ── Generate a 1-hour pre-signed URL from R2 ─────────────────────────────
    // recordingUrl is the full URL or object key. Extract the key from the URL.
    const bucket = process.env.R2_BUCKET_NAME;
    if (!bucket) throw new Error("R2_BUCKET_NAME is not set");

    // Extract the object key from the full URL (strip the bucket endpoint prefix)
    let objectKey = interview.recordingUrl;
    const endpoint = process.env.R2_ENDPOINT ?? "";
    if (objectKey.startsWith("http")) {
      // Full URL: https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
      // or:       https://<bucket>.<account>.r2.cloudflarestorage.com/<key>
      try {
        const url = new URL(objectKey);
        // Strip leading slash and bucket prefix if present
        objectKey = url.pathname.replace(/^\/[^/]+\//, "").replace(/^\//, "");
      } catch {
        // If URL parsing fails, use as-is
      }
    }

    const r2 = getR2Client();
    const command = new GetObjectCommand({ Bucket: bucket, Key: objectKey });
    const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 3600 }); // 1 hour

    return NextResponse.json({
      url:           presignedUrl,
      expiresAt:     new Date(Date.now() + 3600 * 1000).toISOString(),
      durationSecs:  interview.recordingDurationSecs,
      sizeBytes:     interview.recordingSize,
      recordingExpiresAt: interview.recordingExpiresAt?.toISOString(),
      consentGiven:  interview.consentGiven,
    });

  } catch (err: any) {
    console.error("[Recording API] error:", err);
    return NextResponse.json({ error: err.message ?? "Internal Server Error" }, { status: 500 });
  }
}
