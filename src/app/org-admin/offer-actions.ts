"use server";

import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";
import { OfferTemplate, JobOffer } from "@prisma/client";

// RBAC Roles that can manage offers
const OFFER_ROLES = ["ADMIN", "RECRUITER", "HIRING_MANAGER"];

/**
 * Fetch all offer templates for the organization
 */
export async function getOfferTemplatesAction() {
  try {
    const perms = await getCallerPermissions();
    if (!perms) return { success: false, error: "Unauthorized" };

    const templates = await prisma.offerTemplate.findMany({
      where: { organizationId: perms.orgId },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, templates };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[OfferTemplates] Fetch failed:", message);
    return { success: false, error: `Failed to fetch templates: ${message}` };
  }
}

/**
 * Create or Update an Offer Template
 */
export async function saveOfferTemplateAction(input: {
  id?: string;
  name: string;
  contentHtml: string;
  isStandard?: boolean;
}) {
  try {
    const perms = await getCallerPermissions();
    if (!perms) return { success: false, error: "Unauthorized" };
    if (!perms.roles?.some((r: string) => ["ADMIN"].includes(r))) {
       return { success: false, error: "Only admins can edit standard templates." };
    }

    let template;
    if (input.id) {
      template = await prisma.offerTemplate.update({
        where: { id: input.id, organizationId: perms.orgId },
        data: {
          name: input.name,
          contentHtml: input.contentHtml,
          isStandard: input.isStandard ?? false,
        },
      });
    } else {
      template = await prisma.offerTemplate.create({
        data: {
          organizationId: perms.orgId,
          name: input.name,
          contentHtml: input.contentHtml,
          isStandard: input.isStandard ?? false,
        },
      });
    }

    return { success: true, template };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[OfferTemplates] Save failed:", message);
    return { success: false, error: `Failed to save template: ${message}` };
  }
}

/**
 * Phase 2: Create Offer & Routing Array
 */
export async function createJobOfferAction(input: {
  resumeId: string;
  positionId: string;
  templateId?: string; // made optional
  baseSalary: number;
  currency: string;
  signOnBonus?: number;
  equityAmount?: string;
  startDate: string;
  expirationDate: string;
  approvers: { name: string; email: string; designation: string }[];
}) {
  try {
    const perms = await getCallerPermissions();
    if (!perms) return { success: false, error: "Unauthorized" };

    // Ensure we have a template
    let finalTemplateId = input.templateId;
    if (!finalTemplateId) {
      const defaultTemplate = await prisma.offerTemplate.findFirst({
        where: { organizationId: perms.orgId }
      });
      if (defaultTemplate) finalTemplateId = defaultTemplate.id;
      else {
        // Create one on the fly if missing (for demo purposes)
        const newTemplate = await prisma.offerTemplate.create({
          data: {
             organizationId: perms.orgId,
             name: "Default Standard Offer",
             contentHtml: "<h1>Employment Offer</h1><p>Congratulations. Please see your salary inline.</p>"
          }
        });
        finalTemplateId = newTemplate.id;
      }
    }

    // Create the JobOffer, its Approvers, and the initial Audit Logs in a transaction
    const offer = await prisma.$transaction(async (tx) => {
      // 1. Create the base offer
      const newOffer = await tx.jobOffer.create({
        data: {
          organizationId: perms.orgId,
          resumeId: input.resumeId,
          positionId: input.positionId,
          templateId: finalTemplateId!,
          baseSalary: input.baseSalary,
          currency: input.currency,
          signOnBonus: input.signOnBonus,
          equityAmount: input.equityAmount,
          startDate: new Date(input.startDate),
          expirationDate: new Date(input.expirationDate),
          status: "PENDING_APPROVAL", // Start state machine
          
          approvals: {
            create: input.approvers.map((a, idx) => ({
              stepOrder: idx + 1,
              name: a.name,
              email: a.email,
              designation: a.designation,
              status: "PENDING",
            })),
          },
          auditLogs: {
            create: [
              {
                action: "DRAFT_CREATED",
                actorId: perms.userId,
                details: { status: "DRAFT_CREATED" },
              },
              {
                action: "SENT_FOR_APPROVAL",
                actorId: perms.userId,
                details: { totalApprovers: input.approvers.length },
              }
            ],
          }
        },
        include: { approvals: true },
      });

      // Update the pipeline stage to OFFER_PENDING
      await tx.resume.update({
        where: { id: input.resumeId },
        data: { pipelineStatus: "OFFER_PENDING" },
      });

      return newOffer;
    });

    if (offer.approvals && offer.approvals.length > 0) {
      const firstApprover = offer.approvals.find(a => a.stepOrder === 1);
      if (firstApprover) {
          console.log(`\n\n=========================================\n`);
          console.log(`[EMAIL DISPATCH MOCK]: Sent email to ${firstApprover.email}`);
          console.log(`Subject: Important: Approval Required for Offer`);
          console.log(`Link: http://localhost:3000/offer-approval/${firstApprover.approvalToken}`);
          console.log(`\n=========================================\n\n`);
      }
    }

    return { success: true, offer };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[CreateJobOffer] Failed:", message);
    return { success: false, error: `Failed to create offer: ${message}` };
  }
}

/**
 * Fetch Approval Details via secure token
 */
export async function getApprovalDetailsAction(token: string) {
  try {
    const approval = await prisma.offerApproval.findUnique({
      where: { approvalToken: token },
      include: {
        offer: {
          include: {
            resume: {
              select: { candidateName: true, candidateEmail: true },
            },
            position: {
              select: { title: true, department: true },
            },
            template: true,
          }
        }
      }
    });

    if (!approval) return { success: false, error: "Invalid or expired link" };
    return { success: true, approval };
  } catch (err: unknown) {
    return { success: false, error: "System error" };
  }
}

/**
 * Accept or Reject an Approval Step
 */
export async function submitApprovalStepAction(token: string, action: "APPROVE" | "REJECT", notes?: string) {
  try {
    const res = await prisma.$transaction(async (tx) => {
      const currentApproval = await tx.offerApproval.findUnique({
        where: { approvalToken: token },
        include: { offer: { include: { approvals: true } } }
      });

      if (!currentApproval) throw new Error("Invalid token");
      if (currentApproval.status !== "PENDING") throw new Error("This step has already been processed");

      // Update the explicit approval step
      const updatedApproval = await tx.offerApproval.update({
        where: { id: currentApproval.id },
        data: {
          status: action === "APPROVE" ? "APPROVED" : "REJECTED",
          reviewNotes: notes,
        }
      });

      // Audit Log
      await tx.offerAuditLog.create({
        data: {
          offerId: currentApproval.offerId,
          action: action === "APPROVE" ? "APPROVED_BY_STAKEHOLDER" : "REJECTED_BY_STAKEHOLDER",
          details: {
            approverName: currentApproval.name,
            notes,
          }
        }
      });

      if (action === "REJECT") {
        // Rollback the offer to CHANGES_REQUESTED
        await tx.jobOffer.update({
          where: { id: currentApproval.offerId },
          data: { status: "CHANGES_REQUESTED" }
        });
        return { status: "REJECTED" };
      }

      // If APPROVED, check if there are pending steps
      const allApprovals = currentApproval.offer.approvals;
      const nextPending = allApprovals.find(a => a.stepOrder > currentApproval.stepOrder && a.status === "PENDING" && a.id !== currentApproval.id);

      if (nextPending) {
         console.log(`\n\n=========================================\n`);
         console.log(`[EMAIL DISPATCH MOCK]: Sent email to ${nextPending.email}`);
         console.log(`Subject: Sequential Approval Required for Offer`);
         console.log(`Link: http://localhost:3000/offer-approval/${nextPending.approvalToken}`);
         console.log(`\n=========================================\n\n`);
         return { status: "NEXT_PENDING", nextEmail: nextPending.email };
      }

      // No more pending steps — FREEZE & Lock
      await tx.jobOffer.update({
        where: { id: currentApproval.offerId },
        data: { status: "FROZEN" }
      });
      
      const frozenOffer = await tx.jobOffer.findUnique({
          where: { id: currentApproval.offerId },
          include: { resume: true }
      });

      console.log(`\n\n=========================================\n`);
      console.log(`[EMAIL DISPATCH MOCK]: Sent email to CANDIDATE ${frozenOffer?.resume?.candidateEmail || 'candidate@example.com'}`);
      console.log(`Subject: Your IQMela Offical Offer is Ready!`);
      console.log(`Link: http://localhost:3000/offer/${frozenOffer?.candidateToken}`);
      console.log(`\n=========================================\n\n`);

      await tx.offerAuditLog.create({
        data: {
          offerId: currentApproval.offerId,
          action: "OFFER_FROZEN_AND_APPROVED",
          details: { message: "All stakeholder approvals collected." }
        }
      });

      return { status: "FROZEN" };
    });

    return { success: true, result: res };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
