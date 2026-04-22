/**
 * Public BGV Report Upload Endpoint
 *
 * POST /api/bgv/upload/{token}
 *
 * Token-validated (no auth required). For:
 * - Recruiters sharing upload links with candidates
 * - Candidate's agencies uploading BGV reports
 *
 * Flow: validate token → validate consent → PII Shield scan → store/reject
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadBgvReportAction } from "@/app/org-admin/positions/[id]/bgv-actions";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    // 1. Validate token
    const bgvCheck = await prisma.bgvCheck.findUnique({
      where: { uploadLinkToken: token },
      select: {
        id: true,
        uploadLinkExpiresAt: true,
        status: true,
        resume: { select: { candidateName: true } },
        position: { select: { title: true } },
        organization: { select: { name: true } },
      },
    });

    if (!bgvCheck) {
      return NextResponse.json(
        { error: "Invalid upload link. It may have been revoked." },
        { status: 404 },
      );
    }

    // 2. Check expiry
    if (bgvCheck.uploadLinkExpiresAt && bgvCheck.uploadLinkExpiresAt < new Date()) {
      return NextResponse.json(
        { error: "This upload link has expired. Please request a new one." },
        { status: 410 },
      );
    }

    // 3. Check if report already uploaded
    if (bgvCheck.status === "COMPLETED" || bgvCheck.status === "CLEAR" || bgvCheck.status === "CONSIDER") {
      return NextResponse.json(
        { error: "A report has already been uploaded for this BGV check." },
        { status: 409 },
      );
    }

    // 4. Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const consentGiven = formData.get("consentGiven") === "true";
    const reportText = formData.get("reportText") as string || "";

    if (!file) {
      return NextResponse.json(
        { error: "No file provided." },
        { status: 400 },
      );
    }

    // 5. Validate file type and size
    const allowedTypes = ["application/pdf", "image/png", "image/jpeg"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF, PNG, and JPG files are accepted." },
        { status: 400 },
      );
    }

    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 20MB limit." },
        { status: 400 },
      );
    }

    // 6. Convert file to base64 for the upload action
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // 7. Get uploader IP
    const forwarded = req.headers.get("x-forwarded-for");
    const uploaderIp = forwarded?.split(",")[0]?.trim() || "unknown";

    // 8. Call the upload action (PII Shield scan happens inside)
    const result = await uploadBgvReportAction({
      bgvCheckId: bgvCheck.id,
      reportText,
      reportBase64: base64,
      consentGiven,
      uploaderIp,
    });

    if (!result.success) {
      const statusCode = result.piiDetections ? 422 : 400;
      return NextResponse.json(
        {
          error: result.error,
          piiDetections: result.piiDetections || undefined,
        },
        { status: statusCode },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Report uploaded successfully. PII scan passed.",
    });
  } catch (err) {
    console.error("[BGV Upload API] Error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}

// GET endpoint to retrieve upload link metadata (used by the upload page)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    const bgvCheck = await prisma.bgvCheck.findUnique({
      where: { uploadLinkToken: token },
      select: {
        id: true,
        uploadLinkExpiresAt: true,
        status: true,
        packageLabel: true,
        resume: { select: { candidateName: true } },
        position: { select: { title: true } },
        organization: { select: { name: true } },
      },
    });

    if (!bgvCheck) {
      return NextResponse.json({ error: "Invalid link." }, { status: 404 });
    }

    const expired = bgvCheck.uploadLinkExpiresAt && bgvCheck.uploadLinkExpiresAt < new Date();

    return NextResponse.json({
      candidateName: bgvCheck.resume?.candidateName || "Candidate",
      positionTitle: bgvCheck.position?.title || "Position",
      organizationName: bgvCheck.organization?.name || "Organization",
      packageLabel: bgvCheck.packageLabel || "Background Check",
      expiresAt: bgvCheck.uploadLinkExpiresAt?.toISOString(),
      expired: !!expired,
      alreadyUploaded: ["COMPLETED", "CLEAR", "CONSIDER"].includes(bgvCheck.status),
    });
  } catch (err) {
    console.error("[BGV Upload API] GET Error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
