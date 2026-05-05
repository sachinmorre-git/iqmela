/**
 * src/lib/locale-utils.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized locale, timezone, and currency formatting utilities.
 *
 * USAGE (server-side):
 *   import { formatDate, formatTime, formatCurrency } from "@/lib/locale-utils";
 *   formatDate(someDate, { timezone: "Asia/Kolkata", locale: "en-IN" })
 *
 * USAGE (client-side via hook):
 *   const { formatDate, formatCurrency } = useLocale();
 *   formatDate(someDate)  // auto-uses user/org locale
 *
 * Resolution priority for timezone/locale/currency:
 *   1. Explicit parameter (always wins)
 *   2. User profile setting (InterviewerProfile.timezone, etc.)
 *   3. Organization default (Organization.defaultTimezone, etc.)
 *   4. Browser auto-detect (client-side only)
 *   5. Fallback: "America/New_York" / "en-US" / "USD"
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Defaults ────────────────────────────────────────────────────────────────

export const DEFAULT_TIMEZONE = "America/New_York";
export const DEFAULT_LOCALE   = "en-US";
export const DEFAULT_CURRENCY = "USD";

// ── Types ───────────────────────────────────────────────────────────────────

export interface LocaleContext {
  timezone?: string;    // IANA timezone, e.g. "Asia/Kolkata"
  locale?: string;      // BCP 47 locale, e.g. "en-IN"
  currency?: string;    // ISO 4217, e.g. "INR"
}

export type DateStyle = "short" | "medium" | "long" | "full" | "relative";

// ── Date Formatting ─────────────────────────────────────────────────────────

/**
 * Format a Date to a localized date string.
 *
 * @param date - The date to format (Date | string | number)
 * @param options - Style and locale overrides
 *
 * @example
 *   formatDate(new Date())
 *   // "May 2, 2026"
 *
 *   formatDate(new Date(), { style: "short", locale: "en-IN", timezone: "Asia/Kolkata" })
 *   // "2/5/26"
 *
 *   formatDate(new Date(), { style: "full" })
 *   // "Saturday, May 2, 2026"
 */
export function formatDate(
  date: Date | string | number,
  options?: { style?: DateStyle } & LocaleContext
): string {
  const d = ensureDate(date);
  if (!d) return "—";

  const style = options?.style ?? "medium";
  const locale = options?.locale ?? DEFAULT_LOCALE;
  const tz = options?.timezone ?? DEFAULT_TIMEZONE;

  // Relative time ("2 hours ago", "3 days ago")
  if (style === "relative") {
    return formatRelative(d, locale);
  }

  const intlOptions: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    ...DATE_STYLE_MAP[style],
  };

  try {
    return new Intl.DateTimeFormat(locale, intlOptions).format(d);
  } catch {
    // Fallback if locale/timezone is invalid
    return new Intl.DateTimeFormat(DEFAULT_LOCALE, intlOptions).format(d);
  }
}

/**
 * Format a Date to a localized time string.
 *
 * @example
 *   formatTime(new Date(), { timezone: "Asia/Kolkata" })
 *   // "3:00 PM IST"
 */
export function formatTime(
  date: Date | string | number,
  options?: { showTimezone?: boolean } & LocaleContext
): string {
  const d = ensureDate(date);
  if (!d) return "—";

  const locale = options?.locale ?? DEFAULT_LOCALE;
  const tz = options?.timezone ?? DEFAULT_TIMEZONE;
  const showTz = options?.showTimezone ?? true;

  const intlOptions: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    ...(showTz ? { timeZoneName: "short" } : {}),
  };

  try {
    return new Intl.DateTimeFormat(locale, intlOptions).format(d);
  } catch {
    return new Intl.DateTimeFormat(DEFAULT_LOCALE, intlOptions).format(d);
  }
}

/**
 * Format a Date to a full localized datetime string.
 *
 * @example
 *   formatDateTime(new Date(), { timezone: "Asia/Kolkata", locale: "en-IN" })
 *   // "2 May 2026, 3:00 PM IST"
 */
export function formatDateTime(
  date: Date | string | number,
  options?: { showTimezone?: boolean } & LocaleContext
): string {
  const d = ensureDate(date);
  if (!d) return "—";

  const locale = options?.locale ?? DEFAULT_LOCALE;
  const tz = options?.timezone ?? DEFAULT_TIMEZONE;
  const showTz = options?.showTimezone ?? true;

  const intlOptions: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    ...(showTz ? { timeZoneName: "short" } : {}),
  };

  try {
    return new Intl.DateTimeFormat(locale, intlOptions).format(d);
  } catch {
    return new Intl.DateTimeFormat(DEFAULT_LOCALE, intlOptions).format(d);
  }
}

// ── Currency Formatting ─────────────────────────────────────────────────────

/**
 * Format a number as a localized currency string.
 *
 * @example
 *   formatCurrency(150000, { currency: "INR", locale: "en-IN" })
 *   // "₹1,50,000.00"
 *
 *   formatCurrency(120000)
 *   // "$120,000.00"
 *
 *   formatCurrency(0.0042, { compact: true })
 *   // "$0.00"
 */
export function formatCurrency(
  amount: number,
  options?: { compact?: boolean; minimumFractionDigits?: number; maximumFractionDigits?: number } & LocaleContext
): string {
  const locale = options?.locale ?? DEFAULT_LOCALE;
  const currency = options?.currency ?? DEFAULT_CURRENCY;
  const compact = options?.compact ?? false;

  const intlOptions: Intl.NumberFormatOptions = {
    style: "currency",
    currency,
    minimumFractionDigits: options?.minimumFractionDigits ?? (compact ? 0 : 2),
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    ...(compact ? { notation: "compact", compactDisplay: "short" } : {}),
  };

  try {
    return new Intl.NumberFormat(locale, intlOptions).format(amount);
  } catch {
    return new Intl.NumberFormat(DEFAULT_LOCALE, intlOptions).format(amount);
  }
}

/**
 * Format a number with locale-aware thousands separators (non-currency).
 *
 * @example
 *   formatNumber(1500000, { locale: "en-IN" })
 *   // "15,00,000"
 */
export function formatNumber(
  value: number,
  options?: { compact?: boolean } & LocaleContext
): string {
  const locale = options?.locale ?? DEFAULT_LOCALE;
  const compact = options?.compact ?? false;

  const intlOptions: Intl.NumberFormatOptions = compact
    ? { notation: "compact", compactDisplay: "short" }
    : {};

  try {
    return new Intl.NumberFormat(locale, intlOptions).format(value);
  } catch {
    return new Intl.NumberFormat(DEFAULT_LOCALE, intlOptions).format(value);
  }
}

// ── Timezone Utilities ──────────────────────────────────────────────────────

/**
 * Get a human-readable timezone label.
 *
 * @example
 *   getTimezoneLabel("Asia/Kolkata")  // "IST (UTC+5:30)"
 *   getTimezoneLabel("America/New_York")  // "EDT (UTC-4:00)"
 */
export function getTimezoneLabel(timezone: string): string {
  try {
    const now = new Date();
    const short = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    })
      .formatToParts(now)
      .find(p => p.type === "timeZoneName")?.value ?? timezone;

    const long = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "longOffset",
    })
      .formatToParts(now)
      .find(p => p.type === "timeZoneName")?.value ?? "";

    return `${short} (${long})`;
  } catch {
    return timezone;
  }
}

/**
 * Get the browser's auto-detected timezone (client-side only).
 * Falls back to DEFAULT_TIMEZONE if Intl is unavailable.
 */
export function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Get the browser's auto-detected locale (client-side only).
 * Falls back to DEFAULT_LOCALE if navigator is unavailable.
 */
export function detectBrowserLocale(): string {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  return navigator.language ?? DEFAULT_LOCALE;
}

// ── Common Timezone List (for dropdowns) ────────────────────────────────────

export const COMMON_TIMEZONES = [
  { value: "America/New_York",      label: "Eastern (New York)" },
  { value: "America/Chicago",       label: "Central (Chicago)" },
  { value: "America/Denver",        label: "Mountain (Denver)" },
  { value: "America/Los_Angeles",   label: "Pacific (Los Angeles)" },
  { value: "America/Anchorage",     label: "Alaska" },
  { value: "Pacific/Honolulu",      label: "Hawaii" },
  { value: "America/Toronto",       label: "Toronto" },
  { value: "America/Vancouver",     label: "Vancouver" },
  { value: "America/Sao_Paulo",     label: "São Paulo" },
  { value: "America/Mexico_City",   label: "Mexico City" },
  { value: "Europe/London",         label: "London (GMT/BST)" },
  { value: "Europe/Paris",          label: "Paris (CET)" },
  { value: "Europe/Berlin",         label: "Berlin (CET)" },
  { value: "Europe/Amsterdam",      label: "Amsterdam (CET)" },
  { value: "Europe/Madrid",         label: "Madrid (CET)" },
  { value: "Europe/Rome",           label: "Rome (CET)" },
  { value: "Europe/Zurich",         label: "Zurich (CET)" },
  { value: "Europe/Stockholm",      label: "Stockholm (CET)" },
  { value: "Europe/Moscow",         label: "Moscow" },
  { value: "Europe/Istanbul",       label: "Istanbul" },
  { value: "Asia/Dubai",            label: "Dubai (GST)" },
  { value: "Asia/Kolkata",          label: "India (IST)" },
  { value: "Asia/Colombo",          label: "Sri Lanka" },
  { value: "Asia/Dhaka",            label: "Bangladesh (BST)" },
  { value: "Asia/Bangkok",          label: "Bangkok (ICT)" },
  { value: "Asia/Singapore",        label: "Singapore (SGT)" },
  { value: "Asia/Hong_Kong",        label: "Hong Kong (HKT)" },
  { value: "Asia/Shanghai",         label: "China (CST)" },
  { value: "Asia/Tokyo",            label: "Tokyo (JST)" },
  { value: "Asia/Seoul",            label: "Seoul (KST)" },
  { value: "Australia/Sydney",      label: "Sydney (AEST)" },
  { value: "Australia/Melbourne",   label: "Melbourne (AEST)" },
  { value: "Pacific/Auckland",      label: "Auckland (NZST)" },
  { value: "Africa/Lagos",          label: "Lagos (WAT)" },
  { value: "Africa/Nairobi",        label: "Nairobi (EAT)" },
  { value: "Africa/Johannesburg",   label: "Johannesburg (SAST)" },
  { value: "Africa/Cairo",          label: "Cairo (EET)" },
] as const;

// ── Common Currencies (for dropdowns) ───────────────────────────────────────

export const COMMON_CURRENCIES = [
  { value: "USD", label: "US Dollar ($)", symbol: "$" },
  { value: "EUR", label: "Euro (€)", symbol: "€" },
  { value: "GBP", label: "British Pound (£)", symbol: "£" },
  { value: "INR", label: "Indian Rupee (₹)", symbol: "₹" },
  { value: "CAD", label: "Canadian Dollar (C$)", symbol: "C$" },
  { value: "AUD", label: "Australian Dollar (A$)", symbol: "A$" },
  { value: "JPY", label: "Japanese Yen (¥)", symbol: "¥" },
  { value: "CNY", label: "Chinese Yuan (¥)", symbol: "¥" },
  { value: "CHF", label: "Swiss Franc (CHF)", symbol: "CHF" },
  { value: "SGD", label: "Singapore Dollar (S$)", symbol: "S$" },
  { value: "AED", label: "UAE Dirham (AED)", symbol: "AED" },
  { value: "BRL", label: "Brazilian Real (R$)", symbol: "R$" },
  { value: "MXN", label: "Mexican Peso (MX$)", symbol: "MX$" },
  { value: "KRW", label: "South Korean Won (₩)", symbol: "₩" },
  { value: "ZAR", label: "South African Rand (R)", symbol: "R" },
  { value: "NGN", label: "Nigerian Naira (₦)", symbol: "₦" },
  { value: "PHP", label: "Philippine Peso (₱)", symbol: "₱" },
  { value: "SEK", label: "Swedish Krona (kr)", symbol: "kr" },
] as const;

// ── Internal Helpers ────────────────────────────────────────────────────────

function ensureDate(input: Date | string | number): Date | null {
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

const DATE_STYLE_MAP: Record<Exclude<DateStyle, "relative">, Intl.DateTimeFormatOptions> = {
  short: { year: "2-digit", month: "numeric", day: "numeric" },
  medium: { year: "numeric", month: "short", day: "numeric" },
  long: { year: "numeric", month: "long", day: "numeric" },
  full: { year: "numeric", month: "long", day: "numeric", weekday: "long" },
};

function formatRelative(date: Date, locale: string): string {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  // Use Intl.RelativeTimeFormat if available
  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

    if (diffSec < 60) return rtf.format(-diffSec, "second");
    if (diffMin < 60) return rtf.format(-diffMin, "minute");
    if (diffHour < 24) return rtf.format(-diffHour, "hour");
    if (diffDay < 30) return rtf.format(-diffDay, "day");
    if (diffDay < 365) return rtf.format(-Math.floor(diffDay / 30), "month");
    return rtf.format(-Math.floor(diffDay / 365), "year");
  } catch {
    // Fallback for environments without RelativeTimeFormat
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay < 30) return `${diffDay}d ago`;
    return `${Math.floor(diffDay / 30)}mo ago`;
  }
}
