import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";
import { getCallerPermissions } from "@/lib/rbac";

const ACCEPTED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

// Max size per file: 10 MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const perms = await getCallerPermissions();
    if (!perms || !perms.canUploadResumes) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Parse multipart form ─────────────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    }

    const positionId = (formData.get("positionId") as string)?.trim();
    if (!positionId) {
      return NextResponse.json({ error: "positionId is required" }, { status: 400 });
    }

    // ── Org-scoped check ──────────────────────────────────────────────────────
    const position = await prisma.position.findUnique({
      where: { id: positionId },
      select: { organizationId: true },
    });

    if (!position) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }
    if (position.organizationId !== perms.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ── Extract files from FormData ──────────────────────────────────────────
    const files = formData.getAll("files") as File[];
    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // ── Process each file ────────────────────────────────────────────────────
    const uploaded: { id: string; originalFileName: string }[] = [];
    const errors: string[] = [];

    for (const file of files) {
      // Validate MIME
      if (!ACCEPTED_MIME.has(file.type)) {
        errors.push(`${file.name}: unsupported file type (${file.type})`);
        continue;
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: exceeds 10 MB limit`);
        continue;
      }

      try {
        // Convert File → Buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Persist to storage
        const { storagePath } = await saveFile(buffer, positionId, file.name);

        // Create DB record
        const resume = await prisma.resume.create({
          data: {
            positionId,
            organizationId: perms.orgId,
            originalFileName: file.name,
            storagePath,
            mimeType: file.type,
            fileSize: file.size,
            parsingStatus: "UPLOADED",
            vendorOrgId: perms.isVendor ? perms.orgId : null,
            vendorStage: perms.isVendor ? "SUBMITTED" : null,
          },
        });

        uploaded.push({ id: resume.id, originalFileName: resume.originalFileName });
        console.log(`[upload] Saved resume ${resume.id} — "${file.name}" → ${storagePath}`);
      } catch (fileErr) {
        const msg = fileErr instanceof Error ? fileErr.message : String(fileErr);
        console.error(`[upload] Failed to process ${file.name}:`, msg);
        errors.push(`${file.name}: ${msg}`);
      }
    }

    return NextResponse.json(
      { uploaded, errors, count: uploaded.length },
      { status: 200 }
    );

  } catch (err) {
    console.error("[upload] Unhandled error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
