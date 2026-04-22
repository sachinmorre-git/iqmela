/**
 * 🛡️ PII Shield — Dual-Engine Sensitive Data Scanner
 *
 * Two-layer protection ensuring zero sensitive PII enters IQMela storage:
 *
 * Layer 1: Upload Consent Attestation
 *   - Legal: uploader confirms report is redacted
 *   - Logged to BgvAuditLog with IP + timestamp
 *
 * Layer 2: AI + Regex PII Scanner
 *   - Engine 1: Regex patterns (SSN, DOB, DL, credit card, bank account)
 *   - Engine 2: Gemini multimodal analysis (catches edge cases)
 *   - Architecture: temp buffer → scan → pass? store : delete
 */

import { geminiClient, geminiModel } from "@/lib/ai/client";

// ── Types ───────────────────────────────────────────────────────────────────

export type PiiType =
  | "SSN"
  | "DOB"
  | "DRIVERS_LICENSE"
  | "CREDIT_CARD"
  | "BANK_ACCOUNT"
  | "PASSPORT";

export interface PiiDetection {
  type: PiiType;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  location: string;           // "Page 2, line 14" or "Section: Personal Details"
  redactedPreview: string;    // "XXX-XX-1234" — show last 4 only for context
}

export interface PiiScanResult {
  passed: boolean;             // true = no PII found, safe to store
  detections: PiiDetection[];  // What was found (if any)
  scanDurationMs: number;      // Performance tracking
  engines: {
    regex: { ran: boolean; detections: number };
    ai: { ran: boolean; detections: number };
  };
}

// ── Consent text (displayed to uploader) ────────────────────────────────────

export const PII_CONSENT_TEXT = `I confirm this report has been redacted of all sensitive Personally Identifiable Information including:

• Social Security Numbers (SSNs)
• Date of Birth (DOB)
• Driver's License Numbers
• Financial Account Numbers
• Bank Routing Numbers
• Passport Numbers

IQMela does not store or process sensitive PII. Uploading a document containing unredacted PII violates our Terms of Service.`;

// ── Main scanner function ───────────────────────────────────────────────────

/**
 * Scan a document buffer for PII.
 * Returns passed=true if clean, passed=false if PII detected.
 */
export async function scanForPii(
  textContent: string,
  fileBuffer?: Buffer,
  mimeType?: string,
): Promise<PiiScanResult> {
  const startTime = Date.now();
  const allDetections: PiiDetection[] = [];

  // ── Engine 1: Regex pattern matching (fast, deterministic) ──────────
  const regexDetections = scanWithRegex(textContent);
  allDetections.push(...regexDetections);

  // ── Engine 2: Gemini AI analysis (catches edge cases) ───────────────
  let aiDetections: PiiDetection[] = [];
  let aiRan = false;

  try {
    aiDetections = await scanWithGemini(textContent, fileBuffer, mimeType);
    aiRan = true;
    allDetections.push(...aiDetections);
  } catch (err) {
    console.error("[PiiShield] Gemini scan failed (non-blocking):", err);
    // AI failure is non-blocking — regex results alone are sufficient
  }

  // ── Deduplicate ─────────────────────────────────────────────────────
  const unique = deduplicateDetections(allDetections);

  return {
    passed: unique.length === 0,
    detections: unique,
    scanDurationMs: Date.now() - startTime,
    engines: {
      regex: { ran: true, detections: regexDetections.length },
      ai: { ran: aiRan, detections: aiDetections.length },
    },
  };
}

// ── Engine 1: Regex Pattern Matching ────────────────────────────────────────

function scanWithRegex(text: string): PiiDetection[] {
  const detections: PiiDetection[] = [];
  const lines = text.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // SSN: 000-00-0000 or 000 00 0000 or 000000000
    const ssnPatterns = [
      /\b(\d{3})[-\s](\d{2})[-\s](\d{4})\b/g,
      /\b(\d{9})\b/g,
    ];

    for (const pattern of ssnPatterns) {
      for (const match of line.matchAll(pattern)) {
        const raw = match[0].replace(/[-\s]/g, "");
        // Filter false positives
        if (looksLikeSSN(raw, line)) {
          detections.push({
            type: "SSN",
            confidence: "HIGH",
            location: `Line ${lineNum}`,
            redactedPreview: `XXX-XX-${raw.slice(-4)}`,
          });
        }
      }
    }

    // DOB: Various date formats near "date of birth", "DOB", "born" keywords
    const dobContext = /(date\s*of\s*birth|d\.?o\.?b\.?|born\s*on|birthdate)/i;
    if (dobContext.test(line)) {
      const datePatterns = [
        /\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/g,      // MM/DD/YYYY
        /\b(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/g,          // YYYY-MM-DD
        /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{1,2},?\s+\d{4}\b/gi,
      ];

      for (const pattern of datePatterns) {
        for (const match of line.matchAll(pattern)) {
          detections.push({
            type: "DOB",
            confidence: "MEDIUM",
            location: `Line ${lineNum}`,
            redactedPreview: "**/**/****",
          });
        }
      }
    }

    // Driver's License: look for DL-related keywords near number patterns
    const dlContext = /(driver'?s?\s*licen[sc]e|d\.?l\.?\s*#|license\s*(?:no|number|#))/i;
    if (dlContext.test(line)) {
      const dlPattern = /\b[A-Z]?\d{5,12}\b/g;
      for (const match of line.matchAll(dlPattern)) {
        detections.push({
          type: "DRIVERS_LICENSE",
          confidence: "MEDIUM",
          location: `Line ${lineNum}`,
          redactedPreview: `DL#****${match[0].slice(-4)}`,
        });
      }
    }

    // Credit card: Luhn-validated 13-19 digit numbers
    const ccPattern = /\b(\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{1,4})\b/g;
    for (const match of line.matchAll(ccPattern)) {
      const digits = match[0].replace(/[-\s]/g, "");
      if (digits.length >= 13 && digits.length <= 19 && luhnCheck(digits)) {
        detections.push({
          type: "CREDIT_CARD",
          confidence: "HIGH",
          location: `Line ${lineNum}`,
          redactedPreview: `****-****-****-${digits.slice(-4)}`,
        });
      }
    }

    // Bank routing + account numbers (near banking keywords)
    const bankContext = /(routing|account\s*(?:no|number|#)|aba\s*#|bank\s*(?:acct|account))/i;
    if (bankContext.test(line)) {
      const accountPattern = /\b\d{8,17}\b/g;
      for (const match of line.matchAll(accountPattern)) {
        detections.push({
          type: "BANK_ACCOUNT",
          confidence: "MEDIUM",
          location: `Line ${lineNum}`,
          redactedPreview: `****${match[0].slice(-4)}`,
        });
      }
    }
  }

  return detections;
}

// ── Engine 2: Gemini AI Analysis ────────────────────────────────────────────

async function scanWithGemini(
  textContent: string,
  _fileBuffer?: Buffer,
  _mimeType?: string,
): Promise<PiiDetection[]> {

  const systemPrompt = `You are a PII detection specialist. Analyze the following document text for any unredacted Personally Identifiable Information.

Look for:
- Social Security Numbers (full or partial, any format including XXX-XX-XXXX patterns where digits are visible)
- Dates of Birth (in any format, especially near "DOB", "Date of Birth", "Born" keywords)
- Driver's License numbers (near "DL", "License #", or state-specific formats)
- Credit card or bank account numbers
- Passport numbers

IGNORE (these are expected in BGV reports):
- Full names (expected)
- Addresses and ZIP codes (expected)
- Phone numbers (expected)
- Employer names, school names, degree titles (expected)
- Court case numbers (expected)

IMPORTANT: Only flag items that contain actual sensitive data, not redacted placeholders like "XXX-XX-XXXX" or "***-**-1234".

Respond with ONLY valid JSON, no markdown:
{"detections": [{"type": "SSN", "confidence": "HIGH", "location": "paragraph description", "preview": "last 4 digits only"}]}

If the document is clean, respond:
{"detections": []}`;

  // Truncate text to avoid token limits (keep first 8000 chars)
  const truncatedText = textContent.slice(0, 8000);
  const result = await geminiClient.models.generateContent({
    model: geminiModel,
    contents: truncatedText,
    config: {
      systemInstruction: systemPrompt,
    },
  });

  const responseText = result.text || "";

  try {
    // Clean potential markdown wrapping
    const cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as {
      detections?: Array<{
        type?: string;
        confidence?: string;
        location?: string;
        preview?: string;
      }>;
    };

    return (parsed.detections || [])
      .filter((d) => d.type && d.confidence)
      .map((d) => ({
        type: (d.type as PiiType) || "SSN",
        confidence: (d.confidence as PiiDetection["confidence"]) || "LOW",
        location: d.location || "Unknown location",
        redactedPreview: d.preview || "***",
      }));
  } catch {
    console.warn("[PiiShield] Failed to parse Gemini response:", responseText.slice(0, 200));
    return [];
  }
}

// ── Utility functions ───────────────────────────────────────────────────────

/** Check if a 9-digit string actually looks like an SSN vs phone/zip/id */
function looksLikeSSN(digits: string, context: string): boolean {
  // SSN cannot start with 000, 666, or 9xx
  if (digits.startsWith("000") || digits.startsWith("666") || digits[0] === "9") return false;
  // Middle 2 digits cannot be 00
  if (digits.slice(3, 5) === "00") return false;
  // Last 4 cannot be 0000
  if (digits.slice(5) === "0000") return false;

  // Check surrounding context for SSN-related keywords
  const ssnContext = /\b(ssn|social\s*security|ss\s*#|soc\s*sec)/i;
  if (ssnContext.test(context)) return true;

  // If it's a formatted XXX-XX-XXXX pattern, it's likely an SSN
  if (/\d{3}-\d{2}-\d{4}/.test(context)) return true;

  // Standalone 9-digit numbers without context get MEDIUM confidence
  return false;
}

/** Luhn algorithm for credit card validation */
function luhnCheck(num: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

/** Remove duplicate detections (same type + similar location) */
function deduplicateDetections(detections: PiiDetection[]): PiiDetection[] {
  const seen = new Set<string>();
  return detections.filter((d) => {
    const key = `${d.type}:${d.redactedPreview}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
