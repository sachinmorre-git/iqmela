/**
 * src/hooks/useLocale.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side hook that provides locale-aware formatting functions.
 *
 * Resolution chain:
 *   1. Organization defaults (fetched once from API)
 *   2. User profile preferences (if stored)
 *   3. Browser auto-detection (Intl.DateTimeFormat / navigator.language)
 *   4. Hardcoded fallbacks (en-US / America/New_York / USD)
 *
 * USAGE:
 *   const { formatDate, formatTime, formatCurrency, timezone, locale } = useLocale();
 *
 *   <span>{formatDate(interview.scheduledAt)}</span>
 *   <span>{formatCurrency(150000)}</span>
 * ─────────────────────────────────────────────────────────────────────────────
 */

"use client";

import { useMemo } from "react";
import {
  formatDate as _formatDate,
  formatTime as _formatTime,
  formatDateTime as _formatDateTime,
  formatCurrency as _formatCurrency,
  formatNumber as _formatNumber,
  detectBrowserTimezone,
  detectBrowserLocale,
  getTimezoneLabel,
  DEFAULT_TIMEZONE,
  DEFAULT_LOCALE,
  DEFAULT_CURRENCY,
  type LocaleContext,
  type DateStyle,
} from "@/lib/locale-utils";

// ── Types ───────────────────────────────────────────────────────────────────

interface UseLocaleOptions {
  /** Override timezone (highest priority) */
  timezone?: string;
  /** Override locale */
  locale?: string;
  /** Override currency */
  currency?: string;
  /** Organization defaults (from server component or API) */
  orgDefaults?: {
    defaultTimezone?: string | null;
    defaultLocale?: string | null;
    defaultCurrency?: string | null;
  };
  /** User profile timezone (from DB) */
  userTimezone?: string | null;
}

interface UseLocaleReturn {
  /** Resolved timezone being used */
  timezone: string;
  /** Resolved locale being used */
  locale: string;
  /** Resolved currency being used */
  currency: string;
  /** Human-readable timezone label, e.g. "IST (UTC+5:30)" */
  timezoneLabel: string;

  /** Format a date (auto-applies resolved timezone + locale) */
  formatDate: (date: Date | string | number, style?: DateStyle) => string;
  /** Format a time (auto-applies resolved timezone + locale) */
  formatTime: (date: Date | string | number, showTimezone?: boolean) => string;
  /** Format a full datetime (auto-applies resolved timezone + locale) */
  formatDateTime: (date: Date | string | number, showTimezone?: boolean) => string;
  /** Format currency (auto-applies resolved locale + currency) */
  formatCurrency: (amount: number, currencyOverride?: string) => string;
  /** Format number with locale-aware separators */
  formatNumber: (value: number, compact?: boolean) => string;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useLocale(options: UseLocaleOptions = {}): UseLocaleReturn {
  const resolved = useMemo(() => {
    // Resolution chain: explicit > user profile > org default > browser > fallback
    const timezone =
      options.timezone ??
      options.userTimezone ??
      options.orgDefaults?.defaultTimezone ??
      detectBrowserTimezone();

    const locale =
      options.locale ??
      options.orgDefaults?.defaultLocale ??
      detectBrowserLocale();

    const currency =
      options.currency ??
      options.orgDefaults?.defaultCurrency ??
      DEFAULT_CURRENCY;

    const ctx: LocaleContext = { timezone, locale, currency };

    return {
      timezone,
      locale,
      currency,
      timezoneLabel: getTimezoneLabel(timezone),

      formatDate: (date: Date | string | number, style?: DateStyle) =>
        _formatDate(date, { ...ctx, style }),

      formatTime: (date: Date | string | number, showTimezone = true) =>
        _formatTime(date, { ...ctx, showTimezone }),

      formatDateTime: (date: Date | string | number, showTimezone = true) =>
        _formatDateTime(date, { ...ctx, showTimezone }),

      formatCurrency: (amount: number, currencyOverride?: string) =>
        _formatCurrency(amount, { ...ctx, currency: currencyOverride ?? currency }),

      formatNumber: (value: number, compact = false) =>
        _formatNumber(value, { ...ctx, compact }),
    };
  }, [
    options.timezone,
    options.locale,
    options.currency,
    options.userTimezone,
    options.orgDefaults?.defaultTimezone,
    options.orgDefaults?.defaultLocale,
    options.orgDefaults?.defaultCurrency,
  ]);

  return resolved;
}
