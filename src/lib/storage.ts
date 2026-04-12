/**
 * Storage abstraction for uploaded files.
 *
 * Current implementation: local filesystem under public/uploads/
 * Swap this file's implementation (or the STORAGE_DRIVER env var) to use
 * Vercel Blob, AWS S3, or any other provider in production.
 */

import fs from "fs/promises";
import path from "path";

export interface StorageUploadResult {
  /** Relative web-accessible path, e.g. "/uploads/resumes/abc123/cv.pdf" */
  storagePath: string;
}

/**
 * Save a single file buffer to local public/uploads directory.
 * Files are stored at: public/uploads/resumes/[positionId]/[fileName]
 * They become publicly accessible at /uploads/resumes/[positionId]/[fileName]
 */
export async function saveFile(
  buffer: Buffer,
  positionId: string,
  fileName: string
): Promise<StorageUploadResult> {
  // Sanitise the filename — strip directory traversal chars
  const safeName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");

  // Absolute path on disk
  const uploadDir = path.join(process.cwd(), "public", "uploads", "resumes", positionId);
  await fs.mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, safeName);
  await fs.writeFile(filePath, buffer);

  // Relative path served by Next.js static file middleware
  const storagePath = `/uploads/resumes/${positionId}/${safeName}`;
  return { storagePath };
}

/**
 * Delete a file from local storage.
 * No-ops gracefully if the file does not exist.
 */
export async function deleteFile(storagePath: string): Promise<void> {
  const filePath = path.join(process.cwd(), "public", storagePath);
  try {
    await fs.unlink(filePath);
  } catch {
    // File may already be gone — that is acceptable
  }
}
