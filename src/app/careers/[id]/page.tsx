import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { buildCompliantJdText } from "@/lib/compliance-constants";
import { ApplyForm } from "./ApplyForm";
import { ScrollReveal } from "../ScrollReveal";
import { StickyApplyBar } from "./StickyApplyBar";
import { ReadingProgress } from "./ReadingProgress";
import { isIntakeOpen, daysRemaining } from "@/lib/intake-window";
import { auth } from "@clerk/nextjs/server";
import { Gift } from "lucide-react";
import { ViewTracker } from "./ViewTracker";
import { ReferralLinkButton } from "./ReferralLinkButton";

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
      images: [
        {
          url: "/brand/icon/iq-icon-512.png",
          width: 512,
          height: 512,
          alt: "IQMela Logo",
        },
      ],
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
      isPublished: true,
      intakeWindowDays: true,
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

  // Intake window status
  const intakeClosed = !isIntakeOpen(position);
  const daysLeft = daysRemaining(position);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.iqmela.com";

  // ── Quick Apply: detect signed-in Talent Network member ─────────────
  let quickProfile: {
    name: string;
    email: string;
    resumeUrl: string | null;
    profileId: string;
  } | null = null;

  try {
    const { userId } = await auth();
    if (userId) {
      const profile = await prisma.candidateProfile.findUnique({
        where: { userId },
        select: {
          id: true,
          resumeUrl: true,
          user: { select: { name: true, email: true } },
          talentNetworkJoinedAt: true,
        },
      });
      // Only enable Quick Apply for Talent Network members
      if (profile?.talentNetworkJoinedAt && profile.user.email) {
        quickProfile = {
          name: profile.user.name || "Candidate",
          email: profile.user.email,
          resumeUrl: profile.resumeUrl,
          profileId: profile.id,
        };
      }
    }
  } catch {
    // Auth check can fail gracefully — just show full form
  }

  // ── Fetch Referral Flags ───────────────────────────────────────────────────
  const platformConfig = await prisma.platformConfig.findUnique({ where: { id: "GLOBAL" } });
  const showJobBounties = platformConfig?.referralsEnabled && platformConfig?.jobBountyReferralsEnabled;
  let bountyReward = { amount: 2000, currency: "USD", rewardType: "CASH" };
  if (platformConfig?.referralRewardRules) {
    try {
      const rules = platformConfig.referralRewardRules as any[];
      const rule = rules.find((r) => r.type === "JOB_BOUNTY" && r.country === "GLOBAL");
      if (rule) bountyReward = rule;
    } catch (e) {}
  }

  const formatReward = (reward: any) => {
    const curr = reward.currency === "USD" ? "$" : reward.currency + " ";
    return `${curr}${reward.amount.toLocaleString()}`;
  };

  // Google Jobs JSON-LD
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: position.title,
    description: compliantJd,
    datePosted: position.createdAt.toISOString().split("T")[0],
    validThrough: getValidThrough(position.createdAt, position.intakeWindowDays),
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

      {/* Reading Progress Bar */}
      <ReadingProgress />
      <ViewTracker positionId={position.id} />

      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "0 24px" }}>
        {/* ── Back link ────────────────────────────────────────────────── */}
        <div className="hero-enter-1" style={{ padding: "40px 0 0" }}>
          <a
            href="/careers"
            style={{
              fontSize: "13px",
              color: "#818cf8",
              textDecoration: "none",
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s",
            }}
          >
            <span style={{ fontSize: "16px" }}>←</span>
            All Positions
          </a>
        </div>

        {/* ── Job header ───────────────────────────────────────────────── */}
        <div style={{ padding: "28px 0 40px" }}>
          <div className="hero-enter-2">
            <h1
              style={{
                fontSize: "clamp(32px, 4.5vw, 48px)",
                fontWeight: 900,
                letterSpacing: "-0.04em",
                color: "#fff",
                margin: "0 0 20px",
                lineHeight: 1.1,
              }}
            >
              {position.title}
              {/* Gradient underline accent */}
              <div
                style={{
                  height: "3px",
                  width: "60px",
                  borderRadius: "2px",
                  background: "linear-gradient(90deg, #6366f1, #c084fc)",
                  marginTop: "16px",
                }}
              />
            </h1>
          </div>

          {/* Badge row */}
          <div className="hero-enter-3">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                marginBottom: "16px",
              }}
            >
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
                <Badge
                  label={position.employmentType.replace("_", " ")}
                />
              )}
              {position.salaryMin && (
                <Badge
                  label={`${position.salaryCurrency || "$"}${position.salaryMin.toLocaleString()}${position.salaryMax ? `–${position.salaryMax.toLocaleString()}` : "+"}/yr`}
                  accent
                />
              )}
              <Badge
                label={
                  daysAgo === 0
                    ? "Posted today"
                    : daysAgo === 1
                    ? "Posted yesterday"
                    : `Posted ${daysAgo}d ago`
                }
              />
            </div>
          </div>
        </div>

        {/* ── Key Requirements ──────────────────────────────────────────── */}
        {requiredSkills.length > 0 && (
          <ScrollReveal>
            <div style={{ marginBottom: "36px" }}>
              <h2 style={sectionHeading}>Key Requirements</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {requiredSkills.map((s) => (
                  <span
                    key={s}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
                      background: "rgba(99,102,241,0.06)",
                      border: "1px solid rgba(99,102,241,0.12)",
                      color: "#a5b4fc",
                      fontSize: "12px",
                      fontWeight: 500,
                      transition: "all 0.2s",
                    }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </ScrollReveal>
        )}

        {/* ── Job Description ───────────────────────────────────────────── */}
        <ScrollReveal>
          <div
            className="glass"
            style={{
              borderRadius: "20px",
              padding: "36px",
              marginBottom: "36px",
            }}
          >
            <h2 style={sectionHeading}>About This Role</h2>
            <div
              style={{
                whiteSpace: "pre-wrap",
                fontSize: "14px",
                lineHeight: 1.85,
                color: "#a1a1aa",
              }}
            >
              {compliantJd}
            </div>
          </div>
        </ScrollReveal>

        {/* ── Preferred Skills ──────────────────────────────────────────── */}
        {preferredSkills.length > 0 && (
          <ScrollReveal>
            <div style={{ marginBottom: "36px" }}>
              <h2 style={sectionHeading}>Nice to Have</h2>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {preferredSkills.map((s) => (
                  <span
                    key={s}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "8px",
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
          </ScrollReveal>
        )}

        {/* ── Referral Bounty ────────────────────────────────────────────── */}
        {showJobBounties && (
          <ScrollReveal>
            <div className="rounded-2xl border border-teal-500/30 bg-gradient-to-br from-teal-900/40 to-emerald-900/20 p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl shadow-teal-500/10 mb-[36px]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/20 flex items-center justify-center border border-teal-500/30 shrink-0">
                  <Gift className="w-6 h-6 text-teal-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Refer a friend. Earn a bounty.</h3>
                  <p className="text-sm text-teal-200">
                    Know someone perfect for this role? Share your unique tracking link. If they get hired, you earn a <strong className="text-white">{formatReward(bountyReward)}</strong> referral bonus.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 w-full md:w-auto">
                <ReferralLinkButton positionId={position.id} />
              </div>
            </div>
          </ScrollReveal>
        )}

        {/* ── Apply Form ────────────────────────────────────────────────── */}
        <ScrollReveal>
          <div id="apply" style={{ marginBottom: "80px" }}>
            <ApplyForm
              positionId={position.id}
              positionTitle={position.title}
              quickProfile={quickProfile}
              intakeClosed={intakeClosed}
              daysLeft={daysLeft}
            />
          </div>
        </ScrollReveal>
      </div>

      {/* Sticky Apply Bar (appears on scroll) */}
      <StickyApplyBar positionTitle={position.title} />
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
        padding: "6px 14px",
        borderRadius: "10px",
        fontSize: "12px",
        fontWeight: 500,
        background: accent
          ? "rgba(99,102,241,0.08)"
          : "rgba(255,255,255,0.03)",
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
  letterSpacing: "0.12em",
  color: "#52525b",
  marginBottom: "14px",
};

function mapEmploymentType(type: string | null | undefined): string {
  switch (type?.toUpperCase()) {
    case "FULL_TIME":
      return "FULL_TIME";
    case "PART_TIME":
      return "PART_TIME";
    case "CONTRACT":
      return "CONTRACTOR";
    case "INTERNSHIP":
      return "INTERN";
    case "TEMPORARY":
      return "TEMPORARY";
    default:
      return "FULL_TIME";
  }
}

function getValidThrough(createdAt: Date, intakeWindowDays: number = 10): string {
  const d = new Date(createdAt);
  d.setDate(d.getDate() + intakeWindowDays);
  return d.toISOString().split("T")[0];
}
