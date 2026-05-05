import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { formatDate } from "@/lib/locale-utils"

export const metadata: Metadata = {
  title: "Welcome to the Talent Network | IQMela",
  description: "You're in. Our AI is already looking for your next perfect role.",
};

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ intake?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/careers/join");

  const params = await searchParams;
  const intakeId = params.intake;

  // Ensure User exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    // Auto-create User record from Clerk session (first-time signup via careers)
    const { clerkClient } = await import("@clerk/nextjs/server");
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(userId);
    const email = clerkUser.emailAddresses?.[0]?.emailAddress || "";
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ");

    await prisma.user.create({
      data: {
        id: userId,
        email,
        name: name || null,
        roles: ["PUBLIC_CANDIDATE"],
      },
    });
  }

  // Create or update CandidateProfile with talent network flag
  const existingProfile = await prisma.candidateProfile.findUnique({
    where: { userId },
  });

  if (!existingProfile) {
    await prisma.candidateProfile.create({
      data: {
        userId,
        talentNetworkJoinedAt: new Date(),
        openToWork: true,
      },
    });
  } else if (!existingProfile.talentNetworkJoinedAt) {
    await prisma.candidateProfile.update({
      where: { userId },
      data: { talentNetworkJoinedAt: new Date() },
    });
  }

  // Link IntakeCandidate if provided
  if (intakeId) {
    try {
      const intake = await prisma.intakeCandidate.findUnique({
        where: { id: intakeId },
        select: { id: true, linkedProfileId: true, resumeFileUrl: true },
      });

      if (intake && !intake.linkedProfileId) {
        await prisma.intakeCandidate.update({
          where: { id: intakeId },
          data: { linkedProfileId: userId },
        });

        // Copy resume URL to profile
        if (intake.resumeFileUrl) {
          await prisma.candidateProfile.update({
            where: { userId },
            data: { resumeUrl: intake.resumeFileUrl },
          });
        }
      }
    } catch (err) {
      console.warn("[CareersWelcome] Failed to link intake:", err);
    }
  }

  // Fetch final profile
  const profile = await prisma.candidateProfile.findUnique({
    where: { userId },
  });
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", padding: "60px 24px", textAlign: "center" }}>
      {/* Ambient glow */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "800px",
          height: "400px",
          background: "radial-gradient(ellipse, rgba(34,197,94,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Success icon */}
        <div
          style={{
            width: "80px",
            height: "80px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
            fontSize: "36px",
          }}
        >
          ✦
        </div>

        <h1
          style={{
            fontSize: "32px",
            fontWeight: 900,
            color: "#fff",
            letterSpacing: "-0.03em",
            margin: "0 0 8px",
          }}
        >
          Welcome to the Network
        </h1>
        <p
          style={{
            fontSize: "15px",
            color: "#71717a",
            margin: "0 0 40px",
            lineHeight: 1.6,
            maxWidth: "420px",
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Your profile is ready. Our AI is already looking for roles that match your skills.
        </p>

        {/* Profile card */}
        <div
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "16px",
            padding: "24px",
            textAlign: "left",
            marginBottom: "32px",
          }}
        >
          <h3
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#52525b",
              marginBottom: "16px",
            }}
          >
            Your Profile
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#71717a" }}>Name</span>
              <span style={{ fontSize: "13px", color: "#fff", fontWeight: 600 }}>
                {dbUser?.name || "—"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#71717a" }}>Email</span>
              <span style={{ fontSize: "13px", color: "#fff", fontWeight: 600 }}>
                {dbUser?.email || "—"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#71717a" }}>Status</span>
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  padding: "3px 10px",
                  borderRadius: "9999px",
                  background: "rgba(34,197,94,0.1)",
                  color: "#22c55e",
                  border: "1px solid rgba(34,197,94,0.2)",
                }}
              >
                ● Open to Work
              </span>
            </div>
            {profile?.resumeUrl && (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", color: "#71717a" }}>Resume</span>
                <span style={{ fontSize: "13px", color: "#22c55e", fontWeight: 500 }}>
                  ✓ Uploaded
                </span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "13px", color: "#71717a" }}>Member since</span>
              <span style={{ fontSize: "13px", color: "#fff", fontWeight: 500 }}>
                {formatDate(new Date(), { style: "long" })}
              </span>
            </div>
          </div>
        </div>

        {/* What's next */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginBottom: "32px",
            textAlign: "left",
          }}
        >
          <h3
            style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#52525b",
              marginBottom: "4px",
            }}
          >
            What happens next
          </h3>
          {[
            { icon: "🤖", text: "Our AI will scan new positions daily for roles that match your profile" },
            { icon: "📬", text: "You'll receive an email when we find a strong match" },
            { icon: "🎯", text: "Companies can discover you through our talent pool" },
          ].map((item) => (
            <div
              key={item.text}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                padding: "12px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <span style={{ fontSize: "18px", flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontSize: "13px", color: "#a1a1aa", lineHeight: 1.5 }}>
                {item.text}
              </span>
            </div>
          ))}
        </div>

        <Link
          href="/careers"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            padding: "14px 28px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            color: "#fff",
            fontSize: "14px",
            fontWeight: 700,
            textDecoration: "none",
            transition: "all 0.2s",
          }}
        >
          Browse More Roles →
        </Link>
      </div>
    </div>
  );
}
