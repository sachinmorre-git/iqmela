/**
 * Storage abstraction for uploaded resume files.
 *
 * Driver selection is automatic:
 *   - If BLOB_READ_WRITE_TOKEN is set → Vercel Blob (production)
 *   - Otherwise → local public/uploads/ filesystem (development)
 *
 * The upload route never needs to know which driver is active.
 */

import fs from "fs/promises";
import path from "path";
import { put, del } from "@vercel/blob";

export interface StorageUploadResult {
  /**
   * The canonical reference to the saved file.
   * - Local:  relative path  e.g. "/uploads/resumes/pos123/cv.pdf"
   * - Blob:   absolute URL   e.g. "https://xxx.blob.vercel-storage.com/resumes/pos123/cv.pdf"
   */
  storagePath: string;
}

/** Resolve whichever token Vercel injected — name varies by how the store was connected.
 *  Check the specifically-named tokens first so the old private-store token loses priority. */
const BLOB_TOKEN =
  process.env.BLOB_READ_WRITE_TOKEN_READ_WRITE_TOKEN ||
  process.env.iqmela_resumes_v1_READ_WRITE_TOKEN ||
  process.env.BLOB_READ_WRITE_TOKEN ||
  undefined;

const USE_BLOB = !!BLOB_TOKEN;

// ─────────────────────────────────────────────────────────────────────────────
// Upload
// ─────────────────────────────────────────────────────────────────────────────

export async function saveFile(
  buffer: Buffer,
  positionId: string,
  fileName: string
): Promise<StorageUploadResult> {
  const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");

  if (USE_BLOB) {
    const blobPath = `resumes/${positionId}/${safeName}`;
    const { url } = await put(blobPath, buffer, {
      access: "public",
      contentType: getMimeType(safeName),
      token: BLOB_TOKEN,
    });
    return { storagePath: url };
  }

  // ── Local filesystem fallback ────────────────────────────────────────────
  const uploadDir = path.join(
    process.cwd(),
    "public",
    "uploads",
    "resumes",
    positionId
  );
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, safeName), buffer);
  return { storagePath: `/uploads/resumes/${positionId}/${safeName}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteFile(storagePath: string): Promise<void> {
  if (isBlobUrl(storagePath)) {
    await del(storagePath, { token: BLOB_TOKEN });
    return;
  }

  const filePath = path.join(process.cwd(), "public", storagePath);
  try {
    await fs.unlink(filePath);
  } catch {
    // File may already be gone — that is acceptable
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Download (used by the secure viewer API route)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the raw file content for a stored resume.
 * Returns a Web API Response that can be forwarded directly to the client.
 * Only works for Blob-backed files; local files are served via Next.js static.
 */
export async function downloadBlobFile(storagePath: string): Promise<Response> {
  if (!isBlobUrl(storagePath)) {
    throw new Error(
      "downloadBlobFile() is only for Vercel Blob URLs. " +
        "Local files are served via /uploads/ static route."
    );
  }
  // Blobs are publicly accessible via their unguessable URLs
  // The download still goes through our auth-protected server route for added control
  const response = await fetch(storagePath);
  if (!response.ok) {
    throw new Error(`Blob fetch failed: ${response.status} ${response.statusText}`);
  }
  return response;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function isBlobUrl(storagePath: string): boolean {
  return storagePath.startsWith("https://");
}

function getMimeType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "doc":
      return "application/msword";
    default:
      return "application/octet-stream";
  }
}
