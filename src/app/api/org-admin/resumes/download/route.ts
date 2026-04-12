/**
 * Secure resume download proxy for Org Admins.
 *
 * GET /api/org-admin/resumes/download?resumeId=<id>
 *
 * - Verifies the caller is an authenticated Org Admin
 * - Looks up the resume record in the DB to get the storagePath
 * - If the file is on Vercel Blob, streams it back through this endpoint
 * - If the file is a local path, redirects to the static URL
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { isBlobUrl, downloadBlobFile } from "@/lib/storage";

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── Resolve resume ────────────────────────────────────────────────────────
  const resumeId = req.nextUrl.searchParams.get("resumeId");
  if (!resumeId) {
    return NextResponse.json({ error: "resumeId is required" }, { status: 400 });
  }

  const resume = await prisma.resume.findUnique({
    where: { id: resumeId },
    select: { storagePath: true, originalFileName: true, mimeType: true },
  });
  if (!resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  const { storagePath, originalFileName, mimeType } = resume;

  // ── Serve file ────────────────────────────────────────────────────────────
  if (isBlobUrl(storagePath)) {
    // Private blob → proxy the download through this server
    const blobResponse = await downloadBlobFile(storagePath);
    const blob = await blobResponse.blob();

    return new NextResponse(blob, {
      status: 200,
      headers: {
        "Content-Type": mimeType ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${originalFileName}"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  // Local dev — redirect to the public static file
  return NextResponse.redirect(new URL(storagePath, req.url));
}
