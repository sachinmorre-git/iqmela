"use client";

import { useState, useEffect, useTransition } from "react";
import {
  fetchBlockedCountries,
  addGeoBlock,
  addDefaultGeoBlocks,
  removeGeoBlock,
  getCountryList,
} from "./geo-actions";
import {
  Globe,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Trash2,
  AlertTriangle,
  MapPin,
  Zap,
  Search,
} from "lucide-react";

type BlockedCountry = {
  id: string;
  countryCode: string;
  countryName: string;
  reason: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
};

type CountryOption = {
  code: string;
  name: string;
  region: string;
};

// ── Region flag emoji helper ─────────────────────────────────────────────────

function countryFlag(code: string): string {
  try {
    const codePoints = code
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return "🏴";
  }
}

const REGION_COLORS: Record<string, string> = {
  Asia: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "Middle East": "bg-amber-500/10 text-amber-400 border-amber-500/20",
  Africa: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  Europe: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  Americas: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

export default function GeoBlockingClient() {
  const [blockedCountries, setBlockedCountries] = useState<BlockedCountry[]>([]);
  const [countryList, setCountryList] = useState<CountryOption[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const refresh = () => {
    startTransition(async () => {
      const [blocked, countries] = await Promise.all([
        fetchBlockedCountries(),
        getCountryList(),
      ]);
      setBlockedCountries(blocked);
      setCountryList(countries);
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleAdd = (code: string, name: string) => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("countryCode", code);
      fd.set("reason", "Blocked by admin");
      const result = await addGeoBlock(fd);
      if ("error" in result) {
        setError(result.error ?? "Failed");
      } else {
        setSuccess(`${name} added to blocklist`);
        setTimeout(() => setSuccess(null), 3000);
        refresh();
      }
    });
  };

  const handleRemove = (code: string, name: string) => {
    startTransition(async () => {
      const result = await removeGeoBlock(code);
      if ("error" in result) {
        setError(result.error ?? "Failed");
      } else {
        setSuccess(`${name} removed from blocklist`);
        setTimeout(() => setSuccess(null), 3000);
        refresh();
      }
    });
  };

  const handleAddDefaults = () => {
    startTransition(async () => {
      const result = await addDefaultGeoBlocks();
      if ("error" in result) {
        setError(String((result as any).error) || "Failed");
      } else {
        setSuccess(`${result.count} sanctioned nations added to blocklist`);
        setTimeout(() => setSuccess(null), 4000);
        refresh();
      }
    });
  };

  const blockedCodes = new Set(blockedCountries.map((c) => c.countryCode));

  // Filter available countries for adding
  const filteredCountries = countryList.filter(
    (c) =>
      !blockedCodes.has(c.code) &&
      (search === "" ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.region.toLowerCase().includes(search.toLowerCase()))
  );

  // Group available countries by region
  const byRegion = filteredCountries.reduce(
    (acc, c) => {
      if (!acc[c.region]) acc[c.region] = [];
      acc[c.region].push(c);
      return acc;
    },
    {} as Record<string, CountryOption[]>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20">
            <Globe className="w-7 h-7 text-rose-400" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white">Geo-Blocking</h1>
            <p className="text-sm text-zinc-500">
              Block access from high-risk countries. Changes apply within 5 minutes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {blockedCountries.length === 0 && (
            <button
              onClick={handleAddDefaults}
              disabled={isPending}
              className="px-4 py-2.5 text-sm font-bold bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Zap className="w-4 h-4" /> Add Sanctioned Nations
            </button>
          )}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2.5 text-sm font-bold bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Add Country
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-400">
            ✕
          </button>
        </div>
      )}
      {success && (
        <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> {success}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
          <div className="text-3xl font-black text-rose-400">{blockedCountries.length}</div>
          <div className="text-xs text-zinc-500 font-medium mt-1">Countries Blocked</div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
          <div className="text-3xl font-black text-emerald-400">
            {countryList.length - blockedCountries.length}
          </div>
          <div className="text-xs text-zinc-500 font-medium mt-1">Countries Allowed</div>
        </div>
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4">
          <div className="text-3xl font-black text-amber-400">
            {blockedCountries.filter(
              (c) => ["KP", "IR", "CU", "SY", "RU"].includes(c.countryCode)
            ).length}
            /5
          </div>
          <div className="text-xs text-zinc-500 font-medium mt-1">OFAC Sanctioned</div>
        </div>
      </div>

      {/* Currently Blocked Countries */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          Currently Blocked ({blockedCountries.length})
        </h3>

        {blockedCountries.length === 0 ? (
          <div className="text-center py-12 text-zinc-600 bg-zinc-900/40 border border-zinc-800 rounded-2xl">
            <Globe className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No countries blocked yet</p>
            <p className="text-xs text-zinc-700 mt-1">
              Click &quot;Add Sanctioned Nations&quot; to auto-populate the OFAC list
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {blockedCountries.map((country) => (
              <div
                key={country.id}
                className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/15 rounded-2xl group hover:border-red-500/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{countryFlag(country.countryCode)}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{country.countryName}</span>
                      <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded">
                        {country.countryCode}
                      </span>
                    </div>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{country.reason}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(country.countryCode, country.countryName)}
                  disabled={isPending}
                  className="p-2 rounded-lg bg-zinc-800 hover:bg-red-600/30 text-zinc-500 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  title="Remove from blocklist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Country Panel */}
      {showAddForm && (
        <div className="bg-zinc-900/80 border border-rose-500/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-rose-400" /> Add Country to Blocklist
            </h3>
            <button
              onClick={() => setShowAddForm(false)}
              className="text-zinc-500 hover:text-white text-xl"
            >
              ✕
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by country name, code, or region..."
              className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-rose-500/50"
            />
          </div>

          {/* Country Grid */}
          <div className="max-h-[400px] overflow-y-auto space-y-4 pr-2">
            {Object.entries(byRegion).map(([region, countries]) => (
              <div key={region}>
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2 flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] border ${REGION_COLORS[region] || "bg-zinc-800 text-zinc-400 border-zinc-700"}`}
                  >
                    {region}
                  </span>
                  <span className="text-zinc-700">{countries.length} available</span>
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {countries.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => handleAdd(c.code, c.name)}
                      disabled={isPending}
                      className="flex items-center gap-2.5 p-3 bg-zinc-800/60 border border-zinc-700/50 rounded-xl hover:bg-rose-600/10 hover:border-rose-500/30 transition-all text-left disabled:opacity-50 group"
                    >
                      <span className="text-lg">{countryFlag(c.code)}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-zinc-300 group-hover:text-white truncate">
                          {c.name}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-600">{c.code}</div>
                      </div>
                      <Plus className="w-3.5 h-3.5 text-zinc-600 group-hover:text-rose-400 ml-auto flex-shrink-0 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {filteredCountries.length === 0 && (
              <div className="text-center py-8 text-zinc-600">
                <p className="text-sm font-medium">
                  {search ? "No matching countries found" : "All listed countries are already blocked"}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 text-xs text-zinc-500 space-y-1">
        <p className="font-bold text-zinc-400">How it works</p>
        <p>
          • Vercel provides the visitor&apos;s country via the{" "}
          <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">x-vercel-ip-country</code>{" "}
          header on every request.
        </p>
        <p>• Blocked countries are checked in our middleware before any page or API loads.</p>
        <p>
          • Changes sync to all server instances within 5 minutes (or immediately on the next deployment).
        </p>
        <p>
          • Visitors from blocked countries see a generic &quot;Service not available in your region&quot;
          message.
        </p>
      </div>
    </div>
  );
}
