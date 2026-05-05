"use client";

/**
 * Public BGV Report Upload Page
 *
 * /bgv-upload/[token]
 *
 * Beautiful, branded upload portal — no auth required.
 * Token-validated, with PII consent and AI scan.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Shield, ShieldCheck, ShieldX, Upload, FileText,
  CheckCircle, XCircle, Loader2, Clock, AlertTriangle,
} from "lucide-react";
import { useParams } from "next/navigation";
import { PII_CONSENT_TEXT } from "@/lib/bgv/pii-consent";
import { formatDate } from "@/lib/locale-utils"

interface UploadMetadata {
  candidateName: string;
  positionTitle: string;
  organizationName: string;
  packageLabel: string;
  expiresAt: string | null;
  expired: boolean;
  alreadyUploaded: boolean;
}

interface PiiDetectionInfo {
  type: string;
  confidence: string;
  location: string;
  redactedPreview: string;
}

export default function BgvUploadPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [metadata, setMetadata] = useState<UploadMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [piiDetections, setPiiDetections] = useState<PiiDetectionInfo[]>([]);

  // Fetch metadata
  const fetchMetadata = useCallback(async () => {
    try {
      const res = await fetch(`/api/bgv/upload/${token}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Invalid link");
        return;
      }
      const data = await res.json();
      setMetadata(data);
    } catch {
      setError("Failed to load upload page");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  const handleUpload = async () => {
    if (!file || !consent) return;

    setUploading(true);
    setScanning(true);
    setError(null);
    setPiiDetections([]);

    try {
      // Extract text for PII scanning
      const text = await file.text().catch(() => "");

      const formData = new FormData();
      formData.append("file", file);
      formData.append("consentGiven", "true");
      formData.append("reportText", text);

      const res = await fetch(`/api/bgv/upload/${token}`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setSuccess(true);
      } else {
        if (data.piiDetections) {
          setPiiDetections(data.piiDetections);
          setError("Sensitive information detected. Please redact and re-upload.");
        } else {
          setError(data.error || "Upload failed");
        }
      }
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setScanning(false);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-pink-500 animate-spin mx-auto" />
          <p className="text-sm text-gray-500 mt-3">Loading upload page...</p>
        </div>
      </div>
    );
  }

  // ── Error / Invalid Link ──────────────────────────────────────────────────

  if (error && !metadata) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-md w-full mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mt-4">Link Invalid or Expired</h1>
          <p className="text-sm text-gray-500 mt-2">{error}</p>
          <p className="text-xs text-gray-400 mt-4">Please request a new upload link from the recruiter.</p>
        </div>
      </div>
    );
  }

  if (!metadata) return null;

  // ── Expired ───────────────────────────────────────────────────────────────

  if (metadata.expired) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-md w-full mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 p-8 text-center">
          <Clock className="w-12 h-12 text-amber-500 mx-auto" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mt-4">Link Expired</h1>
          <p className="text-sm text-gray-500 mt-2">This upload link has expired.</p>
          {metadata.expiresAt && (
            <p className="text-xs text-gray-400 mt-2">
              Expired: {formatDate(new Date(metadata.expiresAt))}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-4">Please request a new upload link from the recruiter.</p>
        </div>
      </div>
    );
  }

  // ── Already Uploaded ──────────────────────────────────────────────────────

  if (metadata.alreadyUploaded) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-md w-full mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 p-8 text-center">
          <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto" />
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mt-4">Report Already Uploaded</h1>
          <p className="text-sm text-gray-500 mt-2">
            A BGV report has already been uploaded for this check.
          </p>
        </div>
      </div>
    );
  }

  // ── Upload Success ────────────────────────────────────────────────────────

  if (success) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-md w-full mx-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-emerald-100 dark:border-emerald-800/30 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mt-4">Report Uploaded Successfully</h1>
          <p className="text-sm text-gray-500 mt-2">
            🛡️ PII scan passed — no sensitive information detected.
          </p>
          <p className="text-sm text-gray-500 mt-1">
            📊 AI summary has been generated for the recruiter.
          </p>
          <div className="mt-6 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-200 dark:border-emerald-800/30">
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              The recruiter will be notified and can review the report immediately.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Upload Form ──────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex items-center justify-center py-8">
      <div className="max-w-lg w-full mx-4">
        {/* Header Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
          {/* Logo + Title */}
          <div className="bg-gradient-to-r from-pink-600 to-rose-600 px-6 py-5 text-white">
            <h1 className="text-lg font-bold">Background Verification Report Upload</h1>
            <p className="text-pink-100 text-sm mt-1">Secure document upload portal</p>
          </div>

          {/* Context Info */}
          <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-100 dark:border-zinc-800">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">Candidate</span>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{metadata.candidateName}</p>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">Position</span>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{metadata.positionTitle}</p>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">Organization</span>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{metadata.organizationName}</p>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide">Check Type</span>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{metadata.packageLabel}</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Error Banner */}
            {error && (
              <div className="px-4 py-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/40 rounded-xl text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
                <ShieldX className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* File Upload Zone */}
            <div>
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Upload Document</label>
              <div
                className={`mt-2 border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer ${
                  file
                    ? "border-emerald-300 bg-emerald-50 dark:bg-emerald-900/10"
                    : "border-gray-300 dark:border-zinc-600 hover:border-pink-400 dark:hover:border-pink-600 bg-white dark:bg-zinc-800/50"
                }`}
              >
                {file ? (
                  <div>
                    <FileText className="w-10 h-10 text-emerald-500 mx-auto" />
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 mt-2">{file.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{(file.size / 1024).toFixed(0)} KB · {file.type}</p>
                    <button
                      onClick={() => setFile(null)}
                      className="text-xs text-red-500 underline mt-2"
                    >
                      Remove and choose different file
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="w-10 h-10 text-gray-400 mx-auto" />
                    <p className="text-sm text-gray-600 dark:text-gray-300 font-semibold mt-3">
                      Drag & drop your BGV report here
                    </p>
                    <p className="text-xs text-gray-400 mt-1">or click to browse</p>
                    <p className="text-[10px] text-gray-400 mt-2">Accepted: PDF, PNG, JPG · Max 20MB</p>
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* PII Consent */}
            <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800/30">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-[10px] text-blue-800 dark:text-blue-300 leading-relaxed whitespace-pre-wrap">
                  {PII_CONSENT_TEXT}
                </span>
              </label>
            </div>

            {/* PII Shield Info */}
            <div className="flex items-start gap-2 px-3 py-2 bg-gray-50 dark:bg-zinc-800/50 rounded-lg">
              <Shield className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">
                IQMela will automatically scan this document to ensure no sensitive information (SSNs, DOB, etc.) is present before storing it.
                If PII is detected, the upload will be rejected and the file will not be stored.
              </p>
            </div>

            {/* PII Detections (if scan failed) */}
            {piiDetections.length > 0 && (
              <div className="px-4 py-4 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-800/30">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldX className="w-5 h-5 text-red-600" />
                  <span className="text-xs font-bold text-red-700 dark:text-red-400">Upload Blocked — Sensitive Information Detected</span>
                </div>
                <div className="space-y-1.5">
                  {piiDetections.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                      <XCircle className="w-3 h-3 flex-shrink-0" />
                      <span>{d.type} — {d.location} ({d.confidence} confidence)</span>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-red-500 mt-2">
                  Please redact this information and re-upload. The unredacted file has NOT been stored.
                </p>
              </div>
            )}

            {/* Scan Progress */}
            {scanning && (
              <div className="px-4 py-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-200 dark:border-blue-800/30">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600 animate-spin" />
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                    🛡️ Scanning for sensitive information...
                  </span>
                </div>
                <div className="mt-3 h-2 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-pink-500 rounded-full transition-all duration-1000"
                    style={{ width: "65%", animation: "pulse 1.5s ease-in-out infinite" }}
                  />
                </div>
              </div>
            )}

            {/* Upload Button */}
            <button
              onClick={handleUpload}
              disabled={!file || !consent || uploading}
              className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg shadow-pink-500/20 flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {scanning ? "Scanning..." : "Uploading..."}
                </>
              ) : (
                <>📤 Upload Report</>
              )}
            </button>
          </div>

          {/* Expiry Info */}
          {metadata.expiresAt && (
            <div className="px-6 py-3 bg-gray-50 dark:bg-zinc-800/50 border-t border-gray-100 dark:border-zinc-800 text-center">
              <p className="text-[10px] text-gray-400">
                🔒 This link expires {formatDate(new Date(metadata.expiresAt))}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
