"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { VSISurvey } from "./VSISurvey";

type ApplyState = "idle" | "submitting" | "success" | "error" | "duplicate";

interface QuickApplyProfile {
  name: string;
  email: string;
  resumeUrl: string | null;
  resumeFileName?: string;
  profileId: string;
}

export function ApplyForm({
  positionId,
  positionTitle,
  quickProfile,
  intakeClosed = false,
  daysLeft,
}: {
  positionId: string;
  positionTitle: string;
  /** If provided, show one-tap Quick Apply instead of full form */
  quickProfile?: QuickApplyProfile | null;
  /** If true, the intake window has closed — disable applications */
  intakeClosed?: boolean;
  /** Days remaining in the intake window (undefined if closed) */
  daysLeft?: number;
}) {
  const [state, setState] = useState<ApplyState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [intakeCandidateId, setIntakeCandidateId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [workAuthorized, setWorkAuthorized] = useState<boolean | null>(null);
  const [sponsorshipNeeded, setSponsorshipNeeded] = useState<boolean | null>(null);
  const [showVSI, setShowVSI] = useState(false);
  const [vsiCompleted, setVsiCompleted] = useState(false);
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

  /* ── Quick Apply handler ─────────────────────────────────────────────── */
  const handleQuickApply = async () => {
    if (!quickProfile) return;
    setState("submitting");
    setErrorMsg("");

    try {
      const body: Record<string, unknown> = {
        positionId,
        name: quickProfile.name,
        email: quickProfile.email,
        profileId: quickProfile.profileId,
        consent: "true",
        quickApply: true,
      };
      if (workAuthorized !== null) body.workAuthorized = workAuthorized;
      if (sponsorshipNeeded !== null) body.sponsorshipNeeded = sponsorshipNeeded;

      // If user selected a new file, use formData; otherwise JSON
      if (selectedFile) {
        const formData = new FormData();
        Object.entries(body).forEach(([k, v]) => formData.set(k, String(v)));
        formData.append("resume", selectedFile);
        const res = await fetch("/api/public/apply", { method: "POST", body: formData });
        const json = await res.json();
        if (res.ok && json.success) {
          setIntakeCandidateId(json.intakeCandidateId);
          setState("success");
        } else if (json.error === "duplicate") {
          setState("duplicate");
        } else {
          setErrorMsg(json.error || "Something went wrong.");
          setState("error");
        }
      } else {
        const res = await fetch("/api/public/apply", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (res.ok && json.success) {
          setIntakeCandidateId(json.intakeCandidateId);
          setState("success");
        } else if (json.error === "duplicate") {
          setState("duplicate");
        } else {
          setErrorMsg(json.error || "Something went wrong.");
          setState("error");
        }
      }
    } catch {
      setErrorMsg("Network error. Please check your connection.");
      setState("error");
    }
  };

  /* ── Full Apply handler ──────────────────────────────────────────────── */
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

    formData.delete("resume");
    formData.append("resume", selectedFile);
    formData.set("positionId", positionId);
    formData.set("consent", "true");

    // Work authorization
    if (workAuthorized !== null) formData.set("workAuthorized", String(workAuthorized));
    if (sponsorshipNeeded !== null) formData.set("sponsorshipNeeded", String(sponsorshipNeeded));

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

  // ── Intake Closed ──────────────────────────────────────────────────────
  if (intakeClosed) {
    return (
      <div
        className="glass-strong"
        style={{
          borderRadius: "24px",
          padding: "40px",
          textAlign: "center",
          border: "1px solid rgba(239, 68, 68, 0.2)",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #ef4444 0%, #f97316 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <span style={{ fontSize: 24 }}>⏰</span>
        </div>
        <h3
          style={{
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "white",
            marginBottom: 8,
          }}
        >
          Applications Closed
        </h3>
        <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.9rem", lineHeight: 1.5 }}>
          The application window for <strong>{positionTitle}</strong> has ended. Check back for new opportunities.
        </p>
      </div>
    );
  }

  // ── Success State ────────────────────────────────────────────────────────
  if (state === "success") {
    return (
      <div
        className="glass-strong"
        style={{
          borderRadius: "24px",
          padding: "48px 40px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
          borderColor: "rgba(34,197,94,0.15)",
        }}
      >
        {/* Confetti */}
        <div className="confetti-container">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="confetti-piece"
              style={{
                left: `${5 + Math.random() * 90}%`,
                background: ["#818cf8", "#c084fc", "#f472b6", "#22c55e", "#fbbf24"][i % 5],
                animationDelay: `${Math.random() * 0.5}s`,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ["--confetti-rotate" as any]: `${Math.random() * 360}deg`,
                width: `${6 + Math.random() * 6}px`,
                height: `${6 + Math.random() * 6}px`,
                borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              }}
            />
          ))}
        </div>

        {/* Success icon */}
        <div
          className="scale-in"
          style={{
            width: "72px",
            height: "72px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            fontSize: "32px",
            border: "1px solid rgba(34,197,94,0.2)",
          }}
        >
          ✓
        </div>

        <h3
          style={{
            fontSize: "24px",
            fontWeight: 800,
            color: "#fff",
            margin: "0 0 10px",
            letterSpacing: "-0.02em",
          }}
        >
          Application Submitted
        </h3>
        <p style={{ fontSize: "14px", color: "#71717a", margin: "0 0 32px", lineHeight: 1.6 }}>
          We&apos;ll review your profile and reach out if there&apos;s a match.
          <br />Average response time: 48 hours.
        </p>

        {/* ── VSI Survey (optional, post-success) ────────────────────────── */}
        {!vsiCompleted && !showVSI && (
          <div
            className="hero-enter-4"
            style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              paddingTop: "28px",
              marginBottom: "28px",
            }}
          >
            <p style={{ fontSize: "13px", color: "#52525b", marginBottom: "16px" }}>
              Help us build a more equitable workplace
            </p>
            <button
              onClick={() => setShowVSI(true)}
              style={{
                padding: "12px 24px",
                borderRadius: "12px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#a1a1aa",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s",
                marginRight: "12px",
              }}
            >
              Complete voluntary survey (30s)
            </button>
            <button
              onClick={() => setVsiCompleted(true)}
              style={{
                background: "none",
                border: "none",
                color: "#3f3f46",
                fontSize: "12px",
                cursor: "pointer",
                padding: "8px",
              }}
            >
              Skip →
            </button>
          </div>
        )}

        {showVSI && !vsiCompleted && (
          <VSISurvey
            intakeCandidateId={intakeCandidateId}
            onComplete={() => {
              setShowVSI(false);
              setVsiCompleted(true);
            }}
            onSkip={() => {
              setShowVSI(false);
              setVsiCompleted(true);
            }}
          />
        )}

        {/* ── Join Talent Network (after VSI or skip) ────────────────────── */}
        {vsiCompleted && (
          <div
            className="hero-enter-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "28px" }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "5px 16px",
                borderRadius: "9999px",
                background: "rgba(99,102,241,0.06)",
                border: "1px solid rgba(99,102,241,0.12)",
                fontSize: "11px",
                fontWeight: 600,
                color: "#a5b4fc",
                marginBottom: "16px",
              }}
            >
              ✦ Recommended
            </div>
            <h4 style={{ fontSize: "18px", fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>
              Want more roles like this?
            </h4>
            <p style={{
              fontSize: "13px", color: "#71717a", maxWidth: "380px",
              margin: "0 auto 24px", lineHeight: 1.7,
            }}>
              Join the IQMela Talent Network — apply to future roles with one tap.
              No searching required.
            </p>

            <div style={{
              display: "flex", flexDirection: "column", gap: "8px",
              maxWidth: "340px", margin: "0 auto 28px", textAlign: "left",
            }}>
              {[
                { icon: "⚡", text: "One-tap apply to every future role" },
                { icon: "🤖", text: "AI matches you to new positions daily" },
                { icon: "📬", text: "Companies discover you automatically" },
              ].map((b) => (
                <div key={b.text} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  fontSize: "13px", color: "#a1a1aa", padding: "8px 12px",
                  borderRadius: "10px", background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <span style={{ fontSize: "16px" }}>{b.icon}</span>
                  {b.text}
                </div>
              ))}
            </div>

            <Link
              href={`/careers/join?intake=${intakeCandidateId}`}
              className="btn-shimmer"
              style={{
                display: "inline-flex", alignItems: "center", gap: "8px",
                padding: "14px 28px", borderRadius: "14px",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                color: "#fff", fontSize: "14px", fontWeight: 700,
                textDecoration: "none", transition: "all 0.2s",
              }}
            >
              Join the Talent Network →
            </Link>
            <div style={{ marginTop: "12px" }}>
              <button
                onClick={() => setState("idle")}
                type="button"
                style={{
                  background: "none", border: "none", color: "#3f3f46",
                  fontSize: "12px", cursor: "pointer", padding: "8px",
                }}
              >
                I&apos;m good for now →
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Duplicate State ──────────────────────────────────────────────────────
  if (state === "duplicate") {
    return (
      <div className="glass-strong" style={{
        borderRadius: "24px", padding: "48px 40px", textAlign: "center",
        borderColor: "rgba(251,191,36,0.15)",
      }}>
        <div className="scale-in" style={{ fontSize: "40px", marginBottom: "20px" }}>📋</div>
        <h3 style={{ fontSize: "20px", fontWeight: 800, color: "#fff", margin: "0 0 10px" }}>
          Already Applied
        </h3>
        <p style={{ fontSize: "14px", color: "#71717a", margin: "0 0 24px", lineHeight: 1.6 }}>
          You&apos;ve already submitted an application for this role.
          <br />We&apos;ll be in touch if there&apos;s a match!
        </p>
        <Link href="/careers" style={{ fontSize: "13px", color: "#818cf8", textDecoration: "none", fontWeight: 600 }}>
          ← Browse more roles
        </Link>
      </div>
    );
  }

  // ── Quick Apply (for Talent Network members) ────────────────────────────
  if (quickProfile) {
    return (
      <div className="glass-strong" style={{ borderRadius: "24px", padding: "36px" }}>
        {/* Welcome back header */}
        <div style={{
          display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px",
        }}>
          <div style={{
            width: "48px", height: "48px", borderRadius: "50%",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: "20px",
          }}>
            {quickProfile.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 style={{
              fontSize: "18px", fontWeight: 800, color: "#fff",
              margin: 0, letterSpacing: "-0.02em",
            }}>
              Welcome back, {quickProfile.name.split(" ")[0]}!
            </h2>
            <p style={{ fontSize: "13px", color: "#71717a", margin: "2px 0 0" }}>
              {quickProfile.email}
            </p>
          </div>
        </div>

        {/* Resume status */}
        <div style={{
          padding: "14px 18px", borderRadius: "14px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          marginBottom: "20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "18px" }}>📄</span>
            <div>
              <span style={{ fontSize: "13px", color: "#a5b4fc", fontWeight: 600 }}>
                {selectedFile ? selectedFile.name : (quickProfile.resumeUrl ? "Resume on file" : "No resume yet")}
              </span>
              {quickProfile.resumeUrl && !selectedFile && (
                <span style={{ fontSize: "11px", color: "#22c55e", marginLeft: "8px" }}>✓</span>
              )}
            </div>
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#a1a1aa", fontSize: "11px", fontWeight: 600,
              padding: "5px 12px", borderRadius: "8px", cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {quickProfile.resumeUrl ? "Change" : "Upload"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.doc,.docx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) validateAndSetFile(file);
            }}
            style={{ display: "none" }}
          />
        </div>

        {/* Work Auth toggles */}
        <WorkAuthToggles
          workAuthorized={workAuthorized}
          sponsorshipNeeded={sponsorshipNeeded}
          onWorkAuthChange={setWorkAuthorized}
          onSponsorshipChange={setSponsorshipNeeded}
        />

        {/* Error */}
        {errorMsg && (
          <div style={{
            padding: "12px 16px", borderRadius: "12px", marginBottom: "16px",
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
            color: "#fca5a5", fontSize: "12px", fontWeight: 500,
          }}>
            {errorMsg}
          </div>
        )}

        {/* Apply button */}
        <button
          onClick={handleQuickApply}
          disabled={state === "submitting"}
          className="btn-shimmer"
          style={{
            width: "100%", padding: "16px 28px", borderRadius: "14px",
            background: state === "submitting"
              ? "rgba(99,102,241,0.2)"
              : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff", fontSize: "15px", fontWeight: 700,
            border: "none", cursor: state === "submitting" ? "wait" : "pointer",
            transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            letterSpacing: "-0.01em",
          }}
        >
          {state === "submitting" ? "Applying..." : "Apply Instantly →"}
        </button>

        <p style={{
          fontSize: "11px", color: "#3f3f46", textAlign: "center",
          marginTop: "12px", lineHeight: 1.5,
        }}>
          By applying, you agree to our{" "}
          <Link href="/legal/terms" style={{ color: "#52525b" }}>Terms</Link>
          {" "}and{" "}
          <Link href="/careers/privacy" style={{ color: "#52525b" }}>Privacy Policy</Link>.
          Your application may be reviewed using AI-assisted screening.
        </p>
      </div>
    );
  }

  // ── Full Apply Form ──────────────────────────────────────────────────────
  return (
    <div className="glass-strong" style={{ borderRadius: "24px", padding: "36px" }}>
      {/* Progress dots */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: "8px", marginBottom: "24px",
      }}>
        <ProgressDot active label="Info" />
        <ProgressLine />
        <ProgressDot active={!!selectedFile} label="Resume" />
        <ProgressLine />
        <ProgressDot active={false} label="Done" />
      </div>

      <h2 style={{
        fontSize: "20px", fontWeight: 800, color: "#fff",
        margin: "0 0 4px", letterSpacing: "-0.02em",
      }}>
        Quick Apply
      </h2>
      <p style={{ fontSize: "13px", color: "#52525b", margin: "0 0 28px" }}>
        3 fields. 30 seconds. No account needed.
      </p>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        {/* Name */}
        <div>
          <label style={labelStyle}>Full Name <span style={{ color: "#ef4444" }}>*</span></label>
          <input type="text" name="name" required minLength={2} placeholder="Jane Doe"
            className="input-glow" style={inputStyle} />
        </div>

        {/* Email */}
        <div>
          <label style={labelStyle}>Email <span style={{ color: "#ef4444" }}>*</span></label>
          <input type="email" name="email" required placeholder="jane@example.com"
            className="input-glow" style={inputStyle} />
        </div>

        {/* Resume drop zone */}
        <div>
          <label style={labelStyle}>Resume <span style={{ color: "#ef4444" }}>*</span></label>
          <div
            onDragEnter={handleDrag} onDragOver={handleDrag}
            onDragLeave={handleDrag} onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={dragActive ? "drag-active" : ""}
            style={{
              border: `2px dashed ${dragActive ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: "16px", padding: "28px", textAlign: "center",
              cursor: "pointer",
              background: dragActive ? "rgba(99,102,241,0.04)" : "rgba(255,255,255,0.01)",
              transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {selectedFile ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
                <span style={{ fontSize: "20px" }}>📄</span>
                <span style={{ fontSize: "13px", color: "#a5b4fc", fontWeight: 600 }}>
                  {selectedFile.name}
                </span>
                <span style={{ fontSize: "11px", color: "#52525b" }}>
                  ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                </span>
                <button type="button" onClick={(e) => {
                  e.stopPropagation(); setSelectedFile(null);
                  if (fileRef.current) fileRef.current.value = "";
                }} style={{
                  background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)",
                  color: "#ef4444", fontSize: "11px", fontWeight: 600,
                  padding: "3px 10px", borderRadius: "6px", cursor: "pointer",
                }}>Remove</button>
              </div>
            ) : (
              <>
                <div style={{ fontSize: "28px", marginBottom: "10px", opacity: 0.3 }}>📄</div>
                <p style={{ fontSize: "13px", color: "#71717a", margin: 0 }}>
                  Drop your resume here, or <span style={{ color: "#818cf8", fontWeight: 600 }}>browse</span>
                </p>
                <p style={{ fontSize: "11px", color: "#3f3f46", margin: "6px 0 0" }}>
                  PDF or DOCX · Max 10 MB
                </p>
              </>
            )}
            <input ref={fileRef} type="file" name="resume"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => { const file = e.target.files?.[0]; if (file) validateAndSetFile(file); }}
              style={{ display: "none" }} />
          </div>
        </div>

        {/* Work Authorization Toggles */}
        <WorkAuthToggles
          workAuthorized={workAuthorized}
          sponsorshipNeeded={sponsorshipNeeded}
          onWorkAuthChange={setWorkAuthorized}
          onSponsorshipChange={setSponsorshipNeeded}
        />

        {/* Consent */}
        <label style={{
          display: "flex", alignItems: "flex-start", gap: "12px",
          fontSize: "12px", color: "#71717a", lineHeight: 1.7, cursor: "pointer",
        }}>
          <input type="checkbox" name="consent" required style={{
            marginTop: "4px", accentColor: "#818cf8", width: "16px", height: "16px", flexShrink: 0,
          }} />
          <span>
            I consent to IQMela processing my personal data for this job application in accordance with the{" "}
            <Link href="/careers/privacy" style={{ color: "#818cf8", textDecoration: "underline" }}>
              Privacy Policy
            </Link>. I understand my application may be reviewed using AI-assisted screening technology.
          </span>
        </label>

        {/* Error */}
        {errorMsg && (
          <div style={{
            padding: "12px 16px", borderRadius: "12px",
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
            color: "#fca5a5", fontSize: "12px", fontWeight: 500,
          }}>{errorMsg}</div>
        )}

        {/* Submit */}
        <button type="submit" disabled={state === "submitting"} className="btn-shimmer" style={{
          padding: "16px 28px", borderRadius: "14px",
          background: state === "submitting" ? "rgba(99,102,241,0.2)" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
          color: "#fff", fontSize: "15px", fontWeight: 700, border: "none",
          cursor: state === "submitting" ? "wait" : "pointer",
          transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)", letterSpacing: "-0.01em",
        }}>
          {state === "submitting" ? "Submitting..." : `Apply for ${positionTitle} →`}
        </button>
      </form>
    </div>
  );
}

/* ── Work Authorization Toggles ────────────────────────────────────────── */

function WorkAuthToggles({
  workAuthorized,
  sponsorshipNeeded,
  onWorkAuthChange,
  onSponsorshipChange,
}: {
  workAuthorized: boolean | null;
  sponsorshipNeeded: boolean | null;
  onWorkAuthChange: (v: boolean) => void;
  onSponsorshipChange: (v: boolean) => void;
}) {
  return (
    <div style={{
      padding: "18px",
      borderRadius: "16px",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.05)",
    }}>
      <p style={{
        fontSize: "11px", fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.08em", color: "#52525b", marginBottom: "14px",
      }}>
        Work Authorization
      </p>

      {/* Authorized to work */}
      <div style={{ marginBottom: "12px" }}>
        <p style={{ fontSize: "13px", color: "#a1a1aa", marginBottom: "8px" }}>
          Are you legally authorized to work in the US?
        </p>
        <div style={{ display: "flex", gap: "8px" }}>
          <PillToggle
            label="Yes"
            selected={workAuthorized === true}
            onClick={() => onWorkAuthChange(true)}
          />
          <PillToggle
            label="No"
            selected={workAuthorized === false}
            onClick={() => onWorkAuthChange(false)}
          />
        </div>
      </div>

      {/* Sponsorship */}
      <div>
        <p style={{ fontSize: "13px", color: "#a1a1aa", marginBottom: "8px" }}>
          Will you require visa sponsorship?
        </p>
        <div style={{ display: "flex", gap: "8px" }}>
          <PillToggle
            label="No"
            selected={sponsorshipNeeded === false}
            onClick={() => onSponsorshipChange(false)}
          />
          <PillToggle
            label="Yes"
            selected={sponsorshipNeeded === true}
            onClick={() => onSponsorshipChange(true)}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Reusable Pill Toggle ──────────────────────────────────────────────── */

function PillToggle({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 20px",
        borderRadius: "10px",
        fontSize: "13px",
        fontWeight: 600,
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        border: selected
          ? "1px solid rgba(99,102,241,0.4)"
          : "1px solid rgba(255,255,255,0.08)",
        background: selected
          ? "rgba(99,102,241,0.12)"
          : "rgba(255,255,255,0.03)",
        color: selected ? "#a5b4fc" : "#71717a",
        boxShadow: selected ? "0 0 12px rgba(99,102,241,0.1)" : "none",
      }}
    >
      {selected && <span style={{ marginRight: "6px" }}>✓</span>}
      {label}
    </button>
  );
}

/* ── Sub-components ────────────────────────────────────────────────────── */

function ProgressDot({ active, label }: { active: boolean; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
      <div style={{
        width: "10px", height: "10px", borderRadius: "50%",
        background: active ? "linear-gradient(135deg, #6366f1, #8b5cf6)" : "rgba(255,255,255,0.08)",
        border: `2px solid ${active ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.1)"}`,
        transition: "all 0.3s ease",
      }} />
      <span style={{
        fontSize: "9px", fontWeight: 600, textTransform: "uppercase",
        letterSpacing: "0.08em", color: active ? "#a5b4fc" : "#3f3f46",
      }}>{label}</span>
    </div>
  );
}

function ProgressLine() {
  return <div style={{ width: "40px", height: "1px", background: "rgba(255,255,255,0.08)", marginBottom: "16px" }} />;
}

/* ── Styles ─────────────────────────────────────────────────────────────── */

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "12px", fontWeight: 600, color: "#a1a1aa",
  marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.06em",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "14px 16px", borderRadius: "12px",
  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
  color: "#fff", fontSize: "14px", outline: "none", transition: "all 0.3s ease",
};
