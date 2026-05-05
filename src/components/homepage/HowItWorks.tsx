"use client";

import { useEffect, useRef } from "react";
import { Mail, Video, BarChart3 } from "lucide-react";

const STEPS = [
  {
    icon:  Mail,
    num:   "01",
    title: "Invite & Schedule",
    desc:  "Add candidates to a position, configure the interview pipeline, and send magic-link invitations. Candidates see a countdown — not a confusing portal.",
    color: "from-rose-600/20 to-rose-600/5",
    border: "border-rose-500/30",
    accent: "text-rose-400",
  },
  {
    icon:  Video,
    num:   "02",
    title: "Conduct AI-Guided Interviews",
    desc:  "Live interviews with real-time behavioral signal capture — attention tracking, speech analysis, sentiment — all without interrupting the conversation.",
    color: "from-pink-600/20 to-pink-600/5",
    border: "border-pink-500/30",
    accent: "text-pink-400",
  },
  {
    icon:  BarChart3,
    num:   "03",
    title: "Decide with Intelligence",
    desc:  "Panelist scorecards, AI analysis reports, and structured pipeline actions (Advance / Hold / Reject). Every decision is logged and auditable.",
    color: "from-emerald-600/20 to-emerald-600/5",
    border: "border-emerald-500/30",
    accent: "text-emerald-400",
  },
];

function Step({ step, index }: { step: typeof STEPS[0]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          ref.current!.style.opacity = "1";
          ref.current!.style.transform = "translateY(0)";
        }
      },
      { threshold: 0.2 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  const { icon: Icon } = step;

  return (
    <div
      ref={ref}
      style={{
        opacity: 0,
        transform: "translateY(24px)",
        transition: `opacity 0.6s ease ${index * 0.18}s, transform 0.6s ease ${index * 0.18}s`,
      }}
      className={`relative p-7 rounded-3xl border bg-gradient-to-b ${step.color} ${step.border}`}
    >
      <div className="flex items-start gap-4 mb-4">
        <div className={`w-12 h-12 rounded-2xl bg-zinc-950/60 border ${step.border} flex items-center justify-center shrink-0`}>
          <Icon className={`w-5 h-5 ${step.accent}`} />
        </div>
        <span className={`text-4xl font-black opacity-20 ${step.accent} mt-0.5`}>{step.num}</span>
      </div>
      <h3 className="text-lg font-black text-white mb-2">{step.title}</h3>
      <p className="text-sm text-zinc-500 leading-relaxed">{step.desc}</p>
    </div>
  );
}

export function HowItWorks() {
  return (
    <section className="py-24 px-4 bg-white dark:bg-zinc-950/60" id="how-it-works">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black text-white mb-3">How IQMela works</h2>
          <p className="text-zinc-500 text-lg">From invite to decision in three intelligent steps.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((step, i) => <Step key={step.num} step={step} index={i} />)}
        </div>
      </div>
    </section>
  );
}
