import { Resend } from "resend";
import { EmailProvider, SendEmailOptions } from "../types";

export class ResendEmailProvider implements EmailProvider {
  private resend: Resend | null = null;
  private readonly defaultFrom = process.env.EMAIL_FROM || "IQMela <noreply@iqmela.com>";
  private readonly defaultReplyTo = process.env.EMAIL_REPLY_TO || "support@iqmela.com";

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  async sendEmail(options: SendEmailOptions) {
    if (!this.resend) {
      console.warn("[ResendProvider] Missing RESEND_API_KEY. Cannot send email.");
      return { success: false, error: "Missing RESEND_API_KEY" };
    }

    try {
      // Assemble standard email payload
      const payload: any = {
        from: this.defaultFrom,
        to: options.to,
        subject: options.subject,
      };

      // Add optional fields if provided
      if (options.cc) payload.cc = options.cc;
      if (options.bcc) payload.bcc = options.bcc;
      
      // Reply-to cascade: explicitly provided -> environment default -> omitted
      if (options.replyTo) {
        payload.reply_to = options.replyTo;
      } else if (this.defaultReplyTo) {
        payload.reply_to = this.defaultReplyTo;
      }

      // We must provide at least text or HTML. Resend SDK allows either.
      if (options.text) payload.text = options.text;
      if (options.html) payload.html = options.html;
      if (options.tags) payload.tags = options.tags;

      // Ensure we don't send an empty body (which Resend API would reject)
      if (!payload.text && !payload.html) {
        payload.text = "(No content)";
      }

      const response = await this.resend.emails.send(payload);

      if (response.error) {
        console.error("[ResendProvider] Resend API error:", response.error.message);
        return { success: false, error: response.error.message };
      }

      return { success: true, messageId: response.data?.id };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Network/Unknown error";
      console.error("[ResendProvider] Unhandled exception sending email:", errMsg);
      return { success: false, error: errMsg };
    }
  }
}
