"use server";

/**
 * BGV Server Actions
 *
 * Full lifecycle management for Background Verification checks:
 * - Initiate (Checkr API or Manual upload)
 * - Status tracking
 * - Report upload with PII Shield
 * - Review & adjudication
 * - FCRA adverse action compliance
 */

import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { getBgvProvider, isApiVendor } from "@/lib/bgv/provider-factory";
import { scanForPii, type PiiScanResult } from "@/lib/bgv/pii-shield";
import { geminiClient, geminiModel } from "@/lib/ai/client";
import { bgvReportSummaryPrompt } from "@/lib/ai/prompts/interview.prompts";
import type { BgvVendorType, BgvStatus, BgvAdjudication } from "@prisma/client";

// ── RBAC ────────────────────────────────────────────────────────────────────

const BGV_ROLES = ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER", "RECRUITER"];
const BGV_REVIEW_ROLES = ["ORG_ADMIN", "DEPT_ADMIN", "HIRING_MANAGER"];

// ── 1. Initiate BGV Check ───────────────────────────────────────────────────

export type InitiateBgvInput = {
  resumeId: string;
  positionId: string;
  vendorType: BgvVendorType;
  packageSlug: string;
  packageLabel: string;
  checksRequested: string[];
  workLocation: string;
  stageIndex: number;
  interviewId?: string;
};

export async function initiateBgvCheckAction(input: InitiateBgvInput) {
  const perms = await getCallerPermissions();
  if (!perms) return { success: false, error: "Unauthorized — please sign in." };
  if (!perms.roles?.some((r: string) => BGV_ROLES.includes(r))) {
    return { success: false, error: "You don't have permission to initiate BGV checks." };
  }

  const orgId = perms.orgId;
  if (!orgId) return { success: false, error: "No organization found." };

  try {
    // Get candidate info for the vendor
    const resume = await prisma.resume.findUnique({
      where: { id: input.resumeId },
      select: {
        candidateName: true,
        candidateEmail: true,
        phoneNumber: true,
      },
    });

    if (!resume?.candidateName || !resume?.candidateEmail) {
      return { success: false, error: "Candidate name and email are required for BGV." };
    }

    // Split name into first/last
    const nameParts = resume.candidateName.split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || firstName;

    // Get provider and initiate
    const provider = getBgvProvider(input.vendorType);

    // For API vendors, we need the org's API key
    let orgApiKey = "";
    if (isApiVendor(input.vendorType)) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { checkrApiKey: true },
      });
      orgApiKey = org?.checkrApiKey || process.env.CHECKR_API_KEY || "";
      if (!orgApiKey) {
        return { success: false, error: "Checkr API key not configured. Please set it up in Settings > Integrations." };
      }
    }

    const result = await provider.initiate(
      {
        firstName,
        lastName,
        email: resume.candidateEmail,
        phone: resume.phoneNumber || undefined,
        workLocation: input.workLocation,
      },
      input.packageSlug,
      orgApiKey,
    );

    // Try to resolve candidateId from User table
    const candidateUser = await prisma.user.findUnique({
      where: { email: resume.candidateEmail },
      select: { id: true },
    });

    // Create BgvCheck record
    const bgvCheck = await prisma.bgvCheck.create({
      data: {
        organizationId: orgId,
        positionId: input.positionId,
        resumeId: input.resumeId,
        candidateId: candidateUser?.id || null,
        interviewId: input.interviewId || null,
        vendorType: input.vendorType,
        vendorCheckId: result.vendorCheckId,
        vendorInviteUrl: result.invitationUrl || null,
        packageSlug: input.packageSlug,
        packageLabel: input.packageLabel,
        checksRequested: input.checksRequested,
        workLocation: input.workLocation,
        status: isApiVendor(input.vendorType) ? "INITIATED" : "INITIATED",
        stageIndex: input.stageIndex,
        // For manual: store the upload link token
        uploadLinkToken: !isApiVendor(input.vendorType) ? result.vendorCheckId : null,
        uploadLinkExpiresAt: !isApiVendor(input.vendorType)
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
          : null,
        // Cost tracking
        costCents: provider.getPackages().find((p) => p.slug === input.packageSlug)?.priceCents || null,
      },
    });

    // Audit log
    await prisma.bgvAuditLog.create({
      data: {
        bgvCheckId: bgvCheck.id,
        action: "INITIATED",
        actorId: perms.userId,
        details: {
          vendorType: input.vendorType,
          packageSlug: input.packageSlug,
          vendorCheckId: result.vendorCheckId,
        },
      },
    });

    revalidatePath(`/org-admin/positions/${input.positionId}`);

    return {
      success: true,
      bgvCheck,
      invitationUrl: result.invitationUrl,
      uploadToken: !isApiVendor(input.vendorType) ? result.vendorCheckId : undefined,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[BGV] Initiate failed:", message);
    return { success: false, error: `Failed to initiate BGV: ${message}` };
  }
}

// ── 2. Get BGV Check Status ─────────────────────────────────────────────────

export async function getBgvCheckStatusAction(input: {
  resumeId: string;
  positionId: string;
  stageIndex: number;
}) {
  const perms = await getCallerPermissions();
  if (!perms) return { success: false, error: "Unauthorized" };
  if (!perms.roles?.some((r: string) => BGV_ROLES.includes(r))) {
    return { success: false, error: "No permission" };
  }

  const bgvCheck = await prisma.bgvCheck.findUnique({
    where: {
      resumeId_positionId_stageIndex: {
        resumeId: input.resumeId,
        positionId: input.positionId,
        stageIndex: input.stageIndex,
      },
    },
    include: {
      auditLogs: {
        orderBy: { createdAt: "asc" },
        take: 20,
      },
    },
  });

  if (!bgvCheck) {
    return { success: true, bgvCheck: null }; // No BGV initiated yet
  }

  return { success: true, bgvCheck };
}

// ── 3. Review BGV Report ────────────────────────────────────────────────────

export type ReviewBgvInput = {
  bgvCheckId: string;
  adjudication: BgvAdjudication;
  reviewNotes?: string;
  positionId: string;
  resumeId: string;
  totalStages?: number;
};

export async function reviewBgvReportAction(input: ReviewBgvInput) {
  const perms = await getCallerPermissions();
  if (!perms) return { success: false, error: "Unauthorized" };
  if (!perms.roles?.some((r: string) => BGV_REVIEW_ROLES.includes(r))) {
    return { success: false, error: "Only Hiring Managers and Admins can review BGV reports." };
  }

  try {
    const bgvCheck = await prisma.bgvCheck.findUnique({
      where: { id: input.bgvCheckId },
    });

    if (!bgvCheck) return { success: false, error: "BGV check not found." };

    let newStatus: BgvStatus;

    switch (input.adjudication) {
      case "CLEAR":
        newStatus = "CLEAR";
        break;
      case "CONSIDER":
        newStatus = "CONSIDER";
        break;
      case "ADVERSE":
        // Can only go to ADVERSE if pre-adverse was already sent + dispute period passed
        if (!bgvCheck.preAdverseAt) {
          return { success: false, error: "Pre-adverse action notice must be sent before confirming adverse action." };
        }
        if (bgvCheck.disputeDeadline && bgvCheck.disputeDeadline > new Date()) {
          return { success: false, error: "Cannot confirm adverse action during the dispute period." };
        }
        newStatus = "ADVERSE_CONFIRMED";
        break;
      default:
        return { success: false, error: "Invalid adjudication." };
    }

    // Update BgvCheck
    const updated = await prisma.bgvCheck.update({
      where: { id: input.bgvCheckId },
      data: {
        adjudication: input.adjudication,
        reviewedAt: new Date(),
        reviewedById: perms.userId,
        reviewNotes: input.reviewNotes || null,
        status: newStatus,
      },
    });

    // If CLEAR → update pipeline (advance candidate)
    if (input.adjudication === "CLEAR" && bgvCheck.interviewId) {
      await prisma.interview.update({
        where: { id: bgvCheck.interviewId },
        data: { status: "COMPLETED" },
      });
    }

    // Audit log
    await prisma.bgvAuditLog.create({
      data: {
        bgvCheckId: input.bgvCheckId,
        action: "REVIEWED",
        actorId: perms.userId,
        details: {
          adjudication: input.adjudication,
          notes: input.reviewNotes,
        },
      },
    });

    revalidatePath(`/org-admin/positions/${input.positionId}`);

    return { success: true, bgvCheck: updated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[BGV] Review failed:", message);
    return { success: false, error: message };
  }
}

// ── 4. Upload BGV Report (with PII Shield) ──────────────────────────────────

export type UploadBgvReportInput = {
  bgvCheckId: string;
  reportText: string;        // Extracted text from the PDF for scanning
  reportBase64: string;      // Base64-encoded file for storage
  consentGiven: boolean;
  uploaderIp?: string;
};

export async function uploadBgvReportAction(input: UploadBgvReportInput) {
  // This action can be called by anyone with a valid token (public upload),
  // or by authenticated users
  const perms = await getCallerPermissions().catch(() => null);

  if (!input.consentGiven) {
    return { success: false, error: "PII consent attestation is required before uploading." };
  }

  try {
    const bgvCheck = await prisma.bgvCheck.findUnique({
      where: { id: input.bgvCheckId },
      select: {
        id: true,
        resumeId: true,
        positionId: true,
        organizationId: true,
        checksRequested: true,
        resume: { select: { candidateName: true } },
      },
    });

    if (!bgvCheck) return { success: false, error: "BGV check not found." };

    // 1. Log upload consent
    await prisma.$transaction([
      prisma.bgvCheck.update({
        where: { id: input.bgvCheckId },
        data: {
          uploadConsentGiven: true,
          uploadConsentAt: new Date(),
          uploadConsentIp: input.uploaderIp || null,
        },
      }),
      prisma.bgvAuditLog.create({
        data: {
          bgvCheckId: input.bgvCheckId,
          action: "UPLOAD_CONSENT_GIVEN",
          actorId: perms?.userId || null,
          actorIp: input.uploaderIp || null,
          details: { consentText: "PII redaction attestation" },
        },
      }),
    ]);

    // 2. Run PII Shield scan
    const scanResult: PiiScanResult = await scanForPii(input.reportText);

    if (!scanResult.passed) {
      // PII DETECTED → reject upload, log, return detections
      await prisma.$transaction([
        prisma.bgvCheck.update({
          where: { id: input.bgvCheckId },
          data: {
            piiScanPassed: false,
            piiScanDetails: scanResult.detections.map((d) => ({
              type: d.type,
              confidence: d.confidence,
              location: d.location,
              // Deliberately NOT storing the actual PII value
            })),
          },
        }),
        prisma.bgvAuditLog.create({
          data: {
            bgvCheckId: input.bgvCheckId,
            action: "PII_SCAN_FAILED",
            actorId: perms?.userId || null,
            details: {
              detectionCount: scanResult.detections.length,
              types: scanResult.detections.map((d) => d.type),
              scanDurationMs: scanResult.scanDurationMs,
            },
          },
        }),
      ]);

      return {
        success: false,
        error: "Sensitive information detected. Please redact and re-upload.",
        piiDetections: scanResult.detections,
      };
    }

    // 3. PII scan passed → store report
    // In production, this would upload to R2. For now, we store the base64 reference.
    const reportKey = `bgv-reports/${bgvCheck.organizationId}/${bgvCheck.id}/report.pdf`;

    // TODO: Upload to R2 when R2 client is configured
    // await r2Client.putObject({ Key: reportKey, Body: Buffer.from(input.reportBase64, 'base64') });

    // 4. Generate AI summary
    let reportSummary: string | null = null;
    let reportJson: Record<string, unknown> | null = null;
    type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

    try {
      const checksRequested = (bgvCheck.checksRequested as string[]) || [];
      const prompt = bgvReportSummaryPrompt({
        reportText: input.reportText,
        checksRequested,
        candidateName: bgvCheck.resume?.candidateName || "Unknown",
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
      console.error("[BGV] AI summary failed (non-blocking):", aiErr);
    }

    // 5. Update BgvCheck with all report data
    const updated = await prisma.bgvCheck.update({
      where: { id: input.bgvCheckId },
      data: {
        status: "COMPLETED",
        piiScanPassed: true,
        reportUrl: reportKey,
        reportSummary,
        reportJson: (reportJson as JsonValue) || undefined,
        completedAt: new Date(),
        uploadedById: perms?.userId || null,
        uploadedAt: new Date(),
        piiScanDetails: {
          passed: true,
          scanDurationMs: scanResult.scanDurationMs,
          engines: scanResult.engines,
        },
      },
    });

    // Audit log
    await prisma.bgvAuditLog.create({
      data: {
        bgvCheckId: input.bgvCheckId,
        action: "REPORT_UPLOADED",
        actorId: perms?.userId || null,
        details: {
          piiScanPassed: true,
          aiSummaryGenerated: !!reportSummary,
          scanDurationMs: scanResult.scanDurationMs,
        },
      },
    });

    revalidatePath(`/org-admin/positions/${bgvCheck.positionId}`);

    return { success: true, bgvCheck: updated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[BGV] Upload failed:", message);
    return { success: false, error: message };
  }
}

// ── 5. Send Pre-Adverse Action Notice ───────────────────────────────────────

export async function sendPreAdverseNoticeAction(input: {
  bgvCheckId: string;
  positionId: string;
}) {
  const perms = await getCallerPermissions();
  if (!perms) return { success: false, error: "Unauthorized" };
  if (!perms.roles?.some((r: string) => BGV_REVIEW_ROLES.includes(r))) {
    return { success: false, error: "Only Hiring Managers and Admins can send adverse action notices." };
  }

  try {
    // Calculate 5 business days from now
    const disputeDeadline = addBusinessDays(new Date(), 5);

    const updated = await prisma.bgvCheck.update({
      where: { id: input.bgvCheckId },
      data: {
        status: "PRE_ADVERSE_SENT",
        preAdverseAt: new Date(),
        disputeDeadline,
      },
    });

    // Audit log
    await prisma.bgvAuditLog.create({
      data: {
        bgvCheckId: input.bgvCheckId,
        action: "PRE_ADVERSE_SENT",
        actorId: perms.userId,
        details: {
          disputeDeadline: disputeDeadline.toISOString(),
          businessDays: 5,
        },
      },
    });

    // TODO: Send email to candidate with:
    // 1. Copy of the BGV report
    // 2. Summary of Rights under FCRA
    // 3. Notice that adverse action may be taken

    revalidatePath(`/org-admin/positions/${input.positionId}`);

    return { success: true, bgvCheck: updated, disputeDeadline };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[BGV] Pre-adverse failed:", message);
    return { success: false, error: message };
  }
}

// ── 6. Confirm Adverse Action ───────────────────────────────────────────────

export async function confirmAdverseActionAction(input: {
  bgvCheckId: string;
  positionId: string;
  resumeId: string;
}) {
  const perms = await getCallerPermissions();
  if (!perms) return { success: false, error: "Unauthorized" };
  if (!perms.roles?.some((r: string) => BGV_REVIEW_ROLES.includes(r))) {
    return { success: false, error: "Only Hiring Managers and Admins can confirm adverse action." };
  }

  try {
    const bgvCheck = await prisma.bgvCheck.findUnique({
      where: { id: input.bgvCheckId },
    });

    if (!bgvCheck) return { success: false, error: "BGV check not found." };

    // FCRA: Must have sent pre-adverse notice first
    if (!bgvCheck.preAdverseAt) {
      return { success: false, error: "Pre-adverse notice must be sent before confirming adverse action." };
    }

    // FCRA: Must wait for dispute period to pass
    if (bgvCheck.disputeDeadline && bgvCheck.disputeDeadline > new Date()) {
      const daysLeft = Math.ceil(
        (bgvCheck.disputeDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      return {
        success: false,
        error: `Dispute period still active. ${daysLeft} days remaining until ${bgvCheck.disputeDeadline.toLocaleDateString()}.`,
      };
    }

    // Confirm adverse action
    const updated = await prisma.bgvCheck.update({
      where: { id: input.bgvCheckId },
      data: {
        status: "ADVERSE_CONFIRMED",
        adjudication: "ADVERSE",
        adverseAt: new Date(),
      },
    });

    // Update candidate pipeline to REJECTED
    await prisma.resume.update({
      where: { id: input.resumeId },
      data: {
        pipelineStatus: "REJECTED",
        lastDecisionAt: new Date(),
        lastDecisionById: perms.userId,
        lastDecisionNote: "Rejected based on background verification findings (adverse action confirmed).",
      },
    });

    // Audit log
    await prisma.bgvAuditLog.create({
      data: {
        bgvCheckId: input.bgvCheckId,
        action: "ADVERSE_CONFIRMED",
        actorId: perms.userId,
        details: {
          preAdverseAt: bgvCheck.preAdverseAt?.toISOString(),
          disputeDeadline: bgvCheck.disputeDeadline?.toISOString(),
          confirmedAt: new Date().toISOString(),
        },
      },
    });

    // TODO: Send final adverse action notice email to candidate

    revalidatePath(`/org-admin/positions/${input.positionId}`);

    return { success: true, bgvCheck: updated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[BGV] Adverse action failed:", message);
    return { success: false, error: message };
  }
}

// ── 7. Generate Upload Link ─────────────────────────────────────────────────

export async function generateUploadLinkAction(input: {
  bgvCheckId: string;
  positionId: string;
}) {
  const perms = await getCallerPermissions();
  if (!perms) return { success: false, error: "Unauthorized" };
  if (!perms.roles?.some((r: string) => BGV_ROLES.includes(r))) {
    return { success: false, error: "No permission." };
  }

  try {
    const crypto = await import("crypto");
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const updated = await prisma.bgvCheck.update({
      where: { id: input.bgvCheckId },
      data: {
        uploadLinkToken: token,
        uploadLinkExpiresAt: expiresAt,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const uploadUrl = `${appUrl}/bgv-upload/${token}`;

    await prisma.bgvAuditLog.create({
      data: {
        bgvCheckId: input.bgvCheckId,
        action: "UPLOAD_LINK_GENERATED",
        actorId: perms.userId,
        details: { expiresAt: expiresAt.toISOString() },
      },
    });

    return {
      success: true,
      uploadUrl,
      token,
      expiresAt,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

// ── Utility: Add business days ──────────────────────────────────────────────

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      added++;
    }
  }
  return result;
}
