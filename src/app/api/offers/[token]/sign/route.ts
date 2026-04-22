import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createEmbeddedSignature } from "@/lib/docusign";

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;

    const offer = await prisma.jobOffer.findUnique({
      where: { candidateToken: token },
      include: {
        resume: true,
        template: true,
      }
    });

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    if (offer.status !== "FROZEN" && offer.status !== "SENT" && offer.status !== "APPROVED") {
        return NextResponse.json({ error: "Offer is not legally ready for signature" }, { status: 400 });
    }

    // Prepare embedded Docusign session
    const docHtml = offer.template?.contentHtml || `<h1>Employment Offer</h1><p>Base: $${offer.baseSalary}</p><br/><br/><span style="color:white">\\s1\\</span>`;
    const candidateEmail = offer.resume.candidateEmail || "candidate@example.com";
    const candidateName = offer.resume.candidateName || "Candidate";
    
    // Where DocuSign redirects AFTER signing
    // NOTE: Requires DocuSign Dev Account configuration for redirect URLs
    const envUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const returnUrl = `${envUrl}/offer/${token}?signed=true`;

    const accountId = process.env.DOCUSIGN_ACCOUNT_ID;
    if (!accountId) {
        throw new Error("Missing Docusign Account config on server.");
    }

    // Call DocuSign SDK Helper
    const { envelopeId, url } = await createEmbeddedSignature(
        accountId,
        docHtml,
        candidateEmail,
        candidateName,
        returnUrl
    );

    // Save envelope tracking to DB
    await prisma.jobOffer.update({
        where: { id: offer.id },
        data: { docusignEnvelopeId: envelopeId }
    });

    return NextResponse.json({ signatureUrl: url, envelopeId });
  } catch (err: any) {
    console.error("[DocuSign Initialization Error]:", err.message);
    return NextResponse.json({ error: "Failed to initialize secured signature payload." }, { status: 500 });
  }
}
