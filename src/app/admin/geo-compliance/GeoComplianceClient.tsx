"use client";

import { useState, useTransition } from "react";
import {
  Globe, Shield, AlertTriangle, CheckCircle2, XCircle,
  ChevronDown, ChevronRight, Loader2, Video, Fingerprint,
  Users, Search, Info, Clock, Scale, Eye, ScanFace, Bot, FileSearch
} from "lucide-react";
import { updateGeoMarket } from "./actions";

type GeoMarket = {
  id: string;
  countryCode: string;
  countryName: string;
  region: string;
  city: string;
  isEnabled: boolean;
  isComingSoon: boolean;
  // Privacy frameworks
  gdprApplies: boolean;
  ccpaApplies: boolean;
  pdpaApplies: boolean;
  pipedaApplies: boolean;
  quebecLaw25Applies: boolean;
  albertaPipa: boolean;
  eeocApplies: boolean;
  aicaApplies: boolean;
  // AI-specific laws
  aiAuditRequired: boolean;
  aiAuditLawRef: string | null;
  aiVideoConsentRequired: boolean;
  aiVideoLawRef: string | null;
  aiDisclosureRequired: boolean;
  aiDisclosureLawRef: string | null;
  automatedDecisionReview: boolean;
  automatedDecisionLawRef: string | null;
  facialRecogConsentRequired: boolean;
  facialRecogLawRef: string | null;
  algorithmicTransparency: boolean;
  algorithmicLawRef: string | null;
  dataMinimizationRequired: boolean;
  // Features
  aiInterviewsAllowed: boolean;
  bgvAllowed: boolean;
  videoRecordingAllowed: boolean;
  biometricProhibited: boolean;
  notes: string | null;
  updatedAt: Date;
};

const COUNTRY_META: Record<string, { flag: string; accent: string; bg: string; border: string }> = {
  US: { flag: "🇺🇸", accent: "text-blue-400", bg: "from-blue-900/30 to-zinc-900/60", border: "border-blue-500/25" },
  IN: { flag: "🇮🇳", accent: "text-orange-400", bg: "from-orange-900/30 to-zinc-900/60", border: "border-orange-500/25" },
  CA: { flag: "🇨🇦", accent: "text-red-400", bg: "from-red-900/30 to-zinc-900/60", border: "border-red-500/25" },
  GB: { flag: "🇬🇧", accent: "text-sky-400", bg: "from-sky-900/30 to-zinc-900/60", border: "border-sky-500/25" },
  AU: { flag: "🇦🇺", accent: "text-yellow-400", bg: "from-yellow-900/30 to-zinc-900/60", border: "border-yellow-500/25" },
};

// Privacy framework tags
const PRIVACY_TAGS = [
  { key: "gdprApplies",       label: "GDPR",       color: "bg-blue-500/10 text-blue-400 border-blue-500/25",     title: "EU/UK General Data Protection Regulation" },
  { key: "ccpaApplies",       label: "CCPA/CPRA",  color: "bg-purple-500/10 text-purple-400 border-purple-500/25", title: "California Consumer Privacy Act / Privacy Rights Act" },
  { key: "pdpaApplies",       label: "DPDP",       color: "bg-orange-500/10 text-orange-400 border-orange-500/25", title: "India Digital Personal Data Protection Act 2023" },
  { key: "pipedaApplies",     label: "PIPEDA",     color: "bg-red-500/10 text-red-400 border-red-500/25",         title: "Canada Personal Information Protection and Electronic Documents Act" },
  { key: "quebecLaw25Applies",label: "QC Law 25",  color: "bg-rose-500/10 text-rose-400 border-rose-500/25",      title: "Quebec Law 25 — stricter than PIPEDA, GDPR-equivalent" },
  { key: "albertaPipa",       label: "AB PIPA",    color: "bg-pink-500/10 text-pink-400 border-pink-500/25",      title: "Alberta Personal Information Protection Act" },
  { key: "eeocApplies",       label: "EEOC",       color: "bg-green-500/10 text-green-400 border-green-500/25",   title: "US Equal Employment Opportunity Commission rules" },
  { key: "aicaApplies",       label: "AU Privacy", color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/25", title: "Australia Privacy Act 1988" },
] as const;

// AI-specific law tags — shown as warning badges
const AI_LAW_TAGS: Array<{ key: keyof GeoMarket; refKey: keyof GeoMarket; label: string; icon: any; color: string; severity: "high" | "medium" | "info" }> = [
  { key: "aiAuditRequired",           refKey: "aiAuditLawRef",           label: "Bias Audit Reqd.",   icon: FileSearch, color: "bg-rose-500/15 text-rose-300 border-rose-500/30",   severity: "high" },
  { key: "aiVideoConsentRequired",    refKey: "aiVideoLawRef",           label: "AI Video Consent",   icon: Video,      color: "bg-amber-500/15 text-amber-300 border-amber-500/30", severity: "high" },
  { key: "automatedDecisionReview",   refKey: "automatedDecisionLawRef", label: "Human Review Right", icon: Users,      color: "bg-violet-500/15 text-violet-300 border-violet-500/30", severity: "medium" },
  { key: "facialRecogConsentRequired",refKey: "facialRecogLawRef",       label: "FaceRec Consent",    icon: ScanFace,   color: "bg-red-500/15 text-red-300 border-red-500/30",       severity: "high" },
  { key: "aiDisclosureRequired",      refKey: "aiDisclosureLawRef",      label: "AI Disclosure",      icon: Eye,        color: "bg-sky-500/15 text-sky-300 border-sky-500/30",        severity: "medium" },
  { key: "algorithmicTransparency",   refKey: "algorithmicLawRef",       label: "Algo Transparency",  icon: Bot,        color: "bg-teal-500/15 text-teal-300 border-teal-500/30",     severity: "medium" },
  { key: "dataMinimizationRequired",  refKey: "dataMinimizationRequired",label: "Data Minimization",  icon: Scale,      color: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30", severity: "info" },
];

function MiniToggle({ enabled, onClick, disabled, color = "bg-emerald-500" }: { enabled: boolean; onClick: () => void; disabled: boolean; color?: string }) {
  return (
    <button onClick={onClick} disabled={disabled} type="button"
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-200 focus:outline-none disabled:opacity-40 ${enabled ? `${color} shadow-lg` : "bg-zinc-700"}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-all duration-200 ${enabled ? "translate-x-4" : "translate-x-0"}`} />
    </button>
  );
}

function RegionRow({ market, isPending, startTransition }: { market: GeoMarket; isPending: boolean; startTransition: any }) {
  const [showNotes, setShowNotes] = useState(false);
  const update = (field: string, val: boolean) => startTransition(() => updateGeoMarket(market.id, { [field]: val }));

  const activeLaws = AI_LAW_TAGS.filter((t) => market[t.key] as boolean);
  const activePrivacy = PRIVACY_TAGS.filter((t) => market[t.key as keyof GeoMarket] as boolean);
  const label = market.city ? `${market.region} → ${market.city}` : market.region || "National";

  return (
    <div className="border-b border-zinc-800/50 last:border-none">
      <div className="flex items-start gap-3 px-5 py-3.5 hover:bg-zinc-900/30 transition-colors">
        {/* Enable Toggle */}
        <div className="shrink-0 pt-0.5">
          <MiniToggle enabled={market.isEnabled} onClick={() => update("isEnabled", !market.isEnabled)} disabled={isPending} color="bg-emerald-500" />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white">{label}</span>
            {market.city && <span className="text-[10px] text-zinc-500 font-mono bg-zinc-800 px-1.5 py-0.5 rounded">City-Level</span>}
            {market.isEnabled ? (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">● LIVE</span>
            ) : market.isComingSoon ? (
              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 inline" /> COMING SOON
              </span>
            ) : (
              <span className="text-[10px] font-bold text-zinc-500 bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 rounded">DISABLED</span>
            )}
            {market.biometricProhibited && (
              <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                <Fingerprint className="w-2.5 h-2.5 inline" /> BIOMETRIC PROHIBITED
              </span>
            )}
          </div>

          {/* AI Law Badges */}
          {activeLaws.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {activeLaws.map((law) => (
                <span key={law.key as string}
                  title={typeof market[law.refKey] === "string" && market[law.refKey] ? (market[law.refKey] as string) : law.label}
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border cursor-help ${law.color}`}>
                  <law.icon className="w-2.5 h-2.5" />
                  {law.label}
                </span>
              ))}
            </div>
          )}

          {/* Privacy Framework Pills */}
          {activePrivacy.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {activePrivacy.map((p) => (
                <span key={p.key} title={p.title}
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border cursor-help ${p.color}`}>
                  {p.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Feature Toggles */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-col items-center gap-1" title="AI Interviews Allowed">
            <Bot className="w-3 h-3 text-zinc-600" />
            <MiniToggle enabled={market.aiInterviewsAllowed} onClick={() => update("aiInterviewsAllowed", !market.aiInterviewsAllowed)} disabled={isPending} color="bg-violet-500" />
          </div>
          <div className="flex flex-col items-center gap-1" title="BGV Allowed">
            <Shield className="w-3 h-3 text-zinc-600" />
            <MiniToggle enabled={market.bgvAllowed} onClick={() => update("bgvAllowed", !market.bgvAllowed)} disabled={isPending} color="bg-blue-500" />
          </div>
          <div className="flex flex-col items-center gap-1" title="Video Recording Allowed">
            <Video className="w-3 h-3 text-zinc-600" />
            <MiniToggle enabled={market.videoRecordingAllowed} onClick={() => update("videoRecordingAllowed", !market.videoRecordingAllowed)} disabled={isPending} color="bg-pink-500" />
          </div>
          {market.notes && (
            <button onClick={() => setShowNotes((p) => !p)} className="text-amber-400 hover:text-amber-300 transition-colors ml-1" title="View legal notes">
              <Info className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expandable Legal Notes */}
      {showNotes && market.notes && (
        <div className="px-5 pb-4">
          <div className="bg-amber-950/30 border border-amber-500/20 rounded-xl p-4 space-y-1">
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Scale className="w-3 h-3" /> Legal Annotation
            </p>
            <p className="text-xs text-amber-200/80 leading-relaxed">{market.notes}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CountryCard({ countryCode, markets, isPending, startTransition }: { countryCode: string; markets: GeoMarket[]; isPending: boolean; startTransition: any }) {
  const [expanded, setExpanded] = useState(true);
  const meta = COUNTRY_META[countryCode] ?? { flag: "🌍", accent: "text-zinc-400", bg: "from-zinc-800/40 to-zinc-900/20", border: "border-zinc-700/30" };
  const enabledCount = markets.filter((m) => m.isEnabled).length;
  const countryName = markets[0]?.countryName ?? countryCode;
  const hasHighRisk = markets.some((m) => m.aiAuditRequired || m.aiVideoConsentRequired || m.facialRecogConsentRequired);
  const aiLawCount = markets.reduce((n, m) => n + AI_LAW_TAGS.filter((t) => m[t.key] as boolean).length, 0);

  return (
    <div className={`rounded-2xl border ${meta.border} bg-gradient-to-br ${meta.bg} overflow-hidden shadow-xl`}>
      <button onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/[0.03] transition-colors text-left">
        <div className="flex items-center gap-4">
          <span className="text-4xl">{meta.flag}</span>
          <div>
            <h3 className={`text-lg font-black ${meta.accent}`}>{countryName}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-zinc-400">{enabledCount}/{markets.length} regions live</span>
              {aiLawCount > 0 && (
                <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Scale className="w-2.5 h-2.5" /> {aiLawCount} AI law{aiLawCount > 1 ? "s" : ""}
                </span>
              )}
              {hasHighRisk && (
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" /> High-risk rules
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {enabledCount === markets.length ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            : enabledCount === 0 ? <XCircle className="w-5 h-5 text-zinc-600" />
            : <AlertTriangle className="w-5 h-5 text-amber-400" />}
          {expanded ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
        </div>
      </button>

      {expanded && (
        <div>
          <div className="flex items-center gap-4 px-5 py-2 border-t border-white/5 bg-black/20 flex-wrap gap-y-1">
            <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">Controls →</span>
            <span className="flex items-center gap-1 text-[10px] text-zinc-500"><Bot className="w-3 h-3" /> AI Interview</span>
            <span className="flex items-center gap-1 text-[10px] text-zinc-500"><Shield className="w-3 h-3" /> BGV</span>
            <span className="flex items-center gap-1 text-[10px] text-zinc-500"><Video className="w-3 h-3" /> Video</span>
          </div>
          <div className="border-t border-white/5">
            {markets.map((m) => (
              <RegionRow key={m.id} market={m} isPending={isPending} startTransition={startTransition} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ComplianceMatrix({ markets }: { markets: GeoMarket[] }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl overflow-hidden">
      <div className="p-5 border-b border-zinc-800">
        <h2 className="text-base font-bold text-white">Full Compliance & AI Law Matrix</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Comprehensive cross-reference of all privacy frameworks and AI-specific hiring laws per jurisdiction</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950/50">
              <th className="text-left px-4 py-3 text-zinc-500 font-bold uppercase tracking-wider min-w-[180px]">Jurisdiction</th>
              <th className="text-center px-2 py-3 text-zinc-500 font-bold uppercase tracking-wider">Status</th>
              <th className="text-center px-2 py-3 text-rose-400 font-bold uppercase tracking-wider" title="NYC Local Law 144 — Annual bias audit required">Bias Audit</th>
              <th className="text-center px-2 py-3 text-amber-400 font-bold uppercase tracking-wider" title="AI Video Consent (Illinois AIVIA)">AI Video</th>
              <th className="text-center px-2 py-3 text-violet-400 font-bold uppercase tracking-wider" title="Right to human review of automated decisions">Human Review</th>
              <th className="text-center px-2 py-3 text-sky-400 font-bold uppercase tracking-wider" title="Must disclose AI usage to candidates">AI Disclosure</th>
              <th className="text-center px-2 py-3 text-red-400 font-bold uppercase tracking-wider" title="Facial recognition consent required">Face Rec</th>
              <th className="text-center px-2 py-3 text-teal-400 font-bold uppercase tracking-wider" title="Algorithmic transparency requirements">Algo Trans.</th>
              <th className="text-center px-2 py-3 text-blue-400 font-bold uppercase tracking-wider">GDPR</th>
              <th className="text-center px-2 py-3 text-purple-400 font-bold uppercase tracking-wider">CCPA</th>
              <th className="text-center px-2 py-3 text-orange-400 font-bold uppercase tracking-wider">DPDP</th>
              <th className="text-center px-2 py-3 text-green-400 font-bold uppercase tracking-wider">EEOC</th>
              <th className="text-center px-2 py-3 text-pink-400 font-bold uppercase tracking-wider" title="Biometric data collection prohibited">Biometric</th>
              <th className="text-center px-2 py-3 text-emerald-400 font-bold uppercase tracking-wider" title="AI Interviews allowed in this jurisdiction">AI Intv.</th>
            </tr>
          </thead>
          <tbody>
            {markets.map((m) => {
              const meta = COUNTRY_META[m.countryCode];
              return (
                <tr key={m.id} className="border-b border-zinc-800/40 hover:bg-zinc-900/40 transition-colors">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{meta?.flag}</span>
                      <div>
                        <span className="text-white font-medium">{m.region || m.countryName}</span>
                        {m.city && <span className="block text-[10px] text-zinc-500">{m.city}</span>}
                      </div>
                    </div>
                  </td>
                  <td className="text-center px-2 py-2.5">
                    <span className={`inline-block w-2 h-2 rounded-full ${m.isEnabled ? "bg-emerald-400 shadow-sm shadow-emerald-400/60" : m.isComingSoon ? "bg-amber-400" : "bg-zinc-600"}`} />
                  </td>
                  {[
                    { v: m.aiAuditRequired, color: "text-rose-400" },
                    { v: m.aiVideoConsentRequired, color: "text-amber-400" },
                    { v: m.automatedDecisionReview, color: "text-violet-400" },
                    { v: m.aiDisclosureRequired, color: "text-sky-400" },
                    { v: m.facialRecogConsentRequired, color: "text-red-400" },
                    { v: m.algorithmicTransparency, color: "text-teal-400" },
                    { v: m.gdprApplies, color: "text-blue-400" },
                    { v: m.ccpaApplies, color: "text-purple-400" },
                    { v: m.pdpaApplies, color: "text-orange-400" },
                    { v: m.eeocApplies, color: "text-green-400" },
                    { v: m.biometricProhibited, color: "text-rose-400" },
                    { v: m.aiInterviewsAllowed, color: "text-emerald-400" },
                  ].map((c, i) => (
                    <td key={i} className="text-center px-2 py-2.5">
                      {c.v ? <CheckCircle2 className={`w-3.5 h-3.5 mx-auto ${c.color}`} />
                           : <span className="text-zinc-800">—</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function GeoComplianceClient({ markets }: { markets: GeoMarket[] }) {
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const filtered = markets.filter((m) =>
    `${m.countryName} ${m.region} ${m.city}`.toLowerCase().includes(search.toLowerCase())
  );

  const byCountry = filtered.reduce<Record<string, GeoMarket[]>>((acc, m) => {
    if (!acc[m.countryCode]) acc[m.countryCode] = [];
    acc[m.countryCode].push(m);
    return acc;
  }, {});

  const totalEnabled = markets.filter((m) => m.isEnabled).length;
  const highRisk = markets.filter((m) => m.aiAuditRequired || m.aiVideoConsentRequired || m.facialRecogConsentRequired).length;
  const aiLawsTotal = AI_LAW_TAGS.reduce((n, t) => n + markets.filter((m) => m[t.key] as boolean).length, 0);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Live Regions", value: totalEnabled, icon: Globe, color: "text-emerald-400", bg: "from-emerald-900/30" },
          { label: "Total Markets", value: markets.length, icon: Globe, color: "text-blue-400", bg: "from-blue-900/30" },
          { label: "AI Law Rules", value: aiLawsTotal, icon: Scale, color: "text-rose-400", bg: "from-rose-900/30" },
          { label: "High-Risk Regions", value: highRisk, icon: AlertTriangle, color: "text-amber-400", bg: "from-amber-900/30" },
        ].map((s) => (
          <div key={s.label} className={`bg-gradient-to-br ${s.bg} to-zinc-900 border border-zinc-800 rounded-xl p-4`}>
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <div className={`text-3xl font-black ${s.color}`}>{s.value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* AI Law Legend */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-3">AI Hiring Law Key</p>
        <div className="flex flex-wrap gap-2">
          {AI_LAW_TAGS.map((t) => (
            <span key={t.key as string} className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${t.color}`}>
              <t.icon className="w-3 h-3" /> {t.label}
              {t.severity === "high" && <span className="text-[8px] opacity-70 ml-0.5">⚠</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input type="text" placeholder="Search by country, state/province, or city..."
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors" />
        {isPending && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 animate-spin" />}
      </div>

      {/* Country Cards */}
      {Object.keys(byCountry).length === 0
        ? <div className="text-center py-16 text-zinc-600">No markets found.</div>
        : Object.keys(byCountry).map((code) => (
          <CountryCard key={code} countryCode={code} markets={byCountry[code]} isPending={isPending} startTransition={startTransition} />
        ))
      }

      {/* Full Matrix */}
      <ComplianceMatrix markets={markets} />
    </div>
  );
}
