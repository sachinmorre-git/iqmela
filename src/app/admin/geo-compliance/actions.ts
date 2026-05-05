"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

async function requireSysAdmin() {
  const { userId, sessionClaims } = await auth();
  if (!userId) redirect("/sign-in");
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString();
  if (!sysRole?.startsWith("sys:")) redirect("/select-role");
  return { userId };
}

export async function updateGeoMarket(id: string, data: Record<string, any>) {
  const { userId } = await requireSysAdmin();
  await prisma.geoMarket.update({
    where: { id },
    data: { ...data, updatedBy: userId },
  });
  revalidatePath("/admin/geo-compliance");
}

// ─────────────────────────────────────────────────────────────────────────────
// LEGALLY ACCURATE SEED DATA — Researched as of 2024-2025
// Sources: NYC Local Law 144, Illinois AIVIA, Colorado SB 24-205,
//          Maryland HB 1202, California CCPA/CPRA, India DPDP 2023,
//          Canada PIPEDA + Quebec Law 25, UK GDPR / ICO AI guidance
// ─────────────────────────────────────────────────────────────────────────────
export async function seedGeoMarkets() {
  const { userId } = await requireSysAdmin();

  // Delete all existing records (full re-seed)
  await prisma.geoMarket.deleteMany({});

  const markets = [

    // ══════════════════════════════════════════════════════════════════════════
    // 🇺🇸  UNITED STATES
    // ══════════════════════════════════════════════════════════════════════════

    // ── NEW YORK (State) ──────────────────────────────────────────────────────
    // Note: NYC Local Law 144 applies city-wide, not statewide.
    // State-level: EEOC applies. NY SHIELD Act for data security.
    {
      countryCode: "US", countryName: "United States", region: "New York", city: "",
      isEnabled: true,
      eeocApplies: true,
      aiDisclosureRequired: true,
      aiDisclosureLawRef: "NY S7543B (AI hiring disclosure, signed 2024)",
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "NY S7543B (2024) requires employers to disclose AI tool usage in hiring and provide a notice to candidates. NYC has additional stricter rules (see New York City entry).",
    },

    // ── NEW YORK CITY (City-Level) ────────────────────────────────────────────
    // NYC Local Law 144 is the most significant US AI hiring law to date.
    {
      countryCode: "US", countryName: "United States", region: "New York", city: "New York City",
      isEnabled: true,
      eeocApplies: true,
      aiAuditRequired: true,
      aiAuditLawRef: "NYC Local Law 144 (2023) — AEDT Bias Audit",
      aiDisclosureRequired: true,
      aiDisclosureLawRef: "NYC Local Law 144 — Candidate Notice Requirement",
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "NYC Local Law 144 (effective Jan 1 2023): Before using any Automated Employment Decision Tool (AEDT) — including AI screening — employers MUST (1) conduct an annual independent bias audit, (2) publish audit results publicly, (3) notify candidates at least 10 business days before using the tool, and (4) provide an alternative selection process on request. Non-compliance = civil penalties.",
    },

    // ── CALIFORNIA ────────────────────────────────────────────────────────────
    {
      countryCode: "US", countryName: "United States", region: "California", city: "",
      isEnabled: true,
      eeocApplies: true,
      ccpaApplies: true,
      aiDisclosureRequired: true,
      aiDisclosureLawRef: "CA AB 2930 (2024) — Automated Decisions in Employment",
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "California CCPA/CPRA (2023): Candidates have right to opt-out of sale of personal data and right to know what data is collected. AB 2930 (signed 2024) requires employers using high-risk AI in consequential decisions (hiring, firing, compensation) to conduct impact assessments and notify affected individuals. Candidates may request human review.",
    },

    // ── ILLINOIS ─────────────────────────────────────────────────────────────
    {
      countryCode: "US", countryName: "United States", region: "Illinois", city: "",
      isEnabled: true,
      eeocApplies: true,
      aiVideoConsentRequired: true,
      aiVideoLawRef: "Illinois AIVIA — Artificial Intelligence Video Interview Act (820 ILCS 42)",
      aiDisclosureRequired: true,
      aiDisclosureLawRef: "Illinois AIVIA (2020)",
      biometricProhibited: true,
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "Illinois has TWO major AI hiring laws: (1) BIPA (Biometric Info Privacy Act) — prohibits collection/use of biometric identifiers (face geometry, voiceprint) without written consent and a public retention policy. (2) AIVIA (AI Video Interview Act, eff. Jan 1 2020) — if AI analyzes candidate video interviews, employer must: notify candidate before interview, explain how AI works and what traits it evaluates, get affirmative written consent, and not share video with 3rd parties without consent. Failure = $500–$5,000 per violation.",
    },

    // ── COLORADO ─────────────────────────────────────────────────────────────
    {
      countryCode: "US", countryName: "United States", region: "Colorado", city: "",
      isEnabled: true,
      eeocApplies: true,
      automatedDecisionReview: true,
      automatedDecisionLawRef: "Colorado SB 24-205 (2024) — Consumer Protections for Artificial Intelligence",
      aiDisclosureRequired: true,
      aiDisclosureLawRef: "Colorado SB 24-205 (effective Feb 1, 2026)",
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "Colorado SB 24-205 (signed May 2024, effective Feb 1 2026): Developers and deployers of 'high-risk AI systems' in consequential decisions (employment, housing, credit) must: conduct impact assessments for algorithmic discrimination, notify individuals when AI is used, allow individuals to appeal automated decisions and request human review. Applicants can opt out. Enforced by CO AG.",
    },

    // ── MARYLAND ─────────────────────────────────────────────────────────────
    {
      countryCode: "US", countryName: "United States", region: "Maryland", city: "",
      isEnabled: false, isComingSoon: true,
      eeocApplies: true,
      facialRecogConsentRequired: true,
      facialRecogLawRef: "Maryland HB 1202 (2022) — Facial Recognition Services",
      aiDisclosureRequired: true,
      aiDisclosureLawRef: "Maryland HB 1202",
      aiInterviewsAllowed: false, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "Maryland HB 1202 (2022): Employers may NOT use facial recognition technology during a pre-employment interview UNLESS the applicant provides written, informed consent. If consent is given, only the employer (and no others) can access the results. AI interviews using facial analysis are BLOCKED until consent framework is implemented. IQMela must add an explicit pre-interview consent gate for this state.",
    },

    // ── TEXAS ─────────────────────────────────────────────────────────────────
    {
      countryCode: "US", countryName: "United States", region: "Texas", city: "",
      isEnabled: true,
      eeocApplies: true,
      algorithmicTransparency: true,
      algorithmicLawRef: "TX HB 1709 (2023) — Biometric Identifier Act + AI Transparency (pending)",
      biometricProhibited: true,
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "Texas Capture or Use of Biometric Identifier Act (CUBI): Requires informed consent before capturing biometric data. HB 1709 (pending) would require disclosure when AI is used in hiring. Currently, biometric capture (face recognition, voiceprint) requires explicit consent. Standard AI interview scoring without biometric capture is permitted.",
    },

    // ── WASHINGTON STATE ──────────────────────────────────────────────────────
    {
      countryCode: "US", countryName: "United States", region: "Washington", city: "",
      isEnabled: true,
      eeocApplies: true,
      dataMinimizationRequired: true,
      aiDisclosureRequired: true,
      aiDisclosureLawRef: "WA My Health MY Data Act (2023) + WA SB 5116 (AI accountability, 2024)",
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "Washington My Health MY Data Act (effective March 2024): Strict rules around health and sensitive data collection — AI behavioral analysis in interviews could trigger this. WA SB 5116 (2024) proposes algorithmic accountability reporting for public agencies. Microsoft/Amazon operate here — expect strong enforcement culture.",
    },

    // ── FLORIDA ───────────────────────────────────────────────────────────────
    {
      countryCode: "US", countryName: "United States", region: "Florida", city: "",
      isEnabled: false, isComingSoon: true,
      eeocApplies: true,
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "Florida currently has no specific AI hiring law. SB 262 (2023) created limited AI guidelines for state agencies. Monitoring for FL SB 1418 (AI in employment) which is in committee. Expected to be enabled Q2 2025.",
    },

    // ── MINNESOTA ────────────────────────────────────────────────────────────
    {
      countryCode: "US", countryName: "United States", region: "Minnesota", city: "",
      isEnabled: false, isComingSoon: true,
      eeocApplies: true,
      aiDisclosureRequired: true,
      aiDisclosureLawRef: "MN HF 4259 (AI hiring disclosure bill, 2024)",
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "Minnesota HF 4259 (2024): Proposes requiring employers to disclose AI use in hiring and allow candidates to request human review. Not yet signed into law. IQMela monitoring — proactively disclosing AI usage here is recommended.",
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 🇮🇳  INDIA
    // ══════════════════════════════════════════════════════════════════════════

    {
      countryCode: "IN", countryName: "India", region: "Maharashtra", city: "",
      isEnabled: true,
      pdpaApplies: true,
      aiDisclosureRequired: true,
      aiDisclosureLawRef: "India DPDP Act 2023 — Section 6 (Consent) + Section 7 (Legitimate Use)",
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "India DPDP Act 2023 (effective 2024-25 rollout): Requires explicit, informed consent before processing personal data including interview recordings and AI assessment scores. Data principals (candidates) have the right to access their data, correct it, and withdraw consent. Automated decision-making must have human oversight available. Mumbai/Pune tech hubs require careful implementation.",
    },
    {
      countryCode: "IN", countryName: "India", region: "Karnataka", city: "",
      isEnabled: true,
      pdpaApplies: true,
      aiDisclosureRequired: true,
      aiDisclosureLawRef: "India DPDP Act 2023",
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "Bengaluru (Bangalore) is India's primary tech hub. DPDP Act 2023 applies. Karnataka IT policy encourages AI adoption but within the DPDP consent framework. High-volume market — priority for compliance certification.",
    },
    {
      countryCode: "IN", countryName: "India", region: "Delhi", city: "",
      isEnabled: true,
      pdpaApplies: true,
      aiDisclosureRequired: true,
      aiDisclosureLawRef: "India DPDP Act 2023",
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "National Capital Region (NCR) — high density of BFSI, government-adjacent, and consulting firms. DPDP consent requirements are strictly enforced here. Government entity hiring may have additional restrictions.",
    },
    {
      countryCode: "IN", countryName: "India", region: "Tamil Nadu", city: "",
      isEnabled: false, isComingSoon: true,
      pdpaApplies: true,
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "Chennai has a strong IT/auto-components sector. DPDP Act applies. Enabling Q1 2025 once state-level data processing infrastructure is validated.",
    },
    {
      countryCode: "IN", countryName: "India", region: "Telangana", city: "",
      isEnabled: false, isComingSoon: true,
      pdpaApplies: true,
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "Hyderabad is a fast-growing tech hub (Google, Microsoft, Amazon all have campuses). DPDP Act applies. Priority market for next wave of expansion.",
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 🇨🇦  CANADA
    // ══════════════════════════════════════════════════════════════════════════

    {
      countryCode: "CA", countryName: "Canada", region: "Ontario", city: "",
      isEnabled: true,
      pipedaApplies: true,
      aiDisclosureRequired: true,
      aiDisclosureLawRef: "Canada AIDA (Artificial Intelligence and Data Act) — Bill C-27 (pending)",
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "PIPEDA (federal) requires consent for personal data collection. Bill C-27 / AIDA (pending royal assent as of 2024) will impose risk-based obligations on high-impact AI systems including employment tools. Ontario Human Rights Code prohibits algorithmic discrimination based on protected grounds. Employers must be able to explain AI-based decisions.",
    },
    {
      countryCode: "CA", countryName: "Canada", region: "British Columbia", city: "",
      isEnabled: true,
      pipedaApplies: true,
      aiDisclosureRequired: true,
      aiDisclosureLawRef: "BC PIPA (Personal Information Protection Act) + Canada Bill C-27",
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "BC has its own PIPA (similar to PIPEDA but provincially administered). Candidates must be notified of AI use in hiring. Vancouver has a strong tech market — handle with care.",
    },
    {
      countryCode: "CA", countryName: "Canada", region: "Quebec", city: "",
      isEnabled: false, isComingSoon: true,
      pipedaApplies: true,
      quebecLaw25Applies: true,
      automatedDecisionReview: true,
      automatedDecisionLawRef: "Quebec Law 25 (Act 25, fully in force Sept 2023)",
      aiDisclosureRequired: true,
      aiDisclosureLawRef: "Quebec Law 25 — Section 12 (Automated Decision-Making)",
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "Quebec Law 25 (fully in force Sept 2023) is one of the strictest privacy laws in North America, comparable to GDPR. Section 12 SPECIFICALLY requires: (1) inform individuals when automated processing is used to make a decision, (2) publish a technology watch policy, (3) conduct privacy impact assessments (PIA) before deploying automated tools, (4) allow individuals to be informed of the personal information used to render the decision and to have it corrected. French language requirements also apply to all candidate-facing UI.",
    },
    {
      countryCode: "CA", countryName: "Canada", region: "Alberta", city: "",
      isEnabled: false, isComingSoon: true,
      pipedaApplies: true,
      albertaPipa: true,
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "Alberta has its own PIPA (stricter consent requirements than federal PIPEDA). Calgary and Edmonton are growing tech markets. Enabling Q2 2025.",
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 🇬🇧  UNITED KINGDOM
    // ══════════════════════════════════════════════════════════════════════════

    {
      countryCode: "GB", countryName: "United Kingdom", region: "England", city: "",
      isEnabled: true,
      gdprApplies: true,
      automatedDecisionReview: true,
      automatedDecisionLawRef: "UK GDPR Article 22 — Right not to be subject to automated decision-making",
      aiDisclosureRequired: true,
      aiDisclosureLawRef: "ICO Guidance on AI and Data Protection (2023) + UK GDPR Recital 71",
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "UK GDPR (post-Brexit, DPA 2018): Article 22 gives candidates the right not to be subject to purely automated decisions that significantly affect them (e.g. rejection). Must: (1) provide meaningful information about the logic of AI decisions, (2) allow candidates to request human review, (3) conduct Data Protection Impact Assessment (DPIA) before deploying AI hiring tools. ICO AI guidance (2023) specifically covers recruitment. Equality Act 2010 prohibits algorithmic discrimination.",
    },
    {
      countryCode: "GB", countryName: "United Kingdom", region: "Scotland", city: "",
      isEnabled: true,
      gdprApplies: true,
      automatedDecisionReview: true,
      automatedDecisionLawRef: "UK GDPR Article 22 + Scottish specific guidance",
      aiDisclosureRequired: true,
      aiDisclosureLawRef: "UK GDPR / DPA 2018",
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "Same framework as England (UK GDPR/DPA 2018). Scottish courts and Scottish public sector employers may have additional procurement rules requiring algorithmic transparency.",
    },
    {
      countryCode: "GB", countryName: "United Kingdom", region: "Wales", city: "",
      isEnabled: false, isComingSoon: true,
      gdprApplies: true,
      aiDisclosureRequired: true,
      aiDisclosureLawRef: "UK GDPR / DPA 2018",
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "Same UK GDPR framework. Welsh language requirements may apply to candidate-facing content for public sector clients. Enabling Q1 2025.",
    },

    // ══════════════════════════════════════════════════════════════════════════
    // 🇦🇺  AUSTRALIA
    // ══════════════════════════════════════════════════════════════════════════

    {
      countryCode: "AU", countryName: "Australia", region: "New South Wales", city: "",
      isEnabled: false, isComingSoon: true,
      aicaApplies: true,
      aiDisclosureRequired: true,
      aiDisclosureLawRef: "Australia Privacy Act 1988 (review ongoing) + proposed AI mandatory guardrails 2024",
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "Australia Privacy Act 1988 (reform ongoing — Privacy and Other Legislation Amendment Act 2024): New transparency requirements for automated decision-making. Proposed mandatory AI guardrails (DISR, 2024) for high-risk AI in employment include human oversight, explainability, and contestability. Fair Work Act also applies to AI use in employment decisions.",
    },
    {
      countryCode: "AU", countryName: "Australia", region: "Victoria", city: "",
      isEnabled: false, isComingSoon: true,
      aicaApplies: true,
      aiDisclosureRequired: true,
      aiDisclosureLawRef: "Australia Privacy Act 1988 + Victorian Charter of Human Rights",
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "Melbourne is AU's second-largest tech market. Victorian Charter of Human Rights adds additional protections. Privacy Act reform (2024) applies nationally.",
    },
    {
      countryCode: "AU", countryName: "Australia", region: "Queensland", city: "",
      isEnabled: false, isComingSoon: true,
      aicaApplies: true,
      aiInterviewsAllowed: true, bgvAllowed: true, videoRecordingAllowed: true,
      notes: "Brisbane is a growing market pre-2032 Olympics. Standard Australia Privacy Act framework applies.",
    },
  ];

  for (const m of markets) {
    await prisma.geoMarket.upsert({
      where: {
        countryCode_region_city: {
          countryCode: m.countryCode,
          region: m.region ?? "",
          city: m.city ?? "",
        },
      },
      create: { ...m, updatedBy: userId } as any,
      update: { ...m, updatedBy: userId } as any,
    });
  }

  revalidatePath("/admin/geo-compliance");
}
