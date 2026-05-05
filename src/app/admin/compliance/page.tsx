import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ComplianceClient } from "./ComplianceClient";
import { Prisma } from "@prisma/client";

export const metadata = {
  title: "Compliance Rules | IQMela Admin",
};

export default async function CompliancePage() {
  const { sessionClaims } = await auth();
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString();
  if (!sysRole?.startsWith("sys:")) redirect("/select-role");

  const rules = await prisma.complianceRule.findMany({
    orderBy: [{ country: "asc" }, { state: "asc" }, { city: "asc" }],
  });

  const config = await prisma.platformConfig.upsert({
    where: { id: "GLOBAL" },
    create: { id: "GLOBAL" },
    update: {},
  });

  return (
    <div className="flex-1 w-full p-6 sm:p-8 max-w-6xl mx-auto space-y-8 z-10 relative">
      <div className="border-b border-zinc-800 pb-6 mt-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Compliance Engine</h1>
        <p className="text-zinc-400 mt-2">Manage geo-based compliance rules auto-applied to positions by location.</p>
      </div>

      <ComplianceClient initialRules={rules} config={config} />
    </div>
  );
}
