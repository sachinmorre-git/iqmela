import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import { HeroSection }     from "@/components/homepage/HeroSection";
import { MetricsRow }      from "@/components/homepage/MetricsRow";
import { FeatureTabs }     from "@/components/homepage/FeatureTabs";
import { HowItWorks }      from "@/components/homepage/HowItWorks";
import { PricingSection }  from "@/components/homepage/PricingSection";
import { TrustSection }    from "@/components/homepage/TrustSection";

export const metadata: Metadata = {
  title: "IQMela — Hire with Intelligence",
  description: "AI-powered interview intelligence. Behavioral signals, structured scorecards, and real-time insights — so you can hire with certainty.",
};

export const revalidate = 3600; // ISR: refresh metrics every hour

export default async function Homepage() {
  const [totalInterviews, totalOrgs, totalPositions, avgResult] = await Promise.all([
    prisma.interview.count({ where: { status: "COMPLETED" } }),
    prisma.organization.count(),
    prisma.position.count(),
    prisma.panelistFeedback.aggregate({ _avg: { overallScore: true } }),
  ]);

  const avgScore = avgResult._avg.overallScore;

  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 text-gray-900 dark:text-white overflow-x-hidden">
      <HeroSection />
      <MetricsRow
        totalInterviews={totalInterviews}
        totalOrgs={totalOrgs}
        totalPositions={totalPositions}
        avgScore={avgScore}
      />
      <FeatureTabs />
      <HowItWorks />
      <PricingSection />
      <TrustSection />
    </main>
  );
}
