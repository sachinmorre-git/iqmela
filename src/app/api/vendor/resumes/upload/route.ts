import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { saveFile } from "@/lib/storage";
import { getCallerPermissions } from "@/lib/rbac";

const ACCEPTED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/**
 * Vendor-specific resume upload endpoint.
 *
 * KEY DIFFERENCE from /api/org-admin/resumes/upload:
 * - organizationId on the Resume = the CLIENT org (position owner), NOT the vendor's org
 * - vendorOrgId on the Resume = the vendor's org (the uploader)
 * - vendorStage is set to SUBMITTED
 * - Access is validated via PositionVendor bridge, not orgId match
 */
export async function POST(req: NextRequest) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────
    const perms = await getCallerPermissions();
    if (!perms) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Parse multipart form ─────────────────────────────────────────────
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

    // ── Vendor dispatch validation ───────────────────────────────────────
    // Instead of checking orgId match, we verify the vendor org has an active dispatch
    const dispatch = await prisma.positionVendor.findFirst({
      where: {
        positionId,
        vendorOrgId: perms.orgId,
        status: "ACTIVE",
      },
      include: {
        position: {
          select: { organizationId: true, status: true, isDeleted: true },
        },
      },
    });

    if (!dispatch) {
      return NextResponse.json(
        { error: "You don't have an active dispatch for this position." },
        { status: 403 }
      );
    }

    if (dispatch.position.status !== "OPEN" || dispatch.position.isDeleted) {
      return NextResponse.json(
        { error: "This position is no longer accepting submissions." },
        { status: 403 }
      );
    }

    // The CLIENT org ID — resumes belong to the client's pipeline
    const clientOrgId = dispatch.position.organizationId;

    // ── Extract files from FormData ──────────────────────────────────────
    const files = formData.getAll("files") as File[];
    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // ── Process each file ────────────────────────────────────────────────
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
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Persist to storage (stored under the position's directory)
        const { storagePath } = await saveFile(buffer, positionId, file.name);

        // Create DB record — note the cross-tenant ownership:
        // organizationId = CLIENT org (for pipeline visibility)
        // vendorOrgId = VENDOR org (for vendor tracking)
        const resume = await prisma.resume.create({
          data: {
            positionId,
            organizationId: clientOrgId, // CLIENT tenant — this is the cross-tenant magic
            originalFileName: file.name,
            storagePath,
            mimeType: file.type,
            fileSize: file.size,
            parsingStatus: "UPLOADED",
            vendorOrgId: perms.orgId,    // VENDOR tenant
            vendorStage: "SUBMITTED",
          },
        });

        uploaded.push({ id: resume.id, originalFileName: resume.originalFileName });
        console.log(
          `[vendor-upload] Saved resume ${resume.id} — "${file.name}" → ${storagePath} (client: ${clientOrgId}, vendor: ${perms.orgId})`
        );
      } catch (fileErr) {
        const msg = fileErr instanceof Error ? fileErr.message : String(fileErr);
        console.error(`[vendor-upload] Failed to process ${file.name}:`, msg);
        errors.push(`${file.name}: ${msg}`);
      }
    }

    return NextResponse.json(
      { uploaded, errors, count: uploaded.length },
      { status: 200 }
    );
  } catch (err) {
    console.error("[vendor-upload] Unhandled error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
