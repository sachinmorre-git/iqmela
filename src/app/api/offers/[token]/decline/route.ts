import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emailService } from "@/lib/email";
import { dispatchNotification } from "@/lib/notify";

/**
 * POST /api/offers/[token]/decline
 *
 * Candidate declines the offer. Transitions the state machine:
 *   JobOffer.status → DECLINED
 *   Resume.pipelineStatus → REJECTED (re-enterable via REACTIVATE)
 *
 * Creates an audit log and notifies the recruiter via email + in-app.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    let body: { notes?: string } = {};
    try {
      body = await req.json();
    } catch {
      // No body is fine — notes are optional
    }

    const offer = await prisma.jobOffer.findUnique({
      where: { candidateToken: token },
      include: {
        resume: true,
        position: { select: { title: true } },
        organization: { select: { name: true, id: true } },
      },
    });

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    if (offer.status === "DECLINED") {
      return NextResponse.json({ error: "Offer already declined" }, { status: 400 });
    }

    if (offer.status === "ACCEPTED") {
      return NextResponse.json({ error: "Offer already accepted — cannot decline" }, { status: 400 });
    }

    // ── Atomic state transition ──────────────────────────────────────────
    await prisma.$transaction([
      prisma.jobOffer.update({
        where: { id: offer.id },
        data: { status: "DECLINED" },
      }),
      prisma.resume.update({
        where: { id: offer.resumeId },
        data: { pipelineStatus: "REJECTED" },
      }),
      prisma.offerAuditLog.create({
        data: {
          offerId: offer.id,
          action: "DECLINED_BY_CANDIDATE",
          details: {
            candidateName: offer.resume.candidateName,
            notes: body.notes || null,
            declinedAt: new Date().toISOString(),
          },
        },
      }),
    ]);

    // ── Notify recruiter via email ──────────────────────────────────────
    // Find ORG_ADMIN users to notify
    const orgAdmins = await prisma.user.findMany({
      where: { organizationId: offer.organizationId, roles: { has: "ORG_ADMIN" } },
      select: { id: true, email: true, name: true },
    });

    const candidateName = offer.resume.candidateName || "A candidate";
    const positionTitle = offer.position?.title || "a position";

    for (const admin of orgAdmins) {
      if (admin.email) {
        await emailService.sendGenericEmail({
          to: admin.email,
          subject: `Offer Declined: ${candidateName} — ${positionTitle}`,
          heading: "Offer Declined",
          body: `${candidateName} has declined the offer for ${positionTitle}.${body.notes ? `\n\nCandidate's feedback:\n"${body.notes}"` : ""}`,
          ctaLabel: "View Pipeline",
          ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/org-admin/positions/${offer.positionId}`,
        });
      }

      // In-app notification
      dispatchNotification({
        organizationId: offer.organizationId,
        userId: admin.id,
        type: "OFFER_APPROVED",
        title: `Offer Declined by ${candidateName}`,
        body: `The offer for ${positionTitle} was declined.${body.notes ? ` Reason: "${body.notes}"` : ""}`,
        link: `/org-admin/positions/${offer.positionId}`,
        sendPush: true,
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Offer Decline Error]:", err.message);
    return NextResponse.json(
      { error: "Failed to process decline." },
      { status: 500 }
    );
  }
}
