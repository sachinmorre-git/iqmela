import Link from "next/link";
import { Shield, Lock, Trash2 } from "lucide-react";

const PROCESSORS = [
  { name: "LiveKit",      role: "Real-time video" },
  { name: "Gemini AI",   role: "AI analysis"     },
  { name: "Clerk",        role: "Authentication"  },
  { name: "AssemblyAI",  role: "Transcription"   },
  { name: "Vercel",       role: "Infrastructure"  },
  { name: "Neon",         role: "Database"        },
];

const COMPLIANCE = [
  { icon: Shield, label: "DPDP Act 2023",       sub: "India data protection law"  },
  { icon: Lock,   label: "End-to-End Encrypted", sub: "TLS 1.3 in transit"         },
  { icon: Trash2, label: "Auto-Delete 90 Days", sub: "Recordings purged automatically" },
];

export function TrustSection() {
  return (
    <section className="py-20 px-4 border-t border-gray-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-950">
      <div className="max-w-5xl mx-auto space-y-14">
        {/* Compliance badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {COMPLIANCE.map(({ icon: Icon, label, sub }) => (
            <div key={label} className="flex items-start gap-4 p-5 rounded-2xl border border-zinc-800 bg-zinc-900/30">
              <div className="w-9 h-9 rounded-xl bg-emerald-600/15 border border-emerald-500/25 flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{label}</p>
                <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Sub-processors */}
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 text-center mb-6">
            Powered by world-class infrastructure
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {PROCESSORS.map(({ name, role }) => (
              <div key={name}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900/40">
                <span className="text-sm font-black text-white">{name}</span>
                <span className="text-[10px] text-zinc-600">{role}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Legal links */}
        <div className="flex flex-wrap justify-center gap-4 text-xs text-zinc-600">
          <Link href="/legal/privacy"  className="hover:text-zinc-400 transition-colors">Privacy Policy</Link>
          <Link href="/legal/terms"    className="hover:text-zinc-400 transition-colors">Terms of Service</Link>
          <Link href="/legal/dpa"      className="hover:text-zinc-400 transition-colors">Data Processing Agreement</Link>
          <Link href="/legal/cookies"  className="hover:text-zinc-400 transition-colors">Cookie Policy</Link>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-zinc-700 pb-4">
          © {new Date().getFullYear()} RelyOnAI LLP. IQMela™ is a product of RelyOnAI LLP. All rights reserved.
        </div>
      </div>
    </section>
  );
}
