import type { Metadata } from "next";
import { LEGAL_VERSIONS } from "@/lib/legal-versions";

export const metadata: Metadata = {
  title: "Cookie Policy — IQMela",
  description: "IQMela Cookie Policy — we use only essential session cookies. No tracking, no advertising.",
};

export default function CookiesPage() {
  return (
    <article className="prose prose-invert prose-zinc max-w-none">
      <div className="mb-10 pb-8 border-b border-zinc-800">
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mb-3">Cookie Policy</p>
        <h1 className="text-4xl font-black tracking-tight text-white mb-4 mt-0">Cookie Policy</h1>
        <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
          <span>Version {LEGAL_VERSIONS.PLATFORM_TOS}</span>
          <span>·</span>
          <span>Effective {LEGAL_VERSIONS.EFFECTIVE_DATE}</span>
        </div>
      </div>

      <div className="mb-10 p-5 border border-emerald-500/20 rounded-2xl bg-emerald-950/10">
        <p className="text-sm text-emerald-300 font-medium">
          ✅ <strong>Short version:</strong> IQMela uses only strictly necessary session cookies. We do not use
          advertising cookies, tracking pixels, or any analytics that profile you across websites.
        </p>
      </div>

      <LegalSection title="1. What Are Cookies?">
        <p>
          Cookies are small text files stored in your browser when you visit a website. They allow websites
          to remember information about your visit, such as your login session or preferences.
        </p>
      </LegalSection>

      <LegalSection title="2. Cookies We Use">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700">
              <th className="text-left py-2 pr-4 text-zinc-300 font-bold">Cookie</th>
              <th className="text-left py-2 pr-4 text-zinc-300 font-bold">Purpose</th>
              <th className="text-left py-2 pr-4 text-zinc-300 font-bold">Type</th>
              <th className="text-left py-2 text-zinc-300 font-bold">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {[
              ["__clerk_session", "Authentication and session management (Clerk)", "Essential", "Session"],
              ["user_role", "Stores your active platform role to avoid re-reading from session on every page", "Essential", "Session"],
              ["__vercel_*", "Vercel edge network routing (infrastructure, not tracking)", "Essential", "Session"],
            ].map(([name, purpose, type, duration]) => (
              <tr key={name}>
                <td className="py-2 pr-4 text-zinc-400 font-mono text-xs">{name}</td>
                <td className="py-2 pr-4 text-zinc-400">{purpose}</td>
                <td className="py-2 pr-4">
                  <span className="text-emerald-400 text-xs font-bold">{type}</span>
                </td>
                <td className="py-2 text-zinc-500 text-xs">{duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </LegalSection>

      <LegalSection title="3. Local Storage">
        <p>
          In addition to cookies, IQMela uses browser localStorage for:
        </p>
        <ul>
          <li>Temporary interview room state (camera/microphone preferences)</li>
          <li>UI preferences such as sidebar state</li>
        </ul>
        <p>
          This data is stored only on your device, never transmitted to our servers, and cleared when
          you clear your browser data.
        </p>
      </LegalSection>

      <LegalSection title="4. What We Do NOT Use">
        <ul>
          <li>Third-party advertising or retargeting cookies</li>
          <li>Cross-site tracking pixels</li>
          <li>Analytics cookies that profile individual users (e.g. Google Analytics, Mixpanel)</li>
          <li>Social media tracking cookies</li>
          <li>Any form of fingerprinting technology</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Your Choices">
        <p>
          You can control or delete cookies through your browser settings. However, disabling essential cookies
          will prevent you from logging in and using the platform.
        </p>
        <p>
          Since we only use strictly necessary cookies, a cookie consent banner is not required under most
          data protection regulations. If you are in a jurisdiction that requires consent for all cookies,
          contact us at{" "}
          <a href={`mailto:${LEGAL_VERSIONS.LEGAL_EMAIL}`} className="text-rose-400 hover:underline">
            {LEGAL_VERSIONS.LEGAL_EMAIL}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="6. Changes to This Policy">
        <p>
          We will update this policy if we introduce new cookies. The effective date at the top of this page
          will be updated accordingly.
        </p>
      </LegalSection>
    </article>
  );
}

function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold text-white mb-4 mt-0">{title}</h2>
      <div className="text-zinc-400 leading-relaxed space-y-3 text-[15px]">{children}</div>
    </section>
  );
}
