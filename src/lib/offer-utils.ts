/**
 * Offer Letter Utilities
 *
 * Provides template variable substitution and expiration checking
 * for the offer letter pipeline.
 */

/**
 * Replace template placeholders with actual offer data.
 *
 * Supported variables:
 *   {{candidateName}}, {{positionTitle}}, {{organizationName}},
 *   {{baseSalary}}, {{currency}}, {{signOnBonus}}, {{equityAmount}},
 *   {{startDate}}, {{expirationDate}}, {{department}}
 */
export function renderOfferDocument(
  templateHtml: string,
  data: {
    candidateName?: string;
    positionTitle?: string;
    organizationName?: string;
    baseSalary?: number;
    currency?: string;
    signOnBonus?: number | null;
    equityAmount?: string | null;
    startDate?: Date | string;
    expirationDate?: Date | string;
    department?: string | null;
  }
): string {
  const fmt = (val: number | undefined, currency = "USD") => {
    if (val == null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(val);
  };

  const fmtDate = (d: Date | string | undefined) => {
    if (!d) return "—";
    const date = typeof d === "string" ? new Date(d) : d;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const vars: Record<string, string> = {
    candidateName: data.candidateName || "Candidate",
    positionTitle: data.positionTitle || "the position",
    organizationName: data.organizationName || "the company",
    baseSalary: fmt(data.baseSalary, data.currency),
    currency: data.currency || "USD",
    signOnBonus: data.signOnBonus ? fmt(data.signOnBonus, data.currency) : "N/A",
    equityAmount: data.equityAmount || "N/A",
    startDate: fmtDate(data.startDate),
    expirationDate: fmtDate(data.expirationDate),
    department: data.department || "—",
  };

  let result = templateHtml;
  for (const [key, value] of Object.entries(vars)) {
    // Match {{key}} with optional whitespace: {{ key }}
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "gi");
    result = result.replace(regex, value);
  }

  return result;
}

/**
 * Check if an offer has expired.
 */
export function isOfferExpired(expirationDate: Date | string): boolean {
  const expiry = typeof expirationDate === "string" ? new Date(expirationDate) : expirationDate;
  return expiry < new Date();
}

/**
 * Get human-readable time remaining until expiration.
 */
export function getExpirationLabel(expirationDate: Date | string): {
  expired: boolean;
  label: string;
  urgency: "safe" | "warning" | "critical" | "expired";
} {
  const expiry = typeof expirationDate === "string" ? new Date(expirationDate) : expirationDate;
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();

  if (diffMs <= 0) {
    return { expired: true, label: "Expired", urgency: "expired" };
  }

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 7) {
    return { expired: false, label: `${days} days remaining`, urgency: "safe" };
  }
  if (days > 2) {
    return { expired: false, label: `${days} days remaining`, urgency: "warning" };
  }
  if (days > 0) {
    return { expired: false, label: `${days}d ${hours}h remaining`, urgency: "critical" };
  }
  return { expired: false, label: `${hours} hours remaining`, urgency: "critical" };
}
