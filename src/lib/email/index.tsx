import { EmailProvider } from "./types";
import { MockEmailProvider } from "./providers/mock-provider";
import { ResendEmailProvider } from "./providers/resend-provider";
import { render } from "@react-email/render";
import InterviewInviteTemplate from "./templates/InterviewInvite";
import AiInterviewInviteTemplate from "./templates/AiInterviewInvite";
import * as React from "react";

// Resolve provider based on environment variables
function resolveProvider(): EmailProvider {
  const providerType = process.env.EMAIL_PROVIDER?.toLowerCase();

  // If explicitly set to resend, or if API key exists and no provider is specified
  if (providerType === "resend" || (!providerType && process.env.RESEND_API_KEY)) {
    return new ResendEmailProvider();
  }
  
  // Default fallback locally
  return new MockEmailProvider();
}

const provider = resolveProvider();

export const emailService = {
  /**
   * Generic provider-agnostic send method.
   */
  sendEmail: async (options: Parameters<EmailProvider["sendEmail"]>[0]) => {
    try {
      return await provider.sendEmail(options);
    } catch (error) {
      console.error("[EmailService] Unhandled error:", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  },

  /**
   * Business-specific action: Send an interview invite to a candidate.
   * Uses simple placeholder templates for now.
   */
  sendInterviewInvite: async (options: {
    to: string;
    candidateName: string;
    positionTitle: string;
    orgName?: string;
    inviteLink: string;
    inviteId?: string;
  }) => {
    // Generate the React Email payload
    const html = await render(
      <InterviewInviteTemplate
        candidateName={options.candidateName}
        positionTitle={options.positionTitle}
        orgName={options.orgName || "Our Organization"}
        inviteLink={options.inviteLink}
      />
    );

    // Provide a standardized plain-text fallback for maximum deliverability
    const text = `Hi ${options.candidateName},\n\nYou have been shortlisted for the ${options.positionTitle} role at ${options.orgName || "our organization"}.\n\nPlease review your invitation and schedule your interview here: ${options.inviteLink}`;

    const tags = options.inviteId ? [{ name: "invite_id", value: options.inviteId }] : undefined;

    // Dispatch via our generic EmailProvider interface
    return await provider.sendEmail({
      to: options.to,
      subject: `Invitation to Interview - ${options.positionTitle}`,
      html,
      text,
      tags
    });
  },

  /**
   * Sends an AI-interview-specific invite email.
   * Routes candidates to the AI pre-check page and explains the process.
   */
  sendAiInterviewInvite: async (options: {
    to: string;
    candidateName: string;
    positionTitle: string;
    orgName?: string;
    inviteLink: string;
    inviteId?: string;
  }) => {
    const html = await render(
      <AiInterviewInviteTemplate
        candidateName={options.candidateName}
        positionTitle={options.positionTitle}
        orgName={options.orgName || "Our Organization"}
        inviteLink={options.inviteLink}
      />
    );

    const text = `Hi ${options.candidateName},\n\nYou've been shortlisted for ${options.positionTitle} at ${options.orgName || "our organization"}.\n\nPlease complete your AI-led interview here: ${options.inviteLink}\n\nNo scheduling needed - complete it at your convenience.`;

    const tags = options.inviteId ? [{ name: "invite_id", value: options.inviteId }] : undefined;

    return await provider.sendEmail({
      to: options.to,
      subject: `Your AI Interview Invitation - ${options.positionTitle}`,
      html,
      text,
      tags
    });
  },

  /**
   * Generic transactional email with a heading, body, and optional CTA button.
   * Used for availability polls, confirmations, and notifications.
   */
  sendGenericEmail: async (options: {
    to: string;
    subject: string;
    previewText?: string;
    heading: string;
    body: string;
    ctaLabel?: string;
    ctaUrl?: string;
  }) => {
    const bodyHtml = options.body.replace(/\n/g, "<br/>");
    const ctaHtml = options.ctaLabel && options.ctaUrl
      ? `<div style="text-align:center;margin:24px 0">
           <a href="${options.ctaUrl}" style="display:inline-block;padding:12px 32px;background-color:#0d9488;color:#ffffff;font-weight:bold;font-size:14px;text-decoration:none;border-radius:8px;">
             ${options.ctaLabel}
           </a>
         </div>`
      : "";

    const html = `
      <div style="max-width:520px;margin:0 auto;font-family:system-ui,-apple-system,sans-serif;color:#1f2937;padding:32px 24px;">
        <h1 style="font-size:20px;font-weight:700;margin:0 0 16px">${options.heading}</h1>
        <p style="font-size:14px;line-height:1.6;color:#4b5563;margin:0 0 16px">${bodyHtml}</p>
        ${ctaHtml}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
        <p style="font-size:11px;color:#9ca3af;text-align:center">IQMela · Intelligent Hiring Platform</p>
      </div>
    `;

    const text = `${options.heading}\n\n${options.body.replace(/<[^>]*>/g, "")}\n\n${options.ctaUrl || ""}`;

    return await provider.sendEmail({
      to: options.to,
      subject: options.subject,
      html,
      text,
    });
  }
};
