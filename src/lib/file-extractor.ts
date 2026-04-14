/**
 * Resume File Text Extraction Service
 *
 * Fetches a stored resume file (from Vercel Blob or local filesystem)
 * and extracts its raw text content for downstream AI processing.
 *
 * Supported formats:
 *   - PDF  → pdf-parse
 *   - DOCX → mammoth
 *   - TXT  → raw Buffer toString
 *
 * The service is modular: parsers can be swapped per MIME type independently.
 */

import fs from "fs/promises";
import path from "path";

// ── Types ───────────────────────────────────────────────────────────────────

export interface TextExtractionResult {
  /** The raw extracted plain text */
  text: string;
  /** Whether extraction was fully successful */
  success: boolean;
  /** The parser used: "pdf-parse" | "mammoth" | "plaintext" | "mock" */
  parser: string;
  /** Number of characters extracted */
  charCount: number;
  /** Any non-fatal warnings from the parser */
  warnings: string[];
  /** Error message if extraction failed */
  error?: string;
}

export interface ResumeFileTextExtractor {
  /**
   * Given a storagePath from the Resume record and its MIME type,
   * fetch the file and return the extracted plain text.
   */
  extractText(storagePath: string, mimeType: string, fileName?: string): Promise<TextExtractionResult>;
}

// ── File Fetcher ─────────────────────────────────────────────────────────────

/**
 * Fetches the raw file buffer from either Vercel Blob (https://) or
 * the local public/uploads/ filesystem.
 */
async function fetchFileBuffer(storagePath: string): Promise<Buffer> {
  if (storagePath.startsWith("https://")) {
    // Vercel Blob — publicly accessible URL
    const res = await fetch(storagePath);
    if (!res.ok) {
      throw new Error(`Failed to fetch file from Blob: ${res.status} ${res.statusText}`);
    }
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } else {
    // Local filesystem — storagePath is relative to /public
    const localPath = path.join(process.cwd(), "public", storagePath);
    return await fs.readFile(localPath);
  }
}

// ── PDF Parser ───────────────────────────────────────────────────────────────

async function extractPdf(buffer: Buffer): Promise<{ text: string; warnings: string[] }> {
  // Dynamic import to avoid edge runtime issues and keep the bundle lean
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  const text = result.text ?? "";
  const warnings: string[] = [];
  if (text.trim().length < 50) {
    warnings.push("Extracted text is very short — file may be image-only or scanned PDF");
  }
  return { text, warnings };
}

// ── DOCX Parser ──────────────────────────────────────────────────────────────

async function extractDocx(buffer: Buffer): Promise<{ text: string; warnings: string[] }> {
  const mammoth = (await import("mammoth")).default;
  const result = await mammoth.extractRawText({ buffer });
  const warnings = result.messages
    .filter(m => m.type === "warning")
    .map(m => m.message);
  return { text: result.value ?? "", warnings };
}

// ── Plain Text ───────────────────────────────────────────────────────────────

async function extractPlainText(buffer: Buffer): Promise<{ text: string; warnings: string[] }> {
  return { text: buffer.toString("utf-8"), warnings: [] };
}

// ── Main Implementation ───────────────────────────────────────────────────────

export class ResumeFileExtractor implements ResumeFileTextExtractor {
  async extractText(
    storagePath: string,
    mimeType: string,
    fileName?: string
  ): Promise<TextExtractionResult> {
    console.log(`[FileExtractor] Extracting text — file: ${fileName ?? storagePath}, mime: ${mimeType}`);

    let buffer: Buffer;
    try {
      buffer = await fetchFileBuffer(storagePath);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[FileExtractor] Failed to fetch file: ${error}`);
      return { text: "", success: false, parser: "none", charCount: 0, warnings: [], error };
    }

    try {
      let extracted: { text: string; warnings: string[] };
      let parser: string;

      if (mimeType === "application/pdf") {
        extracted = await extractPdf(buffer);
        parser = "pdf-parse";
      } else if (
        mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        mimeType === "application/msword"
      ) {
        extracted = await extractDocx(buffer);
        parser = "mammoth";
      } else if (mimeType === "text/plain") {
        extracted = await extractPlainText(buffer);
        parser = "plaintext";
      } else {
        return {
          text: "",
          success: false,
          parser: "unsupported",
          charCount: 0,
          warnings: [],
          error: `Unsupported MIME type: ${mimeType}. Supported: PDF, DOCX, TXT.`,
        };
      }

      const cleanText = extracted.text.trim();

      if (cleanText.length === 0) {
        return {
          text: "",
          success: false,
          parser,
          charCount: 0,
          warnings: extracted.warnings,
          error: "Extraction yielded empty text — file may be blank, image-only, or corrupt.",
        };
      }

      return {
        text:     cleanText,
        success:  true,
        parser,
        charCount: cleanText.length,
        warnings: extracted.warnings,
      };

    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[FileExtractor] Parse error: ${error}`);
      return { text: "", success: false, parser: "error", charCount: 0, warnings: [], error };
    }
  }
}

// ── Mock Implementation ──────────────────────────────────────────────────────

/**
 * Deterministic mock for development when real files aren't accessible.
 * Returns consistent sample text so downstream AI services can be tested
 * independently of the file parsing layer.
 */
export class MockFileExtractor implements ResumeFileTextExtractor {
  async extractText(storagePath: string, mimeType: string, fileName?: string): Promise<TextExtractionResult> {
    console.log(`[MockFileExtractor] Returning sample text for ${fileName ?? storagePath}`);
    await new Promise(res => setTimeout(res, 300)); // Simulate IO delay

    const mockText = `ALEX JOHNSON
New York, NY | alex.johnson@email.com | +1 (212) 555-0192 | linkedin.com/in/alexjohnson

PROFESSIONAL SUMMARY
Senior Software Engineer with 7 years of experience building scalable web platforms.
Strong background in React, Node.js, TypeScript, and PostgreSQL. Led teams of up to 8 engineers.

EXPERIENCE
Senior Software Engineer – DataScale Inc (2021 – Present)
- Built real-time analytics dashboard used by 500+ enterprise clients
- Reduced p99 API latency from 800ms to 120ms using query optimization

Software Engineer – FinTech Solutions (2018 – 2021)
- Developed REST APIs processing $2M+ daily transactions using Node.js and PostgreSQL
- Implemented CI/CD pipelines using GitHub Actions and Docker

EDUCATION
B.S. Computer Science – New York University (2014 – 2018)

SKILLS
TypeScript, React, Node.js, PostgreSQL, Redis, Docker, AWS, GraphQL, REST APIs, Agile`;

    return {
      text:     mockText,
      success:  true,
      parser:   "mock",
      charCount: mockText.length,
      warnings: [],
    };
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────

/**
 * Export the appropriate extractor.
 * Uses the real implementation so it works for both local files and Blob URLs.
 * Falls back to mock only when explicitly forced via AI_PROVIDER=mock
 * AND there's no real file to fetch (handled gracefully at call sites).
 */
export const fileExtractor: ResumeFileTextExtractor =
  process.env.AI_FILE_EXTRACTOR === "mock"
    ? new MockFileExtractor()
    : new ResumeFileExtractor();
