export interface SendEmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  tags?: { name: string; value: string }[];
}

export interface EmailProvider {
  /**
   * Generic interface for sending an email.
   * Resolves to a success status and an optional message ID or error string.
   */
  sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }>;
}
