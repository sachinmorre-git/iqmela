/**
 * PII Consent Constants
 *
 * Client-safe consent text for the BGV upload flow.
 * Separated from pii-shield.ts to avoid bundling Gemini SDK in client components.
 */

export const PII_CONSENT_TEXT = `I confirm this report has been redacted of all sensitive Personally Identifiable Information including:

• Social Security Numbers (SSNs)
• Date of Birth (DOB)
• Driver's License Numbers
• Financial Account Numbers
• Bank Routing Numbers
• Passport Numbers

IQMela does not store or process sensitive PII. Uploading a document containing unredacted PII violates our Terms of Service.`;
