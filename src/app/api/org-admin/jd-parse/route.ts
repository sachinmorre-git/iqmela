import { NextRequest, NextResponse } from "next/server";
import { fileExtractor } from "@/lib/file-extractor";
import { hiringAi } from "@/lib/ai";
import { getCallerPermissions } from "@/lib/rbac";

/**
 * POST /api/org-admin/jd-parse
 * Accepts a JD file (PDF or DOCX), extracts the text, and returns
 * structured fields for auto-populating the New Position form.
 */
export async function POST(req: NextRequest) {
  try {
    const perms = await getCallerPermissions();
    if (!perms || !perms.canManagePositions) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const supportedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ];

    if (!supportedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Please upload a PDF, DOCX, or TXT file.` },
        { status: 400 }
      );
    }

    // Step 1: Extract raw text from the file using the existing fileExtractor
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const textResult = await fileExtractor.extractTextFromBuffer(
      buffer,
      file.type,
      file.name
    );

    if (!textResult.success || !textResult.text) {
      return NextResponse.json(
        { error: textResult.error || "Could not extract text from the file." },
        { status: 422 }
      );
    }

    // Step 2: Run AI JD extraction
    const extracted = await hiringAi.extractJdFromText(textResult.text);

    return NextResponse.json({ success: true, data: extracted });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("[jd-parse] Error:", errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
