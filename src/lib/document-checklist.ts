/**
 * Country-Aware Document Checklist Configuration
 *
 * Defines the required/optional documents for each supported country.
 * Used by both the Candidate Portal (upload UI) and Recruiter Dashboard (verification).
 *
 * v1: US + India
 */

export type DocCategory = "IDENTITY" | "TAX" | "EMPLOYMENT" | "EDUCATION" | "BACKGROUND" | "LEGAL";

export type DocRequirement = {
  docType: string;
  label: string;
  category: DocCategory;
  required: boolean;
  description: string;
  acceptedFormats: string[];
  legalReference?: string;
  maxSizeMB?: number;
};

export type CountryConfig = {
  name: string;
  flag: string;
  code: string;
  docs: DocRequirement[];
};

// ── Category display helpers ──────────────────────────────────────────────────
export const CATEGORY_CONFIG: Record<DocCategory, { label: string; icon: string; color: string }> = {
  IDENTITY:   { label: "Identity",       icon: "🪪", color: "rose" },
  TAX:        { label: "Tax & Payroll",  icon: "💰", color: "amber" },
  EMPLOYMENT: { label: "Employment",     icon: "💼", color: "blue" },
  EDUCATION:  { label: "Education",      icon: "🎓", color: "indigo" },
  BACKGROUND: { label: "Background",     icon: "🔍", color: "emerald" },
  LEGAL:      { label: "Legal",          icon: "⚖️", color: "purple" },
};

// ── Country Checklists ────────────────────────────────────────────────────────

export const COUNTRY_CHECKLISTS: Record<string, CountryConfig> = {
  US: {
    name: "United States",
    flag: "🇺🇸",
    code: "US",
    docs: [
      { docType: "I9_FORM",            label: "Form I-9 (Employment Eligibility)",   category: "IDENTITY",    required: true,  description: "Verifies identity and employment authorization",                acceptedFormats: ["PDF"],              legalReference: "USCIS Form I-9",   maxSizeMB: 10 },
      { docType: "W4_FORM",            label: "Form W-4 (Tax Withholding)",          category: "TAX",         required: true,  description: "Federal income tax withholding certificate",                    acceptedFormats: ["PDF"],              legalReference: "IRS Form W-4",     maxSizeMB: 10 },
      { docType: "SSN_CARD",           label: "Social Security Card",                category: "IDENTITY",    required: true,  description: "Social Security Number verification",                           acceptedFormats: ["PDF", "JPG", "PNG"], maxSizeMB: 5 },
      { docType: "DRIVERS_LICENSE",    label: "Driver's License / State ID",         category: "IDENTITY",    required: false, description: "Government-issued photo identification",                        acceptedFormats: ["PDF", "JPG", "PNG"], maxSizeMB: 5 },
      { docType: "PASSPORT",           label: "Passport",                            category: "IDENTITY",    required: false, description: "Valid U.S. or foreign passport",                                acceptedFormats: ["PDF", "JPG", "PNG"], maxSizeMB: 10 },
      { docType: "BGC_CONSENT",        label: "Background Check Consent",            category: "BACKGROUND",  required: true,  description: "Written consent for background verification",                   acceptedFormats: ["PDF"],              maxSizeMB: 10 },
      { docType: "EEO_SELF_ID",        label: "EEO Self-Identification (Voluntary)", category: "LEGAL",       required: false, description: "Voluntary demographic disclosure for EEOC",                     acceptedFormats: ["PDF"],              legalReference: "OFCCP CC-305",     maxSizeMB: 5 },
      { docType: "DIRECT_DEPOSIT",     label: "Direct Deposit Authorization",        category: "TAX",         required: false, description: "Bank routing and account for payroll",                          acceptedFormats: ["PDF"],              maxSizeMB: 5 },
      { docType: "DEGREE_CERT",        label: "Degree Certificate / Transcript",     category: "EDUCATION",   required: false, description: "Highest education credential",                                  acceptedFormats: ["PDF", "JPG", "PNG"], maxSizeMB: 10 },
      { docType: "OFFER_LETTER_SIGNED",label: "Signed Offer Letter",                 category: "EMPLOYMENT",  required: true,  description: "Counter-signed employment offer",                               acceptedFormats: ["PDF"],              maxSizeMB: 10 },
    ],
  },
  IN: {
    name: "India",
    flag: "🇮🇳",
    code: "IN",
    docs: [
      { docType: "AADHAAR",            label: "Aadhaar Card",                        category: "IDENTITY",    required: true,  description: "12-digit unique identification number issued by UIDAI",         acceptedFormats: ["PDF", "JPG", "PNG"], legalReference: "UIDAI",            maxSizeMB: 5 },
      { docType: "PAN_CARD",           label: "PAN Card",                            category: "TAX",         required: true,  description: "Permanent Account Number for income tax purposes",              acceptedFormats: ["PDF", "JPG", "PNG"], legalReference: "Income Tax Act",   maxSizeMB: 5 },
      { docType: "PASSPORT",           label: "Passport",                            category: "IDENTITY",    required: false, description: "Valid Indian passport",                                         acceptedFormats: ["PDF", "JPG", "PNG"], maxSizeMB: 10 },
      { docType: "PREV_PAYSLIPS",      label: "Last 3 Months Payslips",              category: "EMPLOYMENT",  required: true,  description: "Salary proof from previous employer",                           acceptedFormats: ["PDF"],              maxSizeMB: 10 },
      { docType: "RELIEVING_LETTER",   label: "Relieving / Experience Letter",       category: "EMPLOYMENT",  required: true,  description: "Experience certificate from last employer",                      acceptedFormats: ["PDF"],              maxSizeMB: 10 },
      { docType: "DEGREE_CERT",        label: "Degree Certificate / Marksheets",     category: "EDUCATION",   required: true,  description: "All academic credentials (10th, 12th, Degree)",                 acceptedFormats: ["PDF", "JPG", "PNG"], maxSizeMB: 15 },
      { docType: "ADDRESS_PROOF",      label: "Address Proof",                       category: "IDENTITY",    required: true,  description: "Utility bill, bank statement, or Aadhaar-based address proof",  acceptedFormats: ["PDF", "JPG", "PNG"], maxSizeMB: 5 },
      { docType: "BANK_DETAILS",       label: "Cancelled Cheque / Bank Details",     category: "TAX",         required: true,  description: "For salary credit — cancelled cheque or bank passbook front page", acceptedFormats: ["PDF", "JPG", "PNG"], maxSizeMB: 5 },
      { docType: "BGC_CONSENT",        label: "Background Verification Consent",     category: "BACKGROUND",  required: true,  description: "Written consent for third-party background verification",        acceptedFormats: ["PDF"],              maxSizeMB: 10 },
      { docType: "PHOTO",              label: "Passport-Size Photo",                 category: "IDENTITY",    required: true,  description: "Recent passport-size photograph (white background preferred)",   acceptedFormats: ["JPG", "PNG"],        maxSizeMB: 2 },
    ],
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

export function getCountryConfig(code: string): CountryConfig | null {
  return COUNTRY_CHECKLISTS[code.toUpperCase()] ?? null;
}

export function getRequiredDocs(code: string): DocRequirement[] {
  const config = getCountryConfig(code);
  if (!config) return [];
  return config.docs.filter((d) => d.required);
}

export function getDocsByCategory(code: string): Record<DocCategory, DocRequirement[]> {
  const config = getCountryConfig(code);
  if (!config) return {} as Record<DocCategory, DocRequirement[]>;

  const grouped: Record<DocCategory, DocRequirement[]> = {
    IDENTITY: [],
    TAX: [],
    EMPLOYMENT: [],
    EDUCATION: [],
    BACKGROUND: [],
    LEGAL: [],
  };

  for (const doc of config.docs) {
    grouped[doc.category].push(doc);
  }

  return grouped;
}

export function getSupportedCountries(): { code: string; name: string; flag: string }[] {
  return Object.values(COUNTRY_CHECKLISTS).map((c) => ({
    code: c.code,
    name: c.name,
    flag: c.flag,
  }));
}

/** Calculate completion percentage for a country checklist given uploaded doc types */
export function getCompletionStats(
  countryCode: string,
  uploadedDocTypes: string[]
): { total: number; uploaded: number; required: number; requiredUploaded: number; percent: number } {
  const config = getCountryConfig(countryCode);
  if (!config) return { total: 0, uploaded: 0, required: 0, requiredUploaded: 0, percent: 0 };

  const total = config.docs.length;
  const uploaded = config.docs.filter((d) => uploadedDocTypes.includes(d.docType)).length;
  const required = config.docs.filter((d) => d.required).length;
  const requiredUploaded = config.docs.filter((d) => d.required && uploadedDocTypes.includes(d.docType)).length;
  const percent = required > 0 ? Math.round((requiredUploaded / required) * 100) : 100;

  return { total, uploaded, required, requiredUploaded, percent };
}
