"use client";

import { useState } from "react";

interface VSISurveyProps {
  intakeCandidateId: string | null;
  onComplete: () => void;
  onSkip: () => void;
}

type VSIField = "gender" | "race" | "veteranStatus" | "disabilityStatus";

const VSI_OPTIONS: {
  field: VSIField;
  label: string;
  description: string;
  options: { value: string; label: string }[];
}[] = [
  {
    field: "gender",
    label: "Gender",
    description: "How do you identify?",
    options: [
      { value: "prefer_not", label: "Prefer not to say" },
      { value: "male", label: "Male" },
      { value: "female", label: "Female" },
      { value: "non_binary", label: "Non-binary" },
    ],
  },
  {
    field: "race",
    label: "Race / Ethnicity",
    description: "Select the option that best describes you.",
    options: [
      { value: "prefer_not", label: "Prefer not to say" },
      { value: "white", label: "White" },
      { value: "black", label: "Black / African American" },
      { value: "asian", label: "Asian" },
      { value: "hispanic_latino", label: "Hispanic / Latino" },
      { value: "native_american", label: "Native American" },
      { value: "pacific_islander", label: "Pacific Islander" },
      { value: "two_or_more", label: "Two or more" },
    ],
  },
  {
    field: "veteranStatus",
    label: "Veteran Status",
    description: "Are you a protected veteran?",
    options: [
      { value: "prefer_not", label: "Prefer not to say" },
      { value: "veteran", label: "Yes, I am a veteran" },
      { value: "not_veteran", label: "No" },
    ],
  },
  {
    field: "disabilityStatus",
    label: "Disability",
    description: "Do you have a disability?",
    options: [
      { value: "prefer_not", label: "Prefer not to say" },
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ],
  },
];

/**
 * Post-apply Voluntary Self-Identification survey.
 * Apple-grade pill selectors — single tap per category.
 * Data stored in sealed CandidateVSI table, never visible to hiring team.
 */
export function VSISurvey({ intakeCandidateId, onComplete, onSkip }: VSISurveyProps) {
  const [selections, setSelections] = useState<Record<VSIField, string | null>>({
    gender: null,
    race: null,
    veteranStatus: null,
    disabilityStatus: null,
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSelect = (field: VSIField, value: string) => {
    setSelections((prev) => ({ ...prev, [field]: value }));
  };

  const answeredCount = Object.values(selections).filter(Boolean).length;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch("/api/public/vsi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intakeCandidateId,
          ...selections,
        }),
      });
    } catch {
      // Non-blocking — VSI is optional
      console.warn("[VSI] Save failed (non-blocking)");
    }
    setIsSaving(false);
    onComplete();
  };

  return (
    <div
      className="hero-enter-3"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        paddingTop: "28px",
        textAlign: "left",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "24px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "5px 14px",
            borderRadius: "9999px",
            background: "rgba(34,197,94,0.06)",
            border: "1px solid rgba(34,197,94,0.12)",
            fontSize: "11px",
            fontWeight: 600,
            color: "#22c55e",
            marginBottom: "12px",
          }}
        >
          🌍 Building a fair workplace
        </div>
        <p
          style={{
            fontSize: "12px",
            color: "#52525b",
            lineHeight: 1.6,
            maxWidth: "400px",
            margin: "0 auto",
          }}
        >
          This is 100% voluntary and will <strong style={{ color: "#71717a" }}>never</strong> affect
          your application. Your answers are stored separately and are not visible to the hiring team.
        </p>
      </div>

      {/* Questions */}
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {VSI_OPTIONS.map((q) => (
          <div key={q.field}>
            <p
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "#a1a1aa",
                marginBottom: "8px",
              }}
            >
              {q.description}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {q.options.map((opt) => {
                const isSelected = selections[q.field] === opt.value;
                const isPreferNot = opt.value === "prefer_not";
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(q.field, opt.value)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: "10px",
                      fontSize: "12px",
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                      border: isSelected
                        ? "1px solid rgba(99,102,241,0.4)"
                        : "1px solid rgba(255,255,255,0.06)",
                      background: isSelected
                        ? "rgba(99,102,241,0.1)"
                        : isPreferNot
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(255,255,255,0.02)",
                      color: isSelected
                        ? "#a5b4fc"
                        : isPreferNot
                        ? "#71717a"
                        : "#a1a1aa",
                      boxShadow: isSelected
                        ? "0 0 10px rgba(99,102,241,0.08)"
                        : "none",
                    }}
                  >
                    {isSelected && (
                      <span style={{ marginRight: "4px" }}>✓</span>
                    )}
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
          marginTop: "24px",
        }}
      >
        <button
          onClick={handleSave}
          disabled={isSaving || answeredCount === 0}
          style={{
            padding: "10px 24px",
            borderRadius: "12px",
            background:
              answeredCount > 0
                ? "linear-gradient(135deg, #6366f1, #8b5cf6)"
                : "rgba(99,102,241,0.15)",
            color: answeredCount > 0 ? "#fff" : "#818cf8",
            fontSize: "13px",
            fontWeight: 700,
            border: "none",
            cursor: answeredCount > 0 && !isSaving ? "pointer" : "default",
            transition: "all 0.2s",
            opacity: isSaving ? 0.6 : 1,
          }}
        >
          {isSaving ? "Saving..." : `Save (${answeredCount}/4)`}
        </button>
        <button
          onClick={onSkip}
          type="button"
          style={{
            background: "none",
            border: "none",
            color: "#3f3f46",
            fontSize: "12px",
            cursor: "pointer",
            padding: "8px 12px",
          }}
        >
          Skip →
        </button>
      </div>
    </div>
  );
}
