/**
 * legal-versions.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all legal agreement versions and entity info.
 *
 * ── ENTITY STRUCTURE ─────────────────────────────────────────────────────────
 * RelyOnAI LLP is the registered legal entity.
 * IQMela™ is a product and intellectual property of RelyOnAI LLP.
 * All agreements are made with RelyOnAI LLP trading as IQMela.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * HOW TO TRIGGER RE-CONSENT:
 * Bump the relevant version string. On next login, any user/org whose stored
 * version doesn't match will be shown the agreement gate again.
 *
 * VERSION SEMANTICS:
 *   patch (1.0.x) — typo fixes / formatting — no re-consent triggered
 *   minor (1.x.0) — material changes to data use or clauses — re-consent required
 *   major (x.0.0) — structural overhaul — re-consent + advance notice required
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const LEGAL_VERSIONS = {
  /** Platform Terms of Service — shown to all users at first login */
  PLATFORM_TOS: "1.0.0",

  /** Privacy Policy — linked from all consent flows */
  PRIVACY_POLICY: "1.0.0",

  /** Org Master Service Agreement + DPA — shown to org admins at org setup */
  ORG_MSA: "1.0.0",

  /** Interviewer Code of Conduct — shown to interviewers / org members */
  INTERVIEWER_COC: "1.0.0",

  /** Effective date displayed in all legal documents */
  EFFECTIVE_DATE: "May 1, 2026",

  /**
   * Registered legal entity — the contracting party in all agreements.
   * RelyOnAI LLP is a registered limited liability partnership.
   */
  COMPANY_NAME: "RelyOnAI LLP",

  /**
   * Product name and trademark.
   * IQMela™ is an intellectual property of RelyOnAI LLP.
   */
  PRODUCT_NAME: "IQMela",

  /**
   * Trading name used in customer-facing communications.
   * RelyOnAI LLP, trading as IQMela.
   */
  TRADING_AS: "RelyOnAI LLP (trading as IQMela™)",

  /** Contact email for legal/privacy requests */
  LEGAL_EMAIL: "legal@iqmela.com",

  /** Privacy contact for DPDP Act 2023 data principal requests */
  PRIVACY_EMAIL: "privacy@iqmela.com",

  /** Sales / commercial contact */
  SALES_EMAIL: "sales@iqmela.com",
} as const;

export type LegalVersionKey = keyof typeof LEGAL_VERSIONS;
