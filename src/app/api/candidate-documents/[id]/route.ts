/**
 * GET /api/candidate-documents/[id]
 *
 * Returns the current status of a candidate document (for AI polling).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const doc = await prisma.candidateDocument.findUnique({
      where: { id },
      include: {
        profile: { select: { userId: true } },
      },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Verify ownership
    if (doc.profile.userId !== userId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({
      id: doc.id,
      docType: doc.docType,
      label: doc.label,
      aiStatus: doc.aiStatus,
      aiConfidence: doc.aiConfidence,
      aiDocTypeGuess: doc.aiDocTypeGuess,
      aiWarnings: doc.aiWarnings,
      aiExtractedJson: doc.aiExtractedJson,
      verificationStatus: doc.verificationStatus,
      originalFileName: doc.originalFileName,
      createdAt: doc.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[CandidateDocStatus] Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
