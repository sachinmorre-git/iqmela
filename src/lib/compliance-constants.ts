// ── Compliance Constants for Job Distribution & AI Intake ────────────────────
// Auto-appended to published JDs for legal compliance.

/**
 * AI Screening Disclosure — NYC Local Law 144 + Illinois AIPA compliant.
 * Auto-appended to the bottom of every externally published JD.
 */
export const AI_SCREENING_DISCLOSURE = `
📋 AI-Assisted Screening Notice
This employer uses AI-assisted technology to help review and evaluate applications. 
All AI-generated recommendations are reviewed by qualified human recruiters before 
any employment decisions are made. If you have questions about the use of AI in our 
hiring process, please contact us.
`.trim();

/**
 * EEOC Equal Opportunity Statement — Federal requirement for all job postings.
 */
export const EEOC_STATEMENT = `
Equal Opportunity Employer
We are an equal opportunity employer and do not discriminate on the basis of race, 
color, religion, sex, sexual orientation, gender identity, national origin, disability, 
veteran status, or any other legally protected characteristic.
`.trim();

/**
 * Data retention period in months for archived intake candidates.
 * After this period, candidate PII is anonymized and resume files are deleted.
 * GDPR Article 5(1)(e) requires data be kept "no longer than is necessary."
 * 24 months is standard industry practice for recruitment data.
 */
export const DATA_RETENTION_MONTHS = 24;

/**
 * GDPR maximum response time for deletion requests.
 * Article 12(3): "without undue delay and in any event within one month."
 */
export const GDPR_DELETION_DEADLINE_DAYS = 30;

/**
 * Builds the full JD text with compliance disclosures appended.
 * Used when generating the Indeed XML feed and Google Jobs JSON-LD.
 */
export function buildCompliantJdText(
  jdText: string,
  companyName?: string
): string {
  const eeocWithCompany = companyName
    ? EEOC_STATEMENT.replace(
        "We are an equal opportunity employer",
        `${companyName} is an equal opportunity employer`
      )
    : EEOC_STATEMENT;

  return `${jdText.trim()}

---

${AI_SCREENING_DISCLOSURE}

${eeocWithCompany}`;
}

/**
 * Calculates the GDPR purge date for an intake candidate.
 * @param receivedAt - When the application was received
 * @returns Date when automatic purge should occur
 */
export function calculatePurgeDate(receivedAt: Date): Date {
  const purgeDate = new Date(receivedAt);
  purgeDate.setMonth(purgeDate.getMonth() + DATA_RETENTION_MONTHS);
  return purgeDate;
}
