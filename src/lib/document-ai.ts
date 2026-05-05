/**
 * Document AI Analysis Engine
 *
 * Analyzes uploaded candidate documents for:
 * - Document type verification
 * - Data extraction (name, ID numbers, expiry dates)
 * - Quality and validity warnings
 *
 * Provider-aware: Uses the configured AI provider (DeepSeek or Gemini)
 * via their native SDKs for maximum compatibility.
 */

import { aiConfig } from "@/lib/ai/config";

export interface DocumentAnalysisResult {
  docTypeGuess: string;
  extractedData: {
    nameOnDocument?: string;
    idNumber?: string;
    expiryDate?: string;
    issueDate?: string;
    issuingAuthority?: string;
    documentNumber?: string;
    address?: string;
    [key: string]: string | undefined;
  };
  confidence: number;
  warnings: string[];
}

/**
 * Build the document analysis prompt (shared between providers).
 */
function buildDocumentPrompt(opts: {
  fileName: string;
  expectedDocType: string;
  candidateName?: string;
  countryCode: string;
  fileContent: string;
}): string {
  const countryContext = opts.countryCode === "IN"
    ? "Indian employment documents (Aadhaar, PAN, relieving letter, etc.)"
    : "US employment documents (I-9, W-4, SSN, driver's license, etc.)";

  return `You are an expert HR document analyst specializing in ${countryContext}.

Analyze this document and extract information. The user uploaded a file named "${opts.fileName}" and claims it is: "${opts.expectedDocType}".
${opts.candidateName ? `The candidate's name is: "${opts.candidateName}".` : ""}

Based on the filename and any content provided, return a JSON object:
{
  "docTypeGuess": string,
  "extractedData": {
    "nameOnDocument": string | null,
    "idNumber": string | null,
    "expiryDate": string | null,
    "issueDate": string | null,
    "issuingAuthority": string | null,
    "documentNumber": string | null,
    "address": string | null
  },
  "confidence": number,
  "warnings": string[]
}

Rules:
- If the claimed docType doesn't match what you detect, add a "Wrong document type" warning
- If the name on the document doesn't match the candidate name, add a "Name mismatch" warning
- If an expiry date is in the past, add an "Expired document" warning
- For security, only return the LAST 4 digits of any ID numbers
- Confidence should be lower if the filename alone isn't enough to determine doc type
- Return ONLY valid JSON, no markdown wrapping

File content/metadata: ${opts.fileContent.substring(0, 2000)}`;
}

/**
 * Parse raw AI output, handling markdown wrapping and malformed JSON.
 */
function parseJsonOutput(raw: string): any {
  let cleaned = raw.trim();
  const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (match?.[1]) cleaned = match[1].trim();

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  return JSON.parse(cleaned);
}

/**
 * Analyze a document using AI to extract metadata and flag issues.
 */
export async function analyzeDocument(opts: {
  fileContent: string;
  fileName: string;
  expectedDocType: string;
  candidateName?: string;
  countryCode: string;
}): Promise<DocumentAnalysisResult> {
  // If AI is not ready, return a mock/pending result
  if (!aiConfig.isReady) {
    return {
      docTypeGuess: opts.expectedDocType,
      extractedData: {},
      confidence: 0.5,
      warnings: ["AI analysis unavailable — using manual verification mode"],
    };
  }

  const prompt = buildDocumentPrompt(opts);

  try {
    let raw: string;

    if (aiConfig.provider === "gemini") {
      // ── Gemini path (native SDK — full compatibility) ──
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: aiConfig.gemini.apiKey ?? "" });

      const response = await ai.models.generateContent({
        model: aiConfig.gemini.model,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      });

      raw = response.text ?? "{}";
    } else {
      // ── DeepSeek path (OpenAI-compatible SDK) ──
      const { default: OpenAI } = await import("openai");
      const ai = new OpenAI({
        baseURL: aiConfig.deepseek.baseUrl,
        apiKey: aiConfig.deepseek.apiKey ?? "",
      });

      const response = await ai.chat.completions.create({
        model: aiConfig.deepseek.chatModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        response_format: { type: "json_object" },
      });

      raw = response.choices[0]?.message?.content ?? "{}";
    }

    const parsed = parseJsonOutput(raw);

    return {
      docTypeGuess: parsed.docTypeGuess ?? opts.expectedDocType,
      extractedData: parsed.extractedData ?? {},
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.7,
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
    };
  } catch (error) {
    console.error("[DocumentAI] Analysis failed:", error);
    return {
      docTypeGuess: opts.expectedDocType,
      extractedData: {},
      confidence: 0.3,
      warnings: ["AI analysis failed — please verify manually"],
    };
  }
}
