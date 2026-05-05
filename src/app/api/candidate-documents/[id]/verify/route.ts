/**
 * POST /api/candidate-documents/[id]/verify
 *
 * Allows a recruiter/admin to verify or reject a candidate document.
 *
 * Body: { action: "VERIFY" | "REJECT", reason?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const perms = await getCallerPermissions();
    if (!perms) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only pipeline roles can verify/reject documents
    if (!perms.canManagePositions) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action, reason } = body;

    if (!["VERIFY", "REJECT"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const doc = await prisma.candidateDocument.findUnique({
      where: { id },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    await prisma.candidateDocument.update({
      where: { id },
      data: {
        verificationStatus: action === "VERIFY" ? "VERIFIED" : "REJECTED",
        verifiedById: perms.userId,
        verifiedAt: new Date(),
        rejectionReason: action === "REJECT" ? (reason || "Rejected by reviewer") : null,
      },
    });

    return NextResponse.json({ success: true, status: action === "VERIFY" ? "VERIFIED" : "REJECTED" });
  } catch (error) {
    console.error("[DocumentVerify] Error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
