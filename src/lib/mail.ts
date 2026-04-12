/**
 * Mail service abstraction.
 * Currently operates in mock/logging mode unless a real provider is configured.
 */
export const mailService = {
  sendInterviewInvite: async (options: {
    to: string;
    candidateName: string;
    positionTitle: string;
    orgName?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      // E.g., if (process.env.RESEND_API_KEY) { return await sendRealMail(...) }

      console.log("========================================");
      console.log(`[MOCK MAIL SERVICE] Sending Interview Invite`);
      console.log(`TO: ${options.to}`);
      console.log(`SUBJECT: Invitation to Interview - ${options.positionTitle}`);
      console.log(`BODY: Hi ${options.candidateName}, you've been shortlisted for the ${options.positionTitle} position.`);
      console.log("========================================");

      // Simulate mild network latency
      await new Promise(resolve => setTimeout(resolve, 600));

      // 5% mock failure rate just for realistic testing scenarios
      if (Math.random() < 0.05) {
        throw new Error("SMTP connection timed out (Simulated)");
      }

      return { success: true };
    } catch (error) {
      console.error("[MOCK MAIL SERVICE] Failed to send email", error);
      return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }
};
