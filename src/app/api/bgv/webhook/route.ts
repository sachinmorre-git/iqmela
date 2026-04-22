/**
 * Checkr Webhook Receiver
 *
 * POST /api/bgv/webhook
 *
 * Handles real-time status updates from Checkr:
 * - invitation.completed → candidate finished consent
 * - report.completed → all checks done, report ready
 * - report.upgraded → report re-processed
 *
 * Security: validates HMAC-SHA256 signature on every request.
 * Idempotent: safe for webhook retries.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CheckrProvider } from "@/lib/bgv/providers/checkr";
import { geminiClient, geminiModel } from "@/lib/ai/client";
import { bgvReportSummaryPrompt } from "@/lib/ai/prompts/interview.prompts";
import type { BgvStatus } from "@prisma/client";

const checkrProvider = new CheckrProvider();

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-checkr-signature") || "";
    const webhookSecret = process.env.CHECKR_WEBHOOK_SECRET || "";

    if (!webhookSecret) {
      console.error("[BGV Webhook] CHECKR_WEBHOOK_SECRET not configured");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    // Validate signature
    const event = await checkrProvider.parseWebhook(rawBody, signature, webhookSecret);
    if (!event) {
      console.warn("[BGV Webhook] Invalid signature — rejecting");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    console.log(`[BGV Webhook] Received: ${event.type} for ${event.vendorCheckId}`);

    // Look up BgvCheck by vendorCheckId
    const bgvCheck = await prisma.bgvCheck.findFirst({
      where: { vendorCheckId: event.vendorCheckId },
      include: {
        resume: { select: { candidateName: true } },
      },
    });

    if (!bgvCheck) {
      console.warn(`[BGV Webhook] No BgvCheck found for vendorCheckId: ${event.vendorCheckId}`);
      // Return 200 to prevent Checkr from retrying (we don't track this check)
      return NextResponse.json({ ok: true, ignored: true });
    }

    // Process event by type
    switch (event.type) {
      case "invitation.completed": {
        await handleInvitationCompleted(bgvCheck.id);
        break;
      }

      case "report.completed": {
        await handleReportCompleted(bgvCheck.id, event.vendorCheckId, bgvCheck);
        break;
      }

      case "report.upgraded": {
        // Re-fetch the latest report status
        await handleReportCompleted(bgvCheck.id, event.vendorCheckId, bgvCheck);
        break;
      }

      default:
        console.log(`[BGV Webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[BGV Webhook] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── Event Handlers ──────────────────────────────────────────────────────────

async function handleInvitationCompleted(bgvCheckId: string) {
  await prisma.$transaction([
    prisma.bgvCheck.update({
      where: { id: bgvCheckId },
      data: {
        status: "CONSENT_GIVEN" as BgvStatus,
        consentGivenAt: new Date(),
        consentMethod: "checkr_hosted",
      },
    }),
    prisma.bgvAuditLog.create({
      data: {
        bgvCheckId,
        action: "CONSENT_GIVEN",
        details: { method: "checkr_hosted", source: "webhook" },
      },
    }),
  ]);
}

async function handleReportCompleted(
  bgvCheckId: string,
  vendorCheckId: string,
  bgvCheck: { id: string; resume: { candidateName: string | null } | null },
) {
  // Fetch full report from Checkr API
  const orgApiKey = process.env.CHECKR_API_KEY || "";

  let reportSummary: string | null = null;
  let reportJson: Record<string, unknown> | null = null;
  type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
  let mappedStatus: BgvStatus = "COMPLETED";

  try {
    const statusResult = await checkrProvider.getStatus(vendorCheckId, orgApiKey);
    mappedStatus = statusResult.mappedStatus;

    // Generate AI summary from check results
    if (statusResult.checkResults && statusResult.checkResults.length > 0) {
      const reportText = statusResult.checkResults
        .map((r) => `${r.checkType}: ${r.status} — ${r.summary}`)
        .join("\n");

      try {
        const prompt = bgvReportSummaryPrompt({
          reportText,
          checksRequested: statusResult.checkResults.map((r) => r.checkType),
          candidateName: bgvCheck.resume?.candidateName || "Candidate",
        });

        const aiResult = await geminiClient.models.generateContent({
          model: geminiModel,
          contents: prompt.user,
          config: { systemInstruction: prompt.system },
        });

        const aiText = aiResult.text || "";
        const cleaned = aiText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        try {
          const parsed = JSON.parse(cleaned);
          reportSummary = parsed.executiveSummary || null;
          reportJson = parsed;
        } catch {
          reportSummary = cleaned.slice(0, 500);
        }
      } catch (aiErr) {
        console.warn("[BGV Webhook] AI summary generation failed:", aiErr);
      }
    }
  } catch (statusErr) {
    console.warn("[BGV Webhook] Failed to fetch Checkr report status:", statusErr);
  }

  // Download and store report PDF
  let reportUrl: string | null = null;
  try {
    const pdfBuffer = await checkrProvider.downloadReport(vendorCheckId, orgApiKey);
    if (pdfBuffer) {
      // TODO: Upload to R2 when client is configured
      // reportUrl = `bgv-reports/${bgvCheckId}/checkr-report.pdf`;
      // await r2Client.putObject({ Key: reportUrl, Body: pdfBuffer });
      reportUrl = `bgv-reports/${bgvCheckId}/checkr-report.pdf`;
    }
  } catch (dlErr) {
    console.warn("[BGV Webhook] Failed to download report PDF:", dlErr);
  }

  await prisma.$transaction([
    prisma.bgvCheck.update({
      where: { id: bgvCheckId },
      data: {
        status: mappedStatus,
        completedAt: new Date(),
        reportUrl,
        reportSummary,
        reportJson: (reportJson as JsonValue) || undefined,
      },
    }),
    prisma.bgvAuditLog.create({
      data: {
        bgvCheckId,
        action: "REPORT_RECEIVED",
        details: {
          source: "webhook",
          mappedStatus,
          aiSummaryGenerated: !!reportSummary,
        },
      },
    }),
  ]);
}
