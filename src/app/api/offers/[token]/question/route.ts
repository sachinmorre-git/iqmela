import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { emailService } from "@/lib/email";
import { dispatchNotification } from "@/lib/notify";

/**
 * POST /api/offers/[token]/question
 *
 * Candidate raises a question about the offer.
 * Transitions: JobOffer.status → QUESTIONS_RAISED
 * Notifies the recruiter/org admins with the question text.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    let body: { question?: string } = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Question text is required" }, { status: 400 });
    }

    if (!body.question?.trim()) {
      return NextResponse.json({ error: "Question text is required" }, { status: 400 });
    }

    const offer = await prisma.jobOffer.findUnique({
      where: { candidateToken: token },
      include: {
        resume: { select: { candidateName: true, candidateEmail: true } },
        position: { select: { title: true } },
        organization: { select: { name: true, id: true } },
      },
    });

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    if (offer.status === "ACCEPTED" || offer.status === "DECLINED") {
      return NextResponse.json(
        { error: "Offer is already finalized — questions cannot be submitted" },
        { status: 400 }
      );
    }

    // ── Transition + Audit ──────────────────────────────────────────────
    await prisma.$transaction([
      prisma.jobOffer.update({
        where: { id: offer.id },
        data: { status: "QUESTIONS_RAISED" },
      }),
      prisma.offerAuditLog.create({
        data: {
          offerId: offer.id,
          action: "QUESTION_FROM_CANDIDATE",
          details: {
            candidateName: offer.resume?.candidateName,
            question: body.question!.trim(),
            askedAt: new Date().toISOString(),
          },
        },
      }),
    ]);

    // ── Notify recruiters ───────────────────────────────────────────────
    const orgAdmins = await prisma.user.findMany({
      where: { organizationId: offer.organizationId, roles: { has: "ORG_ADMIN" } },
      select: { id: true, email: true, name: true },
    });

    const candidateName = offer.resume?.candidateName || "A candidate";
    const positionTitle = offer.position?.title || "a position";

    for (const admin of orgAdmins) {
      if (admin.email) {
        await emailService.sendGenericEmail({
          to: admin.email,
          subject: `Question on Offer: ${candidateName} — ${positionTitle}`,
          heading: "Candidate Has a Question",
          body: `${candidateName} has raised a question about their offer for ${positionTitle}:\n\n"${body.question!.trim()}"\n\nPlease respond to the candidate directly or update the offer accordingly.`,
          ctaLabel: "View Offer Pipeline",
          ctaUrl: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/org-admin/positions/${offer.positionId}`,
        });
      }

      dispatchNotification({
        organizationId: offer.organizationId,
        userId: admin.id,
        type: "OFFER_APPROVED",
        title: `Question from ${candidateName}`,
        body: `"${body.question!.trim().slice(0, 100)}${body.question!.trim().length > 100 ? "…" : ""}"`,
        link: `/org-admin/positions/${offer.positionId}`,
        sendPush: true,
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Offer Question Error]:", err.message);
    return NextResponse.json(
      { error: "Failed to submit question." },
      { status: 500 }
    );
  }
}
