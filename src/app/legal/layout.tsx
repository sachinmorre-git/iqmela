import Link from "next/link";
import { Scale } from "lucide-react";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-black/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Scale className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-white text-lg tracking-tight">IQMela</span>
            <span className="text-zinc-500 text-sm font-medium pl-2 border-l border-zinc-700">Legal</span>
          </Link>
          <Link
            href="/legal"
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium"
          >
            ← All Documents
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-16">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 mt-24">
        <div className="max-w-4xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-600">
          <span>© {new Date().getFullYear()} RelyOnAI LLP. IQMela™ is a product of RelyOnAI LLP. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/legal/terms"    className="hover:text-zinc-400 transition-colors">Terms</Link>
            <Link href="/legal/privacy"  className="hover:text-zinc-400 transition-colors">Privacy</Link>
            <Link href="/legal/dpa"      className="hover:text-zinc-400 transition-colors">DPA</Link>
            <Link href="/legal/conduct"  className="hover:text-zinc-400 transition-colors">Conduct</Link>
            <Link href="/legal/cookies"  className="hover:text-zinc-400 transition-colors">Cookies</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
