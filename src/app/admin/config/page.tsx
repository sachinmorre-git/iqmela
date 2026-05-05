import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ConfigClient } from "./ConfigClient";

export const metadata = {
  title: "Platform Configuration | IQMela Admin",
};

export default async function PlatformConfigPage() {
  const { sessionClaims } = await auth();
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString();
  if (!sysRole?.startsWith("sys:")) redirect("/select-role");

  // Load platform config (upsert to ensure row exists)
  const config = await prisma.platformConfig.upsert({
    where: { id: "GLOBAL" },
    create: { id: "GLOBAL" },
    update: {},
  });

  // Load all organizations for the per-client override panel
  const orgs = await prisma.organization.findMany({
    select: { id: true, planTier: true, domain: true },
    orderBy: { createdAt: "desc" },
  });

  // Load all overrides
  const overrides = await prisma.orgFeatureOverride.findMany({
    orderBy: { featureKey: "asc" },
  });

  return (
    <div className="flex-1 w-full p-6 sm:p-8 max-w-6xl mx-auto space-y-8 z-10 relative">
      <div className="border-b border-zinc-800 pb-6 mt-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Platform Configuration</h1>
        <p className="text-zinc-400 mt-2">Global kill switches and per-client feature overrides for the entire IQMela platform.</p>
      </div>

      <ConfigClient config={config} orgs={orgs} overrides={overrides} />
    </div>
  );
}
