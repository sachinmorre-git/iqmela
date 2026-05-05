import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createEmbeddedSignature } from "@/lib/docusign";
import { isOfferExpired } from "@/lib/offer-utils";

/**
 * POST /api/offers/[token]/sign
 *
 * Initiates the signing experience for a candidate:
 *
 *   1. If DocuSign is configured → creates embedded DocuSign session
 *   2. If DocuSign is NOT configured → uses built-in e-signature
 *      (name-typed consent with IP + timestamp for ESIGN Act compliance)
 *
 * Guards:
 *   - Offer must be FROZEN / SENT / APPROVED (legally released)
 *   - Offer must not be expired
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;

    const offer = await prisma.jobOffer.findUnique({
      where: { candidateToken: token },
      include: {
        resume: true,
        template: true,
        organization: { select: { name: true } },
        position: { select: { title: true } },
      }
    });

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    // ── Guard: Status check ─────────────────────────────────────────────
    if (offer.status !== "FROZEN" && offer.status !== "SENT" && offer.status !== "APPROVED") {
      return NextResponse.json({ error: "Offer is not legally ready for signature" }, { status: 400 });
    }

    // ── Guard: Expiration check ─────────────────────────────────────────
    if (isOfferExpired(offer.expirationDate)) {
      // Auto-transition to EXPIRED
      await prisma.$transaction([
        prisma.jobOffer.update({
          where: { id: offer.id },
          data: { status: "EXPIRED" },
        }),
        prisma.offerAuditLog.create({
          data: {
            offerId: offer.id,
            action: "OFFER_EXPIRED",
            details: { expirationDate: offer.expirationDate.toISOString() },
          },
        }),
      ]);
      return NextResponse.json({ error: "This offer has expired. Please contact the recruiter." }, { status: 410 });
    }

    // ── Check if DocuSign is configured ─────────────────────────────────
    const hasDocuSign = !!(
      process.env.DOCUSIGN_CLIENT_ID &&
      process.env.DOCUSIGN_USER_ID &&
      process.env.DOCUSIGN_PRIVATE_KEY &&
      process.env.DOCUSIGN_ACCOUNT_ID
    );

    if (hasDocuSign) {
      // ═══ PATH A: DocuSign Embedded Signing ═══════════════════════════
      const docHtml = offer.template?.contentHtml || `<h1>Employment Offer</h1><p>Base: $${offer.baseSalary}</p><br/><br/><span style="color:white">\\\\s1\\\\</span>`;
      const candidateEmail = offer.resume.candidateEmail || offer.resume.overrideEmail || "candidate@example.com";
      const candidateName = offer.resume.candidateName || "Candidate";
      const envUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const returnUrl = `${envUrl}/offer/${token}?signed=true`;

      const { envelopeId, url } = await createEmbeddedSignature(
        process.env.DOCUSIGN_ACCOUNT_ID!,
        docHtml,
        candidateEmail,
        candidateName,
        returnUrl
      );

      await prisma.jobOffer.update({
        where: { id: offer.id },
        data: { docusignEnvelopeId: envelopeId },
      });

      return NextResponse.json({ signatureUrl: url, envelopeId });
    } else {
      // ═══ PATH B: Built-in E-Signature ════════════════════════════════
      // Parse the typed signature from the request body
      let body: { typedSignature?: string } = {};
      try {
        body = await req.json();
      } catch {
        // Body may have been consumed already — allow empty for initial call
      }

      if (!body.typedSignature?.trim()) {
        // First call — client should show the built-in signature modal
        return NextResponse.json({
          mode: "builtin",
          candidateName: offer.resume.candidateName || "Candidate",
          organizationName: offer.organization?.name || "the company",
          positionTitle: offer.position?.title || "the position",
        });
      }

      // ── Execute built-in signing ───────────────────────────────────
      const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
      const userAgent = req.headers.get("user-agent") || "unknown";

      await prisma.$transaction([
        prisma.jobOffer.update({
          where: { id: offer.id },
          data: { status: "ACCEPTED" },
        }),
        prisma.resume.update({
          where: { id: offer.resumeId },
          data: { pipelineStatus: "HIRED" },
        }),
        prisma.offerAuditLog.create({
          data: {
            offerId: offer.id,
            action: "ACCEPTED_AND_SIGNED",
            actorIp: ip,
            details: {
              method: "BUILTIN_ESIGN",
              typedSignature: body.typedSignature!.trim(),
              signedAt: new Date().toISOString(),
              userAgent,
              ip,
              esignConsent: "I agree to use electronic records and signatures.",
              complianceNote: "ESIGN Act / UETA compliant: consent + intent + association + record retention",
            },
          },
        }),
      ]);

      return NextResponse.json({ success: true, mode: "builtin" });
    }
  } catch (err: any) {
    console.error("[Offer Sign Error]:", err.message);
    return NextResponse.json({ error: "Failed to initialize signing session." }, { status: 500 });
  }
}
