"use server";

import { prisma } from "@/lib/prisma";
import { getCallerPermissions } from "@/lib/rbac";
import { OfferTemplate, JobOffer } from "@prisma/client";
import { emailService } from "@/lib/email";
import { dispatchNotification } from "@/lib/notify";

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

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
        const approvalLink = `${getBaseUrl()}/offer-approval/${firstApprover.approvalToken}`;
        await emailService.sendGenericEmail({
          to: firstApprover.email,
          subject: "Action Required: Offer Approval Needed",
          heading: "Offer Approval Request",
          body: `Hi ${firstApprover.name},\n\nYou have been designated as an approver for a job offer. Please review the offer details and provide your decision.`,
          ctaLabel: "Review & Approve",
          ctaUrl: approvalLink,
        });
      }
    }

    // Fire in-app notification to first approver
    if (offer.approvals?.[0]) {
      const firstApprover = offer.approvals[0];
      // Find userId for the approver email (if they're in the system)
      const approverUser = await prisma.user.findFirst({ where: { email: firstApprover.email } });
      if (approverUser) {
        dispatchNotification({
          organizationId: perms.orgId,
          userId: approverUser.id,
          type: "OFFER_APPROVED",
          title: "Offer Approval Required",
          body: `You have been asked to approve an offer. Please review and provide your decision.`,
          link: `/offer-approval/${firstApprover.approvalToken}`,
          sendPush: true,
        }).catch(() => {});
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
         const nextLink = `${getBaseUrl()}/offer-approval/${nextPending.approvalToken}`;
         await emailService.sendGenericEmail({
           to: nextPending.email,
           subject: "Action Required: Sequential Offer Approval",
           heading: "Offer Approval Request",
           body: `Hi ${nextPending.name},\n\nA previous approver has approved this offer. It is now your turn to review and provide your decision.`,
           ctaLabel: "Review & Approve",
           ctaUrl: nextLink,
         });
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

      const candidateEmail = frozenOffer?.resume?.candidateEmail || frozenOffer?.resume?.overrideEmail;
      const candidateOfferLink = `${getBaseUrl()}/offer/${frozenOffer?.candidateToken}`;
      if (candidateEmail) {
        await emailService.sendGenericEmail({
          to: candidateEmail,
          subject: "Your Official Offer Letter is Ready!",
          heading: "Congratulations! 🎉",
          body: `Hi ${frozenOffer?.resume?.candidateName || "there"},\n\nWe are thrilled to extend an official offer for you. Please review the complete offer details by clicking the button below.`,
          ctaLabel: "View Your Offer",
          ctaUrl: candidateOfferLink,
        });
      }

      await tx.offerAuditLog.create({
        data: {
          offerId: currentApproval.offerId,
          action: "OFFER_FROZEN_AND_APPROVED",
          details: { message: "All stakeholder approvals collected." }
        }
      });

      return { status: "FROZEN" };
    });

    // Notify the offer creator that the offer is fully approved
    const fullOffer = await prisma.jobOffer.findUnique({
      where: { id: res.status === "FROZEN" ? (await prisma.offerApproval.findUnique({ where: { approvalToken: token } }))?.offerId || "" : "" },
      select: { organizationId: true, resumeId: true, resume: { select: { candidateName: true } } },
    });

    return { success: true, result: res };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Fetch an existing offer for a resume+position (recruiter tracker view)
 */
export async function getOfferByResumeAction(resumeId: string, positionId: string) {
  try {
    const perms = await getCallerPermissions();
    if (!perms) return { success: false, error: "Unauthorized" };

    const offer = await prisma.jobOffer.findFirst({
      where: {
        resumeId,
        positionId,
        organizationId: perms.orgId,
      },
      include: {
        approvals: {
          orderBy: { stepOrder: "asc" },
        },
        auditLogs: {
          orderBy: { createdAt: "asc" },
        },
        position: {
          select: { title: true },
        },
        resume: {
          select: { candidateName: true, candidateEmail: true },
        },
      },
    });

    if (!offer) return { success: false, error: "No offer found" };
    return { success: true, offer: JSON.parse(JSON.stringify(offer)) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Resend approval reminder to a pending stakeholder
 */
export async function resendApprovalAction(approvalId: string) {
  try {
    const perms = await getCallerPermissions();
    if (!perms) return { success: false, error: "Unauthorized" };

    const approval = await prisma.offerApproval.findUnique({
      where: { id: approvalId },
      include: {
        offer: true,
      },
    });

    if (!approval) return { success: false, error: "Approval not found" };
    if (approval.offer.organizationId !== perms.orgId) return { success: false, error: "Unauthorized" };
    if (approval.status !== "PENDING") return { success: false, error: "This approval is no longer pending" };

    // Log the reminder email
    const reminderLink = `${getBaseUrl()}/offer-approval/${approval.approvalToken}`;
    await emailService.sendGenericEmail({
      to: approval.email,
      subject: "Reminder: Offer Approval Still Pending",
      heading: "Friendly Reminder",
      body: `Hi ${approval.name},\n\nThis is a reminder that an offer approval is awaiting your review. Please take a moment to review and provide your decision.`,
      ctaLabel: "Review & Approve",
      ctaUrl: reminderLink,
    });

    // Create audit log
    await prisma.offerAuditLog.create({
      data: {
        offerId: approval.offerId,
        action: "REMINDER_SENT",
        actorId: perms.userId,
        details: {
          approverName: approval.name,
          approverEmail: approval.email,
        },
      },
    });

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Revise an existing offer: update comp/dates, void old approvals, re-route
 */
export async function reviseOfferAction(input: {
  offerId: string;
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

    const offer = await prisma.jobOffer.findFirst({
      where: { id: input.offerId, organizationId: perms.orgId },
    });

    if (!offer) return { success: false, error: "Offer not found" };
    if (offer.status === "FROZEN" || offer.status === "ACCEPTED") {
      return { success: false, error: "Cannot revise: offer is already frozen or accepted" };
    }

    const updatedOffer = await prisma.$transaction(async (tx) => {
      // 1. Delete old approvals
      await tx.offerApproval.deleteMany({ where: { offerId: input.offerId } });

      // 2. Update the offer with new data
      const updated = await tx.jobOffer.update({
        where: { id: input.offerId },
        data: {
          baseSalary: input.baseSalary,
          currency: input.currency,
          signOnBonus: input.signOnBonus,
          equityAmount: input.equityAmount,
          startDate: new Date(input.startDate),
          expirationDate: new Date(input.expirationDate),
          status: "PENDING_APPROVAL",
          approvals: {
            create: input.approvers.map((a, idx) => ({
              stepOrder: idx + 1,
              name: a.name,
              email: a.email,
              designation: a.designation,
              status: "PENDING",
            })),
          },
        },
        include: { approvals: true },
      });

      // 3. Audit log
      await tx.offerAuditLog.create({
        data: {
          offerId: input.offerId,
          action: "OFFER_REVISED",
          actorId: perms.userId,
          details: {
            newBaseSalary: input.baseSalary,
            newApproverCount: input.approvers.length,
          },
        },
      });

      return updated;
    });

    // Send to first approver
    if (updatedOffer.approvals?.length > 0) {
      const first = updatedOffer.approvals.find(a => a.stepOrder === 1);
      if (first) {
        const revisedLink = `${getBaseUrl()}/offer-approval/${first.approvalToken}`;
        await emailService.sendGenericEmail({
          to: first.email,
          subject: "Revised Offer: Approval Required",
          heading: "Offer Has Been Revised",
          body: `Hi ${first.name},\n\nAn offer has been revised with updated compensation details. Please review the updated offer and provide your approval.`,
          ctaLabel: "Review Revised Offer",
          ctaUrl: revisedLink,
        });
      }
    }

    return { success: true, offer: JSON.parse(JSON.stringify(updatedOffer)) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

/**
 * Manually mark an approval step as approved (recruiter override)
 */
export async function manualApproveAction(approvalId: string, notes?: string) {
  try {
    const perms = await getCallerPermissions();
    if (!perms) return { success: false, error: "Unauthorized" };

    const result = await prisma.$transaction(async (tx) => {
      const approval = await tx.offerApproval.findUnique({
        where: { id: approvalId },
        include: { offer: { include: { approvals: true, resume: true } } },
      });

      if (!approval) throw new Error("Approval not found");
      if (approval.offer.organizationId !== perms.orgId) throw new Error("Unauthorized");
      if (approval.status !== "PENDING") throw new Error("This step is already processed");

      // 1. Mark as approved
      await tx.offerApproval.update({
        where: { id: approvalId },
        data: {
          status: "APPROVED",
          reviewNotes: notes || "Manually approved by recruiter",
        },
      });

      // 2. Audit log
      await tx.offerAuditLog.create({
        data: {
          offerId: approval.offerId,
          action: "MANUALLY_APPROVED",
          actorId: perms.userId,
          details: {
            approverName: approval.name,
            approverEmail: approval.email,
            notes: notes || "Manually approved by recruiter",
          },
        },
      });

      // 3. Check if there are more pending steps
      const allApprovals = approval.offer.approvals;
      const nextPending = allApprovals.find(
        a => a.stepOrder > approval.stepOrder && a.status === "PENDING" && a.id !== approval.id
      );

      if (nextPending) {
        const manualNextLink = `${getBaseUrl()}/offer-approval/${nextPending.approvalToken}`;
        await emailService.sendGenericEmail({
          to: nextPending.email,
          subject: "Action Required: Offer Approval Needed",
          heading: "Offer Approval Request",
          body: `Hi ${nextPending.name},\n\nA previous approver has approved this offer. It is now your turn to review and provide your decision.`,
          ctaLabel: "Review & Approve",
          ctaUrl: manualNextLink,
        });
        return { status: "NEXT_PENDING" as const };
      }

      // All approved — freeze the offer
      await tx.jobOffer.update({
        where: { id: approval.offerId },
        data: { status: "FROZEN" },
      });

      await tx.offerAuditLog.create({
        data: {
          offerId: approval.offerId,
          action: "OFFER_FROZEN_AND_APPROVED",
          details: { message: "All stakeholder approvals collected." },
        },
      });

      const candidateEmail = approval.offer.resume?.candidateEmail || "candidate@example.com";
      const candidateToken = (await tx.jobOffer.findUnique({ where: { id: approval.offerId } }))?.candidateToken;

      const manualCandidateLink = `${getBaseUrl()}/offer/${candidateToken}`;
      if (candidateEmail) {
        await emailService.sendGenericEmail({
          to: candidateEmail,
          subject: "Your Official Offer Letter is Ready!",
          heading: "Congratulations! 🎉",
          body: `We are thrilled to extend an official offer to you. Please review the complete offer details by clicking the button below.`,
          ctaLabel: "View Your Offer",
          ctaUrl: manualCandidateLink,
        });
      }

      return { status: "FROZEN" as const };
    });

    return { success: true, result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
