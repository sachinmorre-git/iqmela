/**
 * src/lib/sanitize.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Input sanitization utilities for XSS prevention.
 *
 * Prisma uses parameterized queries, so SQL injection is handled.
 * This module handles the OUTPUT side — sanitizing user-generated content
 * before it's rendered in the UI.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Escape HTML special characters to prevent XSS.
 * Use this when rendering user-generated text in non-React contexts.
 * React already escapes by default in JSX, but this is needed for:
 *   - dangerouslySetInnerHTML
 *   - Email templates
 *   - PDF generation
 *   - Server-rendered meta tags
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Strip all HTML tags from a string.
 * Use when you want plain text only (e.g., storing in DB, displaying in notifications).
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/**
 * Sanitize a URL to prevent javascript: protocol attacks.
 * Only allows http:, https:, mailto:, and tel: protocols.
 */
export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const allowed = ["http:", "https:", "mailto:", "tel:"];
    if (!allowed.includes(parsed.protocol)) {
      return "";
    }
    return url;
  } catch {
    // If it's a relative URL, that's fine
    if (url.startsWith("/") && !url.startsWith("//")) return url;
    return "";
  }
}

/**
 * Truncate string to a max length (safe for display).
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}

/**
 * Sanitize filename to prevent path traversal attacks.
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\./g, "")     // Remove path traversal
    .replace(/[/\\]/g, "")    // Remove slashes
    .replace(/[^\w.\-]/g, "_") // Replace special chars with underscore
    .slice(0, 255);           // Max filename length
}

/**
 * Validate and sanitize an email address.
 * Returns null if the email is invalid.
 */
export function sanitizeEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  // Basic email regex — not perfect but catches most injection attempts
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) return null;
  if (trimmed.length > 254) return null; // RFC 5321 max
  return trimmed;
}
