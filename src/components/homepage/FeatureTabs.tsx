"use client";

import { useState } from "react";
import { Brain, Users, CheckCircle, BarChart3, Shield, Zap, Clock, Star } from "lucide-react";

const TABS = [
  {
    id:       "hiring",
    label:    "For Hiring Teams",
    tagline:  "Make every hire with data, not gut feel",
    features: [
      { icon: Brain,       title: "AI-Generated Scorecards",        desc: "Automatic structured evaluations after every interview round." },
      { icon: BarChart3,   title: "Pipeline Analytics",             desc: "Drop-off rates, time-to-offer, and quality-of-hire at a glance." },
      { icon: Users,       title: "Multi-Panel Coordination",       desc: "Assign multiple interviewers, collect independent scores." },
      { icon: Shield,      title: "Bias Reduction",                 desc: "Structured questions ensure every candidate is evaluated equally." },
    ],
  },
  {
    id:       "interviewers",
    label:    "For Interviewers",
    tagline:  "Run better interviews in less time",
    features: [
      { icon: CheckCircle, title: "AI Prep Briefs",                 desc: "Auto-generated candidate summaries and suggested questions before each interview." },
      { icon: Clock,       title: "30-Second Feedback",             desc: "Inline scorecard submission — no separate system to open." },
      { icon: BarChart3,   title: "Personal Performance Insights",  desc: "Track your on-time feedback rate, scoring patterns, and activity." },
      { icon: Zap,         title: "Live Signal Monitoring",         desc: "Real-time behavioral signals during the interview to guide your questions." },
    ],
  },
  {
    id:       "candidates",
    label:    "For Candidates",
    tagline:  "Walk in prepared, walk out confident",
    features: [
      { icon: Brain,       title: "AI Prep Coach",                  desc: "5 tailored prep questions generated from the actual JD. Get scored on your answers." },
      { icon: Shield,      title: "Tech Pre-Flight Check",          desc: "Camera, mic, and connection verified before you join." },
      { icon: Star,        title: "Fair & Structured Process",      desc: "Standardised evaluation means you're judged on merit, not impression." },
      { icon: Clock,       title: "Round-by-Round Tracker",         desc: "See exactly where you are in the pipeline at all times." },
    ],
  },
];

export function FeatureTabs() {
  const [active, setActive] = useState("hiring");
  const tab = TABS.find((t) => t.id === active)!;

  return (
    <section className="py-24 px-4" id="features">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">Built for every role in hiring</h2>
          <p className="text-zinc-500 text-lg">One platform. Three tailored experiences.</p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-1 p-1 rounded-2xl bg-zinc-900 border border-zinc-800">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActive(t.id)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                  active === t.id
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="animate-in fade-in duration-300" key={active}>
          <p className="text-center text-zinc-400 text-base mb-8 font-medium">{tab.tagline}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {tab.features.map(({ icon: Icon, title, desc }) => (
              <div key={title}
                className="flex items-start gap-4 p-5 rounded-2xl border border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:-translate-y-0.5 transition-all">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white mb-1">{title}</p>
                  <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
