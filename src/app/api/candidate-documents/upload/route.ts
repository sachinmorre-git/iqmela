/**
 * POST /api/candidate-documents/upload
 *
 * Uploads a candidate document to R2 and creates a CandidateDocument record.
 * Triggers immediate AI analysis.
 *
 * Body: multipart/form-data
 *   - file: the document file
 *   - docType: string (e.g. "AADHAAR", "I9_FORM")
 *   - countryCode: "US" | "IN"
 *   - label: string
 *   - category: string
 *   - profileId: string (CandidateProfile ID)
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { uploadToR2, isR2Configured } from "@/lib/r2";
import { analyzeDocument } from "@/lib/document-ai";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const docType = formData.get("docType") as string;
    const countryCode = formData.get("countryCode") as string;
    const label = formData.get("label") as string;
    const category = formData.get("category") as string;
    const profileId = formData.get("profileId") as string;

    // Validate required fields
    if (!file || !docType || !countryCode || !label || !category || !profileId) {
      return NextResponse.json(
        { error: "Missing required fields: file, docType, countryCode, label, category, profileId" },
        { status: 400 }
      );
    }

    // Validate file size (max 15MB)
    const MAX_SIZE = 15 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum 15MB." },
        { status: 400 }
      );
    }

    // Validate file type
    const validMimes = [
      "application/pdf",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    if (!validMimes.includes(file.type)) {
      return NextResponse.json(
        { error: "Invalid file type. Accepted: PDF, JPG, PNG." },
        { status: 400 }
      );
    }

    // Verify profileId belongs to this user
    const profile = await prisma.candidateProfile.findUnique({
      where: { id: profileId },
      select: { userId: true },
    });
    if (!profile || profile.userId !== userId) {
      return NextResponse.json(
        { error: "Profile not found or access denied" },
        { status: 403 }
      );
    }

    // Check for existing document of same type — replace it
    const existingDoc = await prisma.candidateDocument.findFirst({
      where: { profileId, docType, countryCode },
    });

    // Prepare file buffer
    const buffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const ext = file.name.split(".").pop() || "pdf";
    const r2Key = `docs/${profileId}/${docType}_${timestamp}.${ext}`;

    // Upload to R2 (or skip if not configured — store locally for dev)
    let storagePath = r2Key;
    if (isR2Configured()) {
      await uploadToR2({
        key: r2Key,
        body: buffer,
        contentType: file.type,
        metadata: {
          docType,
          countryCode,
          candidateUserId: userId,
        },
      });
    } else {
      // In dev without R2, just store the key — file won't be downloadable
      storagePath = `local-dev/${r2Key}`;
      console.warn("[CandidateDocUpload] R2 not configured — storing path reference only.");
    }

    // Get candidate name for AI cross-validation
    const candidateProfile = await prisma.candidateProfile.findUnique({
      where: { id: profileId },
      select: { user: { select: { name: true } } },
    });

    // Create or update the CandidateDocument record
    let doc;
    if (existingDoc) {
      doc = await prisma.candidateDocument.update({
        where: { id: existingDoc.id },
        data: {
          storagePath,
          originalFileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          aiStatus: "ANALYZING",
          aiExtractedJson: Prisma.DbNull,
          aiConfidence: null,
          aiDocTypeGuess: null,
          aiWarnings: Prisma.DbNull,
          verificationStatus: "UNVERIFIED",
          verifiedById: null,
          verifiedAt: null,
          rejectionReason: null,
          isExpired: false,
          expiryDate: null,
        },
      });
    } else {
      doc = await prisma.candidateDocument.create({
        data: {
          profileId,
          docType,
          countryCode,
          label,
          category,
          storagePath,
          originalFileName: file.name,
          mimeType: file.type,
          fileSize: file.size,
          aiStatus: "ANALYZING",
        },
      });
    }

    // Trigger immediate AI analysis (non-blocking)
    analyzeDocument({
      fileContent: `Filename: ${file.name}, Type: ${file.type}, Size: ${file.size} bytes`,
      fileName: file.name,
      expectedDocType: docType,
      candidateName: candidateProfile?.user?.name ?? undefined,
      countryCode,
    })
      .then(async (result) => {
        await prisma.candidateDocument.update({
          where: { id: doc.id },
          data: {
            aiStatus: "COMPLETED",
            aiExtractedJson: result.extractedData as any,
            aiConfidence: result.confidence,
            aiDocTypeGuess: result.docTypeGuess,
            aiWarnings: result.warnings as any,
            expiryDate: result.extractedData.expiryDate
              ? new Date(result.extractedData.expiryDate)
              : null,
            isExpired: result.warnings.some((w) =>
              w.toLowerCase().includes("expired")
            ),
          },
        });
      })
      .catch(async (err) => {
        console.error("[CandidateDocUpload] AI analysis failed:", err);
        await prisma.candidateDocument.update({
          where: { id: doc.id },
          data: { aiStatus: "FAILED" },
        });
      });

    return NextResponse.json({
      success: true,
      document: {
        id: doc.id,
        docType: doc.docType,
        label: doc.label,
        fileName: doc.originalFileName,
        aiStatus: "ANALYZING",
      },
    });
  } catch (error) {
    console.error("[CandidateDocUpload] Error:", error);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}
