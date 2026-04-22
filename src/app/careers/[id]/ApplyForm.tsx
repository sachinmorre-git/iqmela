"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";

type ApplyState = "idle" | "submitting" | "success" | "error" | "duplicate";

export function ApplyForm({
  positionId,
  positionTitle,
}: {
  positionId: string;
  positionTitle: string;
}) {
  const [state, setState] = useState<ApplyState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [intakeCandidateId, setIntakeCandidateId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) validateAndSetFile(file);
  }, []);

  const validateAndSetFile = (file: File) => {
    const valid = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!valid.includes(file.type)) {
      setErrorMsg("Only PDF and DOCX files are accepted.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("File must be under 10 MB.");
      return;
    }
    setSelectedFile(file);
    setErrorMsg("");
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg("");

    const form = e.currentTarget;
    const formData = new FormData(form);

    if (!selectedFile) {
      setErrorMsg("Please upload your resume.");
      return;
    }

    const consent = formData.get("consent");
    if (consent !== "on") {
      setErrorMsg("Please consent to data processing to continue.");
      return;
    }

    // Replace file input with the validated file
    formData.delete("resume");
    formData.append("resume", selectedFile);
    formData.set("positionId", positionId);
    formData.set("consent", "true");

    setState("submitting");

    try {
      const res = await fetch("/api/public/apply", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (res.ok && json.success) {
        setIntakeCandidateId(json.intakeCandidateId);
        setState("success");
      } else if (json.error === "duplicate") {
        setState("duplicate");
      } else {
        setErrorMsg(json.error || "Something went wrong. Please try again.");
        setState("error");
      }
    } catch {
      setErrorMsg("Network error. Please check your connection.");
      setState("error");
    }
  };

  // ── Success State: Application Submitted + Join Network ──────────────────
  if (state === "success") {
    return (
      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(34,197,94,0.2)",
          borderRadius: "20px",
          padding: "40px",
          textAlign: "center",
        }}
      >
        {/* Success animation */}
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "rgba(34,197,94,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 20px",
            fontSize: "28px",
            animation: "scaleIn 0.4s ease",
          }}
        >
          ✓
        </div>
        <h3
          style={{
            fontSize: "22px",
            fontWeight: 800,
            color: "#fff",
            margin: "0 0 8px",
          }}
        >
          Application Submitted
        </h3>
        <p style={{ fontSize: "14px", color: "#71717a", margin: "0 0 32px" }}>
          We&apos;ll review your profile and reach out if there&apos;s a match.
          Average response time: 48 hours.
        </p>

        {/* ── Join the Talent Network ───────────────────────────────────── */}
        <div
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            paddingTop: "32px",
            marginTop: "8px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 14px",
              borderRadius: "9999px",
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.15)",
              fontSize: "11px",
              fontWeight: 600,
              color: "#818cf8",
              marginBottom: "16px",
            }}
          >
            ✦ Recommended
          </div>
          <h4
            style={{
              fontSize: "18px",
              fontWeight: 800,
              color: "#fff",
              margin: "0 0 8px",
            }}
          >
            Want more roles like this?
          </h4>
          <p
            style={{
              fontSize: "13px",
              color: "#71717a",
              maxWidth: "380px",
              margin: "0 auto 20px",
              lineHeight: 1.6,
            }}
          >
            Join the IQMela Talent Network and our AI will match you to roles
            tailored to your skills. No searching required.
          </p>

          {/* Benefits */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              maxWidth: "320px",
              margin: "0 auto 24px",
              textAlign: "left",
            }}
          >
            {[
              { icon: "🤖", text: "Get AI-matched to new roles automatically" },
              { icon: "🎯", text: "One profile → thousands of opportunities" },
              { icon: "📬", text: "Companies reach out to you" },
            ].map((b) => (
              <div
                key={b.text}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "13px",
                  color: "#a1a1aa",
                }}
              >
                <span style={{ fontSize: "16px" }}>{b.icon}</span>
                {b.text}
              </div>
            ))}
          </div>

          {/* Social sign-up buttons */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "12px",
              marginBottom: "16px",
              flexWrap: "wrap",
            }}
          >
            <Link
              href={`/careers/join?intake=${intakeCandidateId}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 24px",
                borderRadius: "12px",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
                transition: "all 0.2s",
              }}
            >
              Join the Talent Network →
            </Link>
          </div>

          <button
            onClick={() => setState("idle")}
            type="button"
            style={{
              background: "none",
              border: "none",
              color: "#52525b",
              fontSize: "12px",
              cursor: "pointer",
              padding: "8px",
            }}
          >
            I&apos;m good for now →
          </button>
        </div>

        <style>{`
          @keyframes scaleIn {
            0% { transform: scale(0); opacity: 0; }
            60% { transform: scale(1.15); }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  // ── Duplicate State ──────────────────────────────────────────────────────
  if (state === "duplicate") {
    return (
      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(251,191,36,0.2)",
          borderRadius: "20px",
          padding: "40px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "36px", marginBottom: "16px" }}>📋</div>
        <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>
          Already Applied
        </h3>
        <p style={{ fontSize: "14px", color: "#71717a", margin: "0 0 20px" }}>
          You&apos;ve already submitted an application for this role. We&apos;ll be in touch if there&apos;s a match!
        </p>
        <Link
          href="/careers"
          style={{
            fontSize: "13px",
            color: "#818cf8",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          ← Browse more roles
        </Link>
      </div>
    );
  }

  // ── Apply Form ───────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "20px",
        padding: "32px",
      }}
    >
      <h2
        style={{
          fontSize: "18px",
          fontWeight: 800,
          color: "#fff",
          margin: "0 0 4px",
        }}
      >
        Quick Apply
      </h2>
      <p style={{ fontSize: "13px", color: "#52525b", margin: "0 0 24px" }}>
        3 fields. 30 seconds. No account needed.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Name */}
        <div>
          <label style={labelStyle}>
            Full Name <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            type="text"
            name="name"
            required
            minLength={2}
            placeholder="Jane Doe"
            style={inputStyle}
          />
        </div>

        {/* Email */}
        <div>
          <label style={labelStyle}>
            Email <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            type="email"
            name="email"
            required
            placeholder="jane@example.com"
            style={inputStyle}
          />
        </div>

        {/* Resume drop zone */}
        <div>
          <label style={labelStyle}>
            Resume <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragActive ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: "12px",
              padding: "24px",
              textAlign: "center",
              cursor: "pointer",
              background: dragActive ? "rgba(99,102,241,0.04)" : "transparent",
              transition: "all 0.2s",
            }}
          >
            {selectedFile ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                <span style={{ fontSize: "18px" }}>📄</span>
                <span style={{ fontSize: "13px", color: "#a5b4fc", fontWeight: 500 }}>
                  {selectedFile.name}
                </span>
                <span style={{ fontSize: "11px", color: "#52525b" }}>
                  ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  style={{
                    background: "rgba(239,68,68,0.1)",
                    border: "none",
                    color: "#ef4444",
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: "24px", marginBottom: "8px", opacity: 0.4 }}>📄</div>
                <p style={{ fontSize: "13px", color: "#71717a", margin: 0 }}>
                  Drop your resume here, or{" "}
                  <span style={{ color: "#818cf8", fontWeight: 500 }}>browse</span>
                </p>
                <p style={{ fontSize: "11px", color: "#3f3f46", margin: "4px 0 0" }}>
                  PDF or DOCX · Max 10 MB
                </p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              name="resume"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) validateAndSetFile(file);
              }}
              style={{ display: "none" }}
            />
          </div>
        </div>

        {/* Consent */}
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            fontSize: "12px",
            color: "#71717a",
            lineHeight: 1.6,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            name="consent"
            required
            style={{
              marginTop: "3px",
              accentColor: "#818cf8",
              width: "16px",
              height: "16px",
              flexShrink: 0,
            }}
          />
          <span>
            I consent to IQMela processing my personal data for this job
            application in accordance with the{" "}
            <Link href="/careers/privacy" style={{ color: "#818cf8", textDecoration: "underline" }}>
              Privacy Policy
            </Link>
            . I understand my application may be reviewed using AI-assisted
            screening technology.
          </span>
        </label>

        {/* Error */}
        {errorMsg && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "8px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.2)",
              color: "#fca5a5",
              fontSize: "12px",
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={state === "submitting"}
          style={{
            padding: "14px 24px",
            borderRadius: "12px",
            background:
              state === "submitting"
                ? "rgba(99,102,241,0.3)"
                : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff",
            fontSize: "15px",
            fontWeight: 700,
            border: "none",
            cursor: state === "submitting" ? "wait" : "pointer",
            transition: "all 0.2s",
            letterSpacing: "-0.01em",
          }}
        >
          {state === "submitting" ? "Submitting..." : `Apply for ${positionTitle} →`}
        </button>
      </form>
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────────────────── */

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "12px",
  fontWeight: 600,
  color: "#a1a1aa",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: "10px",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.08)",
  color: "#fff",
  fontSize: "14px",
  outline: "none",
  transition: "border-color 0.2s",
};
