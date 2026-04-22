import { prisma } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LEGAL_VERSIONS } from "@/lib/legal-versions";
import { Scale, CheckCircle2, Clock, Building2, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Legal Agreements — IQMela Admin" };

export default async function AdminLegalPage() {
  const { sessionClaims } = await auth();
  const sysRole = (sessionClaims?.publicMetadata as Record<string, any>)?.sysRole?.toString();
  if (!sysRole?.startsWith("sys:")) redirect("/admin/dashboard");

  // Acceptance stats
  const [totalUsers, acceptedUsers, totalOrgs, acceptedOrgs, recentOrgs] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { tosVersion: LEGAL_VERSIONS.PLATFORM_TOS } }),
    prisma.organization.count(),
    prisma.organization.count({ where: { msaVersion: LEGAL_VERSIONS.ORG_MSA } }),
    prisma.organization.findMany({
      where:   { msaAcceptedAt: { not: null } },
      orderBy: { msaAcceptedAt: "desc" },
      take:    10,
      select:  { id: true, name: true, msaAcceptedAt: true, msaVersion: true, msaAcceptedBy: true },
    }),
  ]);

  const pendingUsers = totalUsers - acceptedUsers;
  const pendingOrgs  = totalOrgs  - acceptedOrgs;

  const docs = [
    { title: "Platform Terms of Service", version: LEGAL_VERSIONS.PLATFORM_TOS,   href: "/legal/terms",   applies: "All Users" },
    { title: "Privacy Policy",            version: LEGAL_VERSIONS.PRIVACY_POLICY,  href: "/legal/privacy", applies: "All Users" },
    { title: "Org MSA + DPA",             version: LEGAL_VERSIONS.ORG_MSA,        href: "/legal/dpa",     applies: "Organisations" },
    { title: "Interviewer Code of Conduct", version: LEGAL_VERSIONS.INTERVIEWER_COC, href: "/legal/conduct", applies: "Interviewers" },
    { title: "Cookie Policy",             version: LEGAL_VERSIONS.PLATFORM_TOS,   href: "/legal/cookies", applies: "All Users" },
  ];

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
          <Scale className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-white">Legal Agreements</h1>
          <p className="text-zinc-500 text-sm">Version management and acceptance reporting</p>
        </div>
      </div>

      {/* Acceptance stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Users accepted ToS",    value: acceptedUsers, total: totalUsers, icon: Users,    color: "text-emerald-400" },
          { label: "Users pending ToS",     value: pendingUsers,  total: totalUsers, icon: Clock,    color: "text-amber-400"   },
          { label: "Orgs accepted MSA",     value: acceptedOrgs,  total: totalOrgs,  icon: Building2, color: "text-emerald-400" },
          { label: "Orgs pending MSA",      value: pendingOrgs,   total: totalOrgs,  icon: Clock,    color: "text-amber-400"   },
        ].map(({ label, value, total, icon: Icon, color }) => (
          <div key={label} className="border border-zinc-800 rounded-2xl p-4 bg-zinc-900/40">
            <Icon className={`w-5 h-5 ${color} mb-2`} />
            <p className={`text-3xl font-black ${color}`}>{value}</p>
            <p className="text-xs text-zinc-500 mt-1 font-medium">{label}</p>
            <div className="mt-2 w-full bg-zinc-800 rounded-full h-1">
              <div
                className={`h-1 rounded-full ${color === "text-emerald-400" ? "bg-emerald-500" : "bg-amber-500"}`}
                style={{ width: total > 0 ? `${(value / total) * 100}%` : "0%" }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Document versions */}
      <div>
        <h2 className="text-sm font-extrabold uppercase tracking-widest text-zinc-500 mb-3">Active Document Versions</h2>
        <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left px-5 py-3 text-zinc-400 font-bold">Document</th>
                <th className="text-left px-5 py-3 text-zinc-400 font-bold">Version</th>
                <th className="text-left px-5 py-3 text-zinc-400 font-bold">Applies To</th>
                <th className="text-left px-5 py-3 text-zinc-400 font-bold">Effective</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {docs.map((doc) => (
                <tr key={doc.href} className="hover:bg-zinc-800/20">
                  <td className="px-5 py-3 text-white font-medium">{doc.title}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs font-mono bg-zinc-800 px-2 py-1 rounded border border-zinc-700 text-zinc-300">
                      v{doc.version}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-zinc-400">{doc.applies}</td>
                  <td className="px-5 py-3 text-zinc-500 text-xs">{LEGAL_VERSIONS.EFFECTIVE_DATE}</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={doc.href} target="_blank"
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold">
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-600 mt-3 px-1">
          To trigger re-consent, bump the version string in{" "}
          <code className="text-zinc-500">src/lib/legal-versions.ts</code>{" "}
          and deploy. Users will see the agreement gate on next login.
        </p>
      </div>

      {/* Recent org acceptances */}
      <div>
        <h2 className="text-sm font-extrabold uppercase tracking-widest text-zinc-500 mb-3">Recent Org MSA Acceptances</h2>
        {recentOrgs.length === 0 ? (
          <div className="border border-zinc-800 rounded-2xl p-8 text-center text-zinc-600 bg-zinc-900/20">
            No organisations have accepted the MSA yet.
          </div>
        ) : (
          <div className="border border-zinc-800 rounded-2xl overflow-hidden bg-zinc-900/30">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-5 py-3 text-zinc-400 font-bold">Organisation</th>
                  <th className="text-left px-5 py-3 text-zinc-400 font-bold">Signatory</th>
                  <th className="text-left px-5 py-3 text-zinc-400 font-bold">MSA Version</th>
                  <th className="text-left px-5 py-3 text-zinc-400 font-bold">Accepted At</th>
                  <th className="text-left px-5 py-3 text-zinc-400 font-bold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {recentOrgs.map((org) => (
                  <tr key={org.id} className="hover:bg-zinc-800/20">
                    <td className="px-5 py-3 text-white font-medium">{org.name}</td>
                    <td className="px-5 py-3 text-zinc-400">{org.msaAcceptedBy ?? "—"}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-mono bg-zinc-800 px-2 py-1 rounded border border-zinc-700 text-zinc-300">
                        v{org.msaVersion}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-500 text-xs">
                      {org.msaAcceptedAt
                        ? new Date(org.msaAcceptedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      {org.msaVersion === LEGAL_VERSIONS.ORG_MSA ? (
                        <span className="flex items-center gap-1 text-emerald-400 text-xs font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Current
                        </span>
                      ) : (
                        <span className="text-amber-400 text-xs font-bold">Outdated — re-consent needed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
