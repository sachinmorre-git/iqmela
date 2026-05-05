import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Legal Documents — IQMela",
  description: "IQMela platform legal documents including Terms of Service, Privacy Policy, Data Processing Agreement, and Interviewer Code of Conduct.",
};

const docs = [
  {
    href:        "/legal/terms",
    title:       "Terms of Service",
    description: "Rules governing use of the IQMela platform for all users.",
    updated:     "May 1, 2026",
    badge:       "All Users",
    badgeColor:  "bg-rose-500/20 text-rose-400 border-rose-500/30",
  },
  {
    href:        "/legal/privacy",
    title:       "Privacy Policy",
    description: "How we collect, use, store, and protect your personal data. Compliant with India's DPDP Act 2023 and IT Act 2000.",
    updated:     "May 1, 2026",
    badge:       "All Users",
    badgeColor:  "bg-rose-500/20 text-rose-400 border-rose-500/30",
  },
  {
    href:        "/legal/dpa",
    title:       "Data Processing Agreement",
    description: "India DPDP Act 2023 compliant Data Processing Agreement for client organisations using IQMela™ as a data processor.",
    updated:     "May 1, 2026",
    badge:       "Organisations",
    badgeColor:  "bg-pink-500/20 text-pink-400 border-pink-500/30",
  },
  {
    href:        "/legal/conduct",
    title:       "Interviewer Code of Conduct",
    description: "Standards for fair, unbiased, and professional interviewing on the IQMela platform.",
    updated:     "May 1, 2026",
    badge:       "Interviewers",
    badgeColor:  "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
  {
    href:        "/legal/cookies",
    title:       "Cookie Policy",
    description: "Information about the cookies and local storage used on the IQMela platform.",
    updated:     "May 1, 2026",
    badge:       "All Users",
    badgeColor:  "bg-rose-500/20 text-rose-400 border-rose-500/30",
  },
];

export default function LegalIndexPage() {
  return (
    <div>
      <div className="mb-12">
        <h1 className="text-4xl font-black tracking-tight text-white mb-3">Legal Documents</h1>
        <p className="text-zinc-400 text-lg">
          All platform agreements and policies in one place. Questions?{" "}
          <a href="mailto:legal@iqmela.com" className="text-rose-400 hover:underline">
            legal@iqmela.com
          </a>
        </p>
      </div>

      <div className="space-y-3">
        {docs.map((doc) => (
          <Link
            key={doc.href}
            href={doc.href}
            className="block group border border-zinc-800 rounded-2xl p-6 bg-zinc-900/30 hover:bg-zinc-900/70 hover:border-zinc-700 transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-white font-bold text-lg group-hover:text-rose-300 transition-colors">
                    {doc.title}
                  </h2>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${doc.badgeColor}`}>
                    {doc.badge}
                  </span>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed">{doc.description}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-zinc-600 font-medium">Last updated</p>
                <p className="text-xs text-zinc-500 font-semibold">{doc.updated}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-12 p-5 border border-amber-500/20 rounded-2xl bg-amber-950/10">
        <p className="text-xs text-amber-400/80 leading-relaxed">
          <span className="font-bold">Note:</span> These documents represent IQMela&apos;s standard platform agreements.
          They do not constitute legal advice. For enterprise agreements, custom DPAs, or jurisdiction-specific
          requirements, please contact <a href="mailto:legal@iqmela.com" className="underline">legal@iqmela.com</a>.
        </p>
      </div>
    </div>
  );
}
