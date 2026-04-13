import { EmailProvider } from "./types";
import { MockEmailProvider } from "./providers/mock-provider";
import { ResendEmailProvider } from "./providers/resend-provider";
import { render } from "@react-email/render";
import InterviewInviteTemplate from "./templates/InterviewInvite";
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
  }
};
