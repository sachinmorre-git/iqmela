"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ArrowRight, Zap } from "lucide-react";

type Tier = {
  id:       string;
  name:     string;
  monthly:  number | null;   // null = custom
  annual:   number | null;
  badge?:   string;
  color:    string;
  border:   string;
  highlight: boolean;
  features: string[];
  cta:      string;
  ctaHref:  string;
};

const TIERS: Tier[] = [
  {
    id: "free", name: "Free", monthly: 0, annual: 0,
    color:  "text-zinc-300",
    border: "border-zinc-800",
    highlight: false,
    cta: "Get started free", ctaHref: "/sign-up",
    features: [
      "2 active positions",
      "Up to 5 interviews / month",
      "3 AI reports / month",
      "1 team member",
      "Community support",
    ],
  },
  {
    id: "plus", name: "Plus", monthly: 49, annual: 470,
    color:  "text-rose-300",
    border: "border-rose-500/30",
    highlight: false,
    cta: "Start Plus", ctaHref: "/sign-up?plan=plus",
    features: [
      "10 active positions",
      "25 interviews / month",
      "10 AI reports / month",
      "Up to 5 team members",
      "AI Prep Coach",
      "Interview pipeline",
      "Email support",
    ],
  },
  {
    id: "ultra", name: "Ultra", monthly: 500, annual: 4800,
    badge: "Most Popular",
    color:  "text-pink-300",
    border: "border-pink-500/40",
    highlight: true,
    cta: "Start Ultra", ctaHref: "/sign-up?plan=ultra",
    features: [
      "Unlimited positions",
      "Unlimited interviews",
      "Unlimited AI reports",
      "Up to 25 team members",
      "Behavioral intelligence",
      "Custom branding",
      "Vendor dispatch",
      "Priority support",
    ],
  },
  {
    id: "enterprise", name: "Enterprise", monthly: null, annual: null,
    color:  "text-amber-300",
    border: "border-amber-500/30",
    highlight: false,
    cta: "Contact us", ctaHref: "mailto:sales@iqmela.com",
    features: [
      "Everything in Ultra",
      "Unlimited team seats",
      "Dedicated CSM",
      "Custom SLA",
      "SSO / SAML",
      "Onboarding & training",
      "Data export & API access",
    ],
  },
];

function PriceDisplay({ tier, annual }: { tier: Tier; annual: boolean }) {
  if (tier.monthly === null) return (
    <div>
      <p className={`text-4xl font-black ${tier.color}`}>Custom</p>
      <p className="text-xs text-zinc-600 mt-1">Contact for pricing</p>
    </div>
  );
  if (tier.monthly === 0) return (
    <div>
      <p className={`text-4xl font-black ${tier.color}`}>$0</p>
      <p className="text-xs text-zinc-600 mt-1">Forever free</p>
    </div>
  );
  const price = annual && tier.annual ? tier.annual : (tier.monthly ?? 0) * 12;
  const perM  = annual && tier.annual ? Math.round(tier.annual / 12) : tier.monthly;
  return (
    <div>
      <div className="flex items-end gap-1">
        <p className={`text-4xl font-black ${tier.color}`}>${perM}</p>
        <p className="text-zinc-500 text-sm mb-1.5">/mo</p>
      </div>
      {annual && tier.annual && (
        <p className="text-[10px] text-zinc-600 mt-1">${price} billed annually</p>
      )}
    </div>
  );
}

export function PricingSection() {
  const [annual, setAnnual] = useState(false);

  return (
    <section className="py-24 px-4" id="pricing">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">Simple, transparent pricing</h2>
          <p className="text-zinc-500 text-lg mb-6">Start free. Scale as you hire.</p>

          {/* Monthly / Annual toggle */}
          <div className="inline-flex items-center gap-3 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
            <button
              onClick={() => setAnnual(false)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!annual ? "bg-zinc-700 text-white" : "text-zinc-500"}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${annual ? "bg-zinc-700 text-white" : "text-zinc-500"}`}
            >
              Annual
              <span className="text-[9px] font-black text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`relative flex flex-col rounded-3xl border p-6 transition-all ${tier.border} ${
                tier.highlight
                  ? "bg-gradient-to-b from-pink-950/60 to-zinc-950 shadow-xl shadow-pink-900/20"
                  : "bg-zinc-900/40"
              }`}
            >
              {/* Badge */}
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-pink-600 text-white text-[10px] font-black">
                    <Zap className="w-3 h-3" /> {tier.badge}
                  </div>
                </div>
              )}

              <div className="mb-5">
                <h3 className={`text-base font-black ${tier.color} mb-4`}>{tier.name}</h3>
                <PriceDisplay tier={tier} annual={annual} />
              </div>

              <ul className="space-y-2.5 flex-1 mb-6">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-zinc-400">
                    <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${tier.color}`} />
                    {f}
                  </li>
                ))}
              </ul>

              <Link href={tier.ctaHref}>
                <button className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                  tier.highlight
                    ? "bg-pink-600 hover:bg-pink-500 text-white shadow-lg shadow-pink-600/25"
                    : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700"
                }`}>
                  {tier.cta} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
