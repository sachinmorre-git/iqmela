import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

/**
 * DocuSign Connect Webhook Handler
 * Receives XML/JSON payload upon envelope completion.
 *
 * Security: Validates HMAC-SHA256 signature when DOCUSIGN_HMAC_KEY is set.
 * https://developers.docusign.com/platform/webhooks/connect/hmac/
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // ── Signature Verification ──────────────────────────────────────────
    const hmacKey = process.env.DOCUSIGN_HMAC_KEY;
    if (hmacKey) {
      const signature = req.headers.get("x-docusign-signature-1");
      if (!signature) {
        console.warn("[DocuSign] Webhook missing signature header — rejected.");
        return NextResponse.json({ error: "Missing signature" }, { status: 401 });
      }

      const expectedSig = crypto
        .createHmac("sha256", hmacKey)
        .update(rawBody, "utf8")
        .digest("base64");

      if (signature !== expectedSig) {
        console.warn("[DocuSign] Webhook signature mismatch — rejected.");
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
    } else {
      console.warn("[DocuSign] ⚠️ DOCUSIGN_HMAC_KEY not set — skipping signature verification (dev mode).");
    }

    // ── Parse Payload ───────────────────────────────────────────────────
    let payload;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        console.warn("DocuSign webhook received non-JSON payload. Check Connect configuration.");
        return NextResponse.json({ received: true });
    }

    // Check if the event is "envelope-completed"
    if (payload.event !== "envelope-completed") {
        return NextResponse.json({ received: true });
    }

    const envelopeId = payload.data?.envelopeId;
    if (!envelopeId) {
        return NextResponse.json({ error: "No envelope ID provided" }, { status: 400 });
    }

    // Process the completed envelope
    const offer = await prisma.jobOffer.findUnique({
        where: { docusignEnvelopeId: envelopeId },
    });

    if (offer) {
        await prisma.$transaction([
            prisma.jobOffer.update({
                where: { id: offer.id },
                data: { status: "ACCEPTED" }
            }),
            prisma.resume.update({
                where: { id: offer.resumeId },
                data: { pipelineStatus: "HIRED" }
            }),
            prisma.offerAuditLog.create({
                data: {
                    offerId: offer.id,
                    action: "ACCEPTED_AND_SIGNED",
                    details: { 
                        envelopeId,
                        message: "DocuSign Envelope Completed via Webhook"
                    }
                }
            })
        ]);
        console.log(`[DocuSign Webhook] Offer ${offer.id} successfully marked as ACCEPTED/HIRED.`);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[DocuSign Webhook Error]:", err.message);
    return NextResponse.json({ error: "Webhook Processing Failed" }, { status: 500 });
  }
}

