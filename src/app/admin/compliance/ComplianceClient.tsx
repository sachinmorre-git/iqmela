"use client";

import { useState, useTransition } from "react";
import {
  Shield, Plus, Trash2, ToggleLeft, ToggleRight,
  MapPin, Globe, Loader2, Check, ChevronDown,
} from "lucide-react";
import {
  createComplianceRule,
  updateComplianceRule,
  deleteComplianceRule,
  updateBgvRoutingConfig
} from "./actions";

const BGV_VENDORS = [
  { value: "CHECKR", label: "Checkr", desc: "US & Canada primary integration", emoji: "🇺🇸" },
  { value: "CERTN", label: "Certn", desc: "Global identity & background checks", emoji: "🌍" },
  { value: "MANUAL", label: "Manual Processing", desc: "Recruiter manually uploads reports", emoji: "📋" },
  { value: "CANDIDATE_VENDOR", label: "Candidate's Vendor", desc: "Agency handles BGV externally", emoji: "🏢" }
];

const TARGET_REGIONS = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "UK", name: "United Kingdom" },
  { code: "IN", name: "India" },
  { code: "EU", name: "European Union" },
  { code: "GLOBAL", name: "Rest of World" }
];

const RULE_TYPES = [
  { value: "SALARY_TRANSPARENCY", label: "Salary Transparency", color: "text-emerald-400" },
  { value: "BAN_THE_BOX", label: "Ban-the-Box", color: "text-blue-400" },
  { value: "EEOC", label: "EEOC Reporting", color: "text-violet-400" },
  { value: "RIGHT_TO_WORK", label: "Right to Work", color: "text-amber-400" },
  { value: "DATA_PRIVACY", label: "Data Privacy", color: "text-rose-400" },
  { value: "CUSTOM", label: "Custom Rule", color: "text-zinc-400" },
];

interface Rule {
  id: string;
  country: string;
  state: string | null;
  city: string | null;
  ruleType: string;
  ruleKey: string;
  ruleValue: any;
  description: string;
  isActive: boolean;
  isAutoApplied: boolean;
}

export function ComplianceClient({ initialRules, config }: { initialRules: Rule[], config?: any }) {
  const [rules, setRules] = useState(initialRules);
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [localRouting, setLocalRouting] = useState<Record<string, string>>(config?.bgvVendorRouting || {});

  // New rule form state
  const [newRule, setNewRule] = useState({
    country: "US",
    state: "",
    city: "",
    ruleType: "SALARY_TRANSPARENCY",
    ruleKey: "",
    description: "",
    isAutoApplied: true,
    ruleValue: "{}",
  });

  const handleCreateRule = () => {
    startTransition(async () => {
      try {
        const created = await createComplianceRule({
          country: newRule.country,
          state: newRule.state || undefined,
          city: newRule.city || undefined,
          ruleType: newRule.ruleType,
          ruleKey: newRule.ruleKey,
          ruleValue: JSON.parse(newRule.ruleValue || "{}"),
          description: newRule.description,
          isAutoApplied: newRule.isAutoApplied,
        });
        setRules((prev) => [...prev, created as unknown as Rule]);
        setShowForm(false);
        setNewRule({ country: "US", state: "", city: "", ruleType: "SALARY_TRANSPARENCY", ruleKey: "", description: "", isAutoApplied: true, ruleValue: "{}" });
      } catch (err) {
        console.error("Failed to create rule:", err);
      }
    });
  };

  const handleToggle = (id: string, isActive: boolean) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, isActive } : r)));
    startTransition(async () => {
      await updateComplianceRule(id, { isActive });
    });
  };

  const handleDelete = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      await deleteComplianceRule(id);
    });
  };

  const ruleColor = (type: string) =>
    RULE_TYPES.find((t) => t.value === type)?.color || "text-zinc-400";

  const handleRoutingChange = (countryCode: string, vendor: string) => {
    setLocalRouting((prev) => ({ ...prev, [countryCode]: vendor }));
    startTransition(async () => {
      await updateBgvRoutingConfig(countryCode, vendor);
      setSavedKey(countryCode);
      setTimeout(() => setSavedKey(null), 1500);
    });
  };

  return (
    <div className="space-y-8">
      {/* ── BGV Vendor Routing Panel ── */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">BGV Vendor Geo-Routing</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Route background checks to specific vendors based on candidate location</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
          {TARGET_REGIONS.map((region) => {
            const currentVendor = localRouting[region.code] || "MANUAL";
            return (
              <div
                key={region.code}
                className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-4 transition-all hover:border-indigo-500/30"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700 font-bold text-xs text-zinc-300">
                    {region.code}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{region.name}</p>
                    <p className="text-[10px] text-zinc-500">Region routing</p>
                  </div>
                  {savedKey === region.code && (
                    <Check className="w-4 h-4 text-green-500 ml-auto animate-in fade-in" />
                  )}
                </div>

                <div className="space-y-1.5">
                  {BGV_VENDORS.map((v) => (
                    <button
                      key={v.value}
                      onClick={() => handleRoutingChange(region.code, v.value)}
                      disabled={isPending}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                        currentVendor === v.value
                          ? "border-indigo-500/40 bg-indigo-500/10 text-indigo-300"
                          : "border-transparent bg-zinc-900/40 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
                      }`}
                    >
                      <span className="text-sm">{v.emoji}</span>
                      <span className="flex-1 text-left">{v.label}</span>
                      {currentVendor === v.value && (
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Rules Table ── */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Active Compliance Rules</h2>
              <p className="text-xs text-zinc-500 mt-0.5">{rules.length} rules configured</p>
            </div>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        </div>

        {rules.length === 0 ? (
          <div className="p-12 text-center text-zinc-600">
            <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No compliance rules configured yet.</p>
            <p className="text-xs text-zinc-700 mt-1">Click "Add Rule" to create your first compliance rule.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-5 py-3 font-semibold">Location</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Rule Key</th>
                  <th className="px-4 py-3 font-semibold">Description</th>
                  <th className="px-4 py-3 font-semibold text-center">Auto</th>
                  <th className="px-4 py-3 font-semibold text-center">Active</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-zinc-800/20 transition-colors text-zinc-300">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3 h-3 text-zinc-600" />
                        <span className="font-medium text-white">{rule.country}</span>
                        {rule.state && <span className="text-zinc-500">· {rule.state}</span>}
                        {rule.city && <span className="text-zinc-600">· {rule.city}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold uppercase tracking-wider ${ruleColor(rule.ruleType)}`}>
                        {rule.ruleType.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">{rule.ruleKey}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400 max-w-[250px] truncate">{rule.description}</td>
                    <td className="px-4 py-3 text-center">
                      {rule.isAutoApplied ? (
                        <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">AUTO</span>
                      ) : (
                        <span className="text-[10px] font-bold text-zinc-600 bg-zinc-800 px-1.5 py-0.5 rounded">MANUAL</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => handleToggle(rule.id, !rule.isActive)}>
                        {rule.isActive ? (
                          <ToggleRight className="w-7 h-7 text-green-500" />
                        ) : (
                          <ToggleLeft className="w-7 h-7 text-zinc-600" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="p-1.5 rounded-lg text-zinc-600 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Add Rule Form ── */}
      {showForm && (
        <div className="bg-zinc-900/50 border border-emerald-500/20 rounded-xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />
            New Compliance Rule
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Country</label>
              <input
                value={newRule.country}
                onChange={(e) => setNewRule((p) => ({ ...p, country: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800/60 text-sm text-white outline-none focus:ring-1 focus:ring-emerald-500/30"
                placeholder="US"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">State (optional)</label>
              <input
                value={newRule.state}
                onChange={(e) => setNewRule((p) => ({ ...p, state: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800/60 text-sm text-white outline-none focus:ring-1 focus:ring-emerald-500/30"
                placeholder="CA"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">City (optional)</label>
              <input
                value={newRule.city}
                onChange={(e) => setNewRule((p) => ({ ...p, city: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800/60 text-sm text-white outline-none focus:ring-1 focus:ring-emerald-500/30"
                placeholder="San Francisco"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Rule Type</label>
              <select
                value={newRule.ruleType}
                onChange={(e) => setNewRule((p) => ({ ...p, ruleType: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800/60 text-sm text-white outline-none"
              >
                {RULE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Rule Key (machine-readable)</label>
              <input
                value={newRule.ruleKey}
                onChange={(e) => setNewRule((p) => ({ ...p, ruleKey: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800/60 text-sm text-white outline-none focus:ring-1 focus:ring-emerald-500/30"
                placeholder="ca_salary_transparency_2024"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">Description</label>
            <textarea
              value={newRule.description}
              onChange={(e) => setNewRule((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800/60 text-sm text-white outline-none focus:ring-1 focus:ring-emerald-500/30 resize-none"
              placeholder="California SB 1162 requires all job postings to include salary ranges..."
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-500 mb-1">Rule Config (JSON)</label>
            <textarea
              value={newRule.ruleValue}
              onChange={(e) => setNewRule((p) => ({ ...p, ruleValue: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800/60 text-xs text-indigo-300 font-mono outline-none focus:ring-1 focus:ring-emerald-500/30 resize-none"
              placeholder='{"requireSalaryRange": true, "effectiveDate": "2024-01-01"}'
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={newRule.isAutoApplied}
                onChange={(e) => setNewRule((p) => ({ ...p, isAutoApplied: e.target.checked }))}
                className="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/30"
              />
              Auto-apply based on position location
            </label>

            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRule}
                disabled={isPending || !newRule.ruleKey || !newRule.description}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-40 transition-colors"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Create Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
