import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildCompliantJdText } from "@/lib/compliance-constants";
import { ApplyForm } from "./ApplyForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const pos = await prisma.position.findFirst({
    where: { id, isPublished: true, isDeleted: false },
    select: { title: true, location: true, description: true },
  });
  if (!pos) return { title: "Job Not Found | IQMela Careers" };
  return {
    title: `${pos.title}${pos.location ? ` — ${pos.location}` : ""} | IQMela Careers`,
    description: (pos.description || "").substring(0, 155),
    openGraph: {
      title: `${pos.title} | IQMela Careers`,
      description: (pos.description || "").substring(0, 155),
      type: "website",
    },
  };
}

export default async function CareerJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const position = await prisma.position.findFirst({
    where: { id, isPublished: true, isDeleted: false },
    select: {
      id: true,
      title: true,
      description: true,
      jdText: true,
      location: true,
      employmentType: true,
      remotePolicy: true,
      salaryMin: true,
      salaryMax: true,
      salaryCurrency: true,
      jdRequiredSkillsJson: true,
      jdPreferredSkillsJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!position) notFound();

  const jdBody = position.jdText || position.description || "";
  const compliantJd = buildCompliantJdText(jdBody);
  const requiredSkills = Array.isArray(position.jdRequiredSkillsJson)
    ? (position.jdRequiredSkillsJson as string[])
    : [];
  const preferredSkills = Array.isArray(position.jdPreferredSkillsJson)
    ? (position.jdPreferredSkillsJson as string[])
    : [];

  const daysAgo = Math.floor(
    (Date.now() - position.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.iqmela.com";

  // Google Jobs JSON-LD
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: position.title,
    description: compliantJd,
    datePosted: position.createdAt.toISOString().split("T")[0],
    validThrough: getValidThrough(position.createdAt),
    hiringOrganization: {
      "@type": "Organization",
      name: "IQMela Partner Organization",
      sameAs: baseUrl,
    },
    ...(position.remotePolicy === "REMOTE"
      ? {
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: { "@type": "Country", name: "US" },
        }
      : {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: position.location || "United States",
            },
          },
        }),
    ...(position.salaryMin || position.salaryMax
      ? {
          baseSalary: {
            "@type": "MonetaryAmount",
            currency: position.salaryCurrency || "USD",
            value: {
              "@type": "QuantitativeValue",
              ...(position.salaryMin ? { minValue: position.salaryMin } : {}),
              ...(position.salaryMax ? { maxValue: position.salaryMax } : {}),
              unitText: "YEAR",
            },
          },
        }
      : {}),
    employmentType: mapEmploymentType(position.employmentType),
    directApply: true,
  };

  return (
    <>
      {/* JSON-LD for Google */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 24px" }}>
        {/* ── Ambient glow ──────────────────────────────────────────────── */}
        <div
          style={{
            position: "fixed",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "1000px",
            height: "500px",
            background:
              "radial-gradient(ellipse, rgba(99,102,241,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
            zIndex: 0,
          }}
        />

        {/* ── Back link ────────────────────────────────────────────────── */}
        <div style={{ padding: "32px 0 0", position: "relative", zIndex: 1 }}>
          <a
            href="/careers"
            style={{
              fontSize: "13px",
              color: "#818cf8",
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            ← All Positions
          </a>
        </div>

        {/* ── Job header ───────────────────────────────────────────────── */}
        <div style={{ padding: "24px 0 32px", position: "relative", zIndex: 1 }}>
          <h1
            style={{
              fontSize: "clamp(28px, 4vw, 40px)",
              fontWeight: 900,
              letterSpacing: "-0.03em",
              color: "#fff",
              margin: "0 0 16px",
              lineHeight: 1.15,
            }}
          >
            {position.title}
          </h1>

          {/* Badge row */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
            {position.location && (
              <Badge icon="📍" label={position.location} />
            )}
            {position.remotePolicy && (
              <Badge
                label={position.remotePolicy}
                accent={position.remotePolicy === "REMOTE"}
              />
            )}
            {position.employmentType && (
              <Badge label={position.employmentType.replace("_", " ")} />
            )}
            {position.salaryMin && (
              <Badge
                label={`${position.salaryCurrency || "$"}${position.salaryMin.toLocaleString()}${
                  position.salaryMax
                    ? `–${position.salaryMax.toLocaleString()}`
                    : "+"
                }/yr`}
                accent
              />
            )}
            <Badge label={daysAgo === 0 ? "Posted today" : `Posted ${daysAgo}d ago`} />
          </div>
        </div>

        {/* ── Key Requirements ──────────────────────────────────────────── */}
        {requiredSkills.length > 0 && (
          <div style={{ marginBottom: "32px", position: "relative", zIndex: 1 }}>
            <h2 style={sectionHeading}>Key Requirements</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {requiredSkills.map((s) => (
                <span
                  key={s}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "6px",
                    background: "rgba(99,102,241,0.08)",
                    border: "1px solid rgba(99,102,241,0.15)",
                    color: "#a5b4fc",
                    fontSize: "12px",
                    fontWeight: 500,
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Job Description ───────────────────────────────────────────── */}
        <div
          style={{
            position: "relative",
            zIndex: 1,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "16px",
            padding: "32px",
            marginBottom: "32px",
          }}
        >
          <h2 style={sectionHeading}>About This Role</h2>
          <div
            style={{
              whiteSpace: "pre-wrap",
              fontSize: "14px",
              lineHeight: 1.8,
              color: "#a1a1aa",
            }}
          >
            {compliantJd}
          </div>
        </div>

        {/* ── Preferred Skills ──────────────────────────────────────────── */}
        {preferredSkills.length > 0 && (
          <div style={{ marginBottom: "32px", position: "relative", zIndex: 1 }}>
            <h2 style={sectionHeading}>Nice to Have</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {preferredSkills.map((s) => (
                <span
                  key={s}
                  style={{
                    padding: "4px 12px",
                    borderRadius: "6px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    color: "#71717a",
                    fontSize: "12px",
                    fontWeight: 500,
                  }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Apply Form ────────────────────────────────────────────────── */}
        <div
          id="apply"
          style={{
            position: "relative",
            zIndex: 1,
            marginBottom: "64px",
          }}
        >
          <ApplyForm positionId={position.id} positionTitle={position.title} />
        </div>
      </div>
    </>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function Badge({
  icon,
  label,
  accent,
}: {
  icon?: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "5px 12px",
        borderRadius: "8px",
        fontSize: "12px",
        fontWeight: 500,
        background: accent ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.04)",
        color: accent ? "#818cf8" : "#71717a",
        border: `1px solid ${accent ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.06)"}`,
      }}
    >
      {icon && <span>{icon}</span>}
      {label}
    </span>
  );
}

const sectionHeading: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  color: "#52525b",
  marginBottom: "12px",
};

function mapEmploymentType(type: string | null | undefined): string {
  switch (type?.toUpperCase()) {
    case "FULL_TIME": return "FULL_TIME";
    case "PART_TIME": return "PART_TIME";
    case "CONTRACT": return "CONTRACTOR";
    case "INTERNSHIP": return "INTERN";
    case "TEMPORARY": return "TEMPORARY";
    default: return "FULL_TIME";
  }
}

function getValidThrough(createdAt: Date): string {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + 60);
  return d.toISOString().split("T")[0];
}
