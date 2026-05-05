"use client";

import { useState, useTransition } from "react";
import {
  Shield, Zap, Building2, Users, Briefcase, Globe,
  FileText, ToggleLeft, ToggleRight, Search, AlertTriangle,
  Check, X, RotateCcw, Loader2, Share2, BadgeCheck, Gift
} from "lucide-react";
import { updatePlatformConfig, setOrgFeatureOverride, resetOrgFeatureOverride } from "./actions";

interface PlatformConfigData {
  aiPipelineEnabled: boolean;
  aiInterviewsEnabled: boolean;
  vendorDispatchEnabled: boolean;
  bgvEnabled: boolean;
  offersEnabled: boolean;
  jobDistributionEnabled: boolean;
  referralsEnabled: boolean;
  b2bReferralsEnabled: boolean;
  candidateReferralsEnabled: boolean;
  interviewerReferralsEnabled: boolean;
  jobBountyReferralsEnabled: boolean;
  referralRewardRules: any;
}

interface Org {
  id: string;
  planTier: string | null;
  domain: string | null;
}

interface Override {
  id: string;
  organizationId: string;
  featureKey: string;
  enabled: boolean;
  note: string | null;
  updatedAt: Date;
}

const FEATURES = [
  { key: "aiPipelineEnabled", featureKey: "AI_PIPELINE", label: "AI Pipeline", desc: "Resume extraction, ranking, and advanced judgment", icon: <Zap className="w-5 h-5" />, color: "text-rose-400", toggleColor: "bg-rose-500", glowColor: "shadow-rose-500/30" },
  { key: "aiInterviewsEnabled", featureKey: "AI_INTERVIEWS", label: "AI Interviews", desc: "Tavus-powered AI avatar interview sessions", icon: <Users className="w-5 h-5" />, color: "text-violet-400", toggleColor: "bg-violet-500", glowColor: "shadow-violet-500/30" },
  { key: "vendorDispatchEnabled", featureKey: "VENDOR_DISPATCH", label: "Vendor Dispatch", desc: "Dispatch positions to external vendor agencies", icon: <Building2 className="w-5 h-5" />, color: "text-blue-400", toggleColor: "bg-blue-500", glowColor: "shadow-blue-500/30" },
  { key: "bgvEnabled", featureKey: "BGV", label: "Background Verification", desc: "Checkr-powered background check integration", icon: <Shield className="w-5 h-5" />, color: "text-emerald-400", toggleColor: "bg-emerald-500", glowColor: "shadow-emerald-500/30" },
  { key: "offersEnabled", featureKey: "OFFERS", label: "Offer Management", desc: "Offer letter generation, DocuSign integration", icon: <FileText className="w-5 h-5" />, color: "text-amber-400", toggleColor: "bg-amber-500", glowColor: "shadow-amber-500/30" },
  { key: "jobDistributionEnabled", featureKey: "JOB_DISTRIBUTION", label: "Job Distribution", desc: "Indeed, Google Jobs, LinkedIn posting", icon: <Globe className="w-5 h-5" />, color: "text-cyan-400", toggleColor: "bg-cyan-500", glowColor: "shadow-cyan-500/30" },
  { key: "referralsEnabled", featureKey: "REFERRALS", label: "Master Referral Engine", desc: "Global kill-switch for all referral modules", icon: <Share2 className="w-5 h-5" />, color: "text-purple-400", toggleColor: "bg-purple-500", glowColor: "shadow-purple-500/30" },
  { key: "b2bReferralsEnabled", featureKey: "B2B_REFERRALS", label: "B2B Partner Referrals", desc: "Org Admins refer other Orgs", icon: <Building2 className="w-5 h-5" />, color: "text-indigo-400", toggleColor: "bg-indigo-500", glowColor: "shadow-indigo-500/30" },
  { key: "candidateReferralsEnabled", featureKey: "CANDIDATE_REFERRALS", label: "Candidate 'Trojan Horse'", desc: "Candidates refer their current HR teams", icon: <Users className="w-5 h-5" />, color: "text-pink-400", toggleColor: "bg-pink-500", glowColor: "shadow-pink-500/30" },
  { key: "interviewerReferralsEnabled", featureKey: "INTERVIEWER_REFERRALS", label: "Expert Peer Network", desc: "Interviewers refer other experts", icon: <BadgeCheck className="w-5 h-5" />, color: "text-sky-400", toggleColor: "bg-sky-500", glowColor: "shadow-sky-500/30" },
  { key: "jobBountyReferralsEnabled", featureKey: "JOB_BOUNTY", label: "Job Board Bounties", desc: "Automated candidate referral payouts", icon: <Gift className="w-5 h-5" />, color: "text-teal-400", toggleColor: "bg-teal-500", glowColor: "shadow-teal-500/30" },
];

function PremiumToggle({ enabled, onClick, disabled, activeColor = "bg-green-500", glowColor = "shadow-green-500/30" }: { enabled: boolean, onClick: () => void, disabled: boolean, activeColor?: string, glowColor?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      type="button"
      className={`relative inline-flex h-7 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-all duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 disabled:opacity-50 disabled:cursor-not-allowed ${
        enabled ? `${activeColor} ${glowColor} shadow-lg` : 'bg-zinc-800 shadow-inner'
      }`}
    >
      <span className="sr-only">Toggle feature</span>
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition-all duration-300 ease-in-out ${
          enabled ? 'translate-x-7 scale-100' : 'translate-x-0 scale-90 opacity-70'
        }`}
      />
    </button>
  );
}

export function ConfigClient({
  config,
  orgs,
  overrides: initialOverrides,
}: {
  config: PlatformConfigData;
  orgs: Org[];
  overrides: Override[];
}) {
  const [localConfig, setLocalConfig] = useState(config);
  const [isPending, startTransition] = useTransition();
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [orgSearch, setOrgSearch] = useState("");
  const [overrides, setOverrides] = useState(initialOverrides);

  // For the JSON Editor
  const defaultRules = [
    { type: "CANDIDATE", amount: 500, currency: "USD", rewardType: "AMAZON_GC", country: "GLOBAL" },
    { type: "B2B", amount: 1000, currency: "USD", rewardType: "CREDITS", country: "GLOBAL" },
    { type: "INTERVIEWER", amount: 100, currency: "USD", rewardType: "CASH", country: "GLOBAL" },
    { type: "JOB_BOUNTY", amount: 2000, currency: "USD", rewardType: "CASH", country: "GLOBAL" },
  ];
  const [rulesJson, setRulesJson] = useState<string>(
    JSON.stringify(config.referralRewardRules || defaultRules, null, 2)
  );

  const handleGlobalToggle = (key: string, value: boolean) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
    startTransition(async () => {
      await updatePlatformConfig({ [key]: value } as any);
    });
  };

  const handleRulesSave = () => {
    try {
      const parsed = JSON.parse(rulesJson);
      setLocalConfig((prev) => ({ ...prev, referralRewardRules: parsed }));
      startTransition(async () => {
        await updatePlatformConfig({ referralRewardRules: parsed } as any);
      });
      alert("Reward rules updated successfully!");
    } catch (e: any) {
      alert("Invalid JSON: " + e.message);
    }
  };

  const handleOrgOverride = (featureKey: string, enabled: boolean) => {
    if (!selectedOrg) return;
    startTransition(async () => {
      await setOrgFeatureOverride(selectedOrg, featureKey, enabled);
      // Optimistic update
      setOverrides((prev) => {
        const existing = prev.findIndex(
          (o) => o.organizationId === selectedOrg && o.featureKey === featureKey
        );
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = { ...updated[existing], enabled };
          return updated;
        }
        return [...prev, { id: "temp", organizationId: selectedOrg, featureKey, enabled, note: null, updatedAt: new Date() }];
      });
    });
  };

  const handleResetOverride = (featureKey: string) => {
    if (!selectedOrg) return;
    startTransition(async () => {
      await resetOrgFeatureOverride(selectedOrg, featureKey);
      setOverrides((prev) =>
        prev.filter((o) => !(o.organizationId === selectedOrg && o.featureKey === featureKey))
      );
    });
  };

  const filteredOrgs = orgs.filter(
    (o) =>
      o.id.toLowerCase().includes(orgSearch.toLowerCase()) ||
      (o.domain || "").toLowerCase().includes(orgSearch.toLowerCase())
  );

  const selectedOrgOverrides = overrides.filter((o) => o.organizationId === selectedOrg);
  const selectedOrgData = orgs.find((o) => o.id === selectedOrg);

  return (
    <div className="space-y-8">
      {/* ── Section A: Global Kill Switches ── */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-600 to-pink-600 flex items-center justify-center shadow-lg shadow-rose-500/20">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Global Feature Switches</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Turning OFF a feature here disables it <strong className="text-rose-400">platform-wide for ALL clients</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="divide-y divide-zinc-800/60">
          {FEATURES.map((f) => {
            const enabled = (localConfig as any)[f.key] as boolean;
            return (
              <div key={f.key} className="flex items-center justify-between px-6 py-4 hover:bg-zinc-800/20 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`${f.color}`}>{f.icon}</div>
                  <div>
                    <p className="text-sm font-semibold text-white">{f.label}</p>
                    <p className="text-xs text-zinc-500">{f.desc}</p>
                  </div>
                </div>
                <PremiumToggle 
                  enabled={enabled} 
                  onClick={() => handleGlobalToggle(f.key, !enabled)} 
                  disabled={isPending}
                  activeColor={f.toggleColor}
                  glowColor={f.glowColor}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section B: Per-Client Feature Overrides ── */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Per-Client Feature Overrides</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Override the plan-default for individual clients. Select an organization to manage.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Org Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search organization by ID or domain..."
              value={orgSearch}
              onChange={(e) => setOrgSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-700 bg-zinc-800/60 text-sm text-white placeholder:text-zinc-600 outline-none focus:ring-2 focus:ring-violet-500/30 transition-shadow"
            />
          </div>

          {/* Org Selector */}
          <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto">
            {filteredOrgs.map((org) => (
              <button
                key={org.id}
                onClick={() => setSelectedOrg(org.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  selectedOrg === org.id
                    ? "border-violet-500/50 bg-violet-500/10 text-violet-300"
                    : "border-zinc-700 bg-zinc-800/40 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                }`}
              >
                <span className="font-mono">{org.id.slice(0, 16)}…</span>
                {org.domain && <span className="ml-1.5 text-zinc-500">· {org.domain}</span>}
                {org.planTier && (
                  <span className="ml-1.5 text-rose-400 font-bold text-[10px] uppercase">{org.planTier}</span>
                )}
              </button>
            ))}
          </div>

          {/* Selected Org Feature Grid */}
          {selectedOrg && (
            <div className="mt-4 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-5 py-3 bg-zinc-900/80 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-white">
                    {selectedOrgData?.domain || selectedOrg.slice(0, 24)}
                  </p>
                  <p className="text-[10px] text-zinc-500 font-mono">{selectedOrg}</p>
                </div>
                {selectedOrgData?.planTier && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                    {selectedOrgData.planTier}
                  </span>
                )}
              </div>

              <div className="divide-y divide-zinc-800/60">
                {FEATURES.map((f) => {
                  const override = selectedOrgOverrides.find((o) => o.featureKey === f.featureKey);
                  const globalEnabled = (localConfig as any)[f.key] as boolean;
                  const effectiveEnabled = override ? override.enabled : globalEnabled;
                  const isOverridden = !!override;

                  return (
                    <div key={f.featureKey} className="flex items-center justify-between px-5 py-3 hover:bg-zinc-800/20 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`${f.color} opacity-70`}>{f.icon}</div>
                        <div>
                          <p className="text-sm font-medium text-white">{f.label}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {isOverridden ? (
                              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                                OVERRIDDEN
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">
                                Plan Default
                              </span>
                            )}
                            <span className={`text-[10px] font-bold ${effectiveEnabled ? "text-green-500" : "text-red-500"}`}>
                              {effectiveEnabled ? "ON" : "OFF"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <PremiumToggle 
                          enabled={effectiveEnabled} 
                          onClick={() => handleOrgOverride(f.featureKey, !effectiveEnabled)} 
                          disabled={isPending}
                          activeColor={f.toggleColor}
                          glowColor={f.glowColor}
                        />

                        {isOverridden && (
                          <button
                            onClick={() => handleResetOverride(f.featureKey)}
                            disabled={isPending}
                            className="p-1.5 rounded-lg text-zinc-600 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                            title="Reset to plan default"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Section C: Referral Reward Matrix ── */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Dynamic Reward Rules (JSON)</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Configure global and geo-specific reward amounts for all referral modules.
              </p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <p className="text-xs text-zinc-400 mb-4">
            Use this editor to dynamically alter payout values for different countries, domains, or job segments without needing a code deployment.
          </p>
          <textarea
            value={rulesJson}
            onChange={(e) => setRulesJson(e.target.value)}
            className="w-full h-64 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs font-mono text-zinc-300 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
            spellCheck={false}
          />
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleRulesSave}
              disabled={isPending}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Configuration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
