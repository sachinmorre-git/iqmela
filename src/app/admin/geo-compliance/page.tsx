import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { GeoComplianceClient } from "./GeoComplianceClient";
import { seedGeoMarkets } from "./actions";

export const metadata = {
  title: "Geo-Compliance Control | IQMela Admin",
  description: "Manage platform availability and compliance frameworks by country, state, and city.",
};

export default async function GeoCompliancePage() {
  const { sessionClaims } = await auth();
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString();
  if (!sysRole?.startsWith("sys:")) redirect("/select-role");

  // Auto-seed on first visit if no records exist
  const count = await prisma.geoMarket.count();
  if (count === 0) {
    await seedGeoMarkets();
  }

  const markets = await prisma.geoMarket.findMany({
    orderBy: [{ countryCode: "asc" }, { region: "asc" }],
  });

  return (
    <div className="flex-1 w-full p-6 sm:p-8 max-w-6xl mx-auto space-y-8 z-10 relative">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-6 mt-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              🌍 Geo-Compliance Control
            </h1>
            <p className="text-zinc-400 mt-2 max-w-2xl">
              Manage platform availability and applicable regulatory frameworks for each country, state, and city.
              Toggle regions on/off and configure feature-level controls per jurisdiction.
            </p>
          </div>
          <form action={seedGeoMarkets}>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold border border-zinc-700 transition-colors"
            >
              Re-seed Defaults
            </button>
          </form>
        </div>

        {/* Compliance Framework Key */}
        <div className="mt-5 flex flex-wrap gap-3">
          {[
            { label: "GDPR", desc: "EU / UK General Data Protection Regulation", color: "text-blue-400 border-blue-500/30 bg-blue-500/10" },
            { label: "CCPA", desc: "California Consumer Privacy Act", color: "text-purple-400 border-purple-500/30 bg-purple-500/10" },
            { label: "DPDP", desc: "India Digital Personal Data Protection Act", color: "text-orange-400 border-orange-500/30 bg-orange-500/10" },
            { label: "PIPEDA", desc: "Canada Personal Information Protection", color: "text-red-400 border-red-500/30 bg-red-500/10" },
            { label: "EEOC", desc: "US Equal Employment Opportunity Commission", color: "text-green-400 border-green-500/30 bg-green-500/10" },
            { label: "AICA", desc: "Australia Privacy Act", color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10" },
          ].map((f) => (
            <span key={f.label} title={f.desc} className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${f.color} cursor-help`}>
              {f.label}
            </span>
          ))}
        </div>
      </div>

      <GeoComplianceClient markets={markets as any} />
    </div>
  );
}
