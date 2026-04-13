import { EmailProvider, SendEmailOptions } from "../types";

export class MockEmailProvider implements EmailProvider {
  async sendEmail(options: SendEmailOptions) {
    console.log("========================================");
    console.log(`[MOCK EMAIL PROVIDER] Sending Email`);
    console.log(`TO: ${Array.isArray(options.to) ? options.to.join(", ") : options.to}`);
    console.log(`SUBJECT: ${options.subject}`);
    if (options.text) console.log(`TEXT: ${options.text}`);
    if (options.html) console.log(`HTML: (Hidden for brevity, length: ${options.html.length})`);
    console.log("========================================");

    // Simulate mild network latency
    await new Promise(resolve => setTimeout(resolve, 600));

    // 5% mock failure rate just for realistic testing scenarios
    if (Math.random() < 0.05) {
      console.error("[MOCK EMAIL PROVIDER] Simulated SMTP timeout error.");
      return { success: false, error: "SMTP connection timed out (Simulated)" };
    }

    return { success: true, messageId: `mock-${Date.now()}` };
  }
}
