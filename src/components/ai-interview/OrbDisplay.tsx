import type { VisualPhase } from "@/lib/ai-interview/providers/visual/types";

export function OrbDisplay({ phase }: { phase: VisualPhase }) {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Label */}
      <div className="flex items-center gap-2 mb-2 z-10 relative">
        <div
          className={`w-2 h-2 rounded-full transition-all duration-500 ${
            phase === "asking"
              ? "bg-rose-400 animate-pulse"
              : phase === "listening"
              ? "bg-zinc-600"
              : "bg-zinc-700"
          }`}
        />
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          Alex
        </span>
      </div>
      {/* Avatar orb inside a card */}
      <div
        className={`relative w-[200px] aspect-video md:w-[260px] rounded-2xl bg-zinc-900 border-2 transition-all duration-700 flex items-center justify-center overflow-hidden ${
          phase === "asking"
            ? "border-rose-500 shadow-[0_0_30px_rgba(99,102,241,0.35)]"
            : phase === "listening"
            ? "border-zinc-700"
            : "border-zinc-800"
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-zinc-900 to-rose-950/30" />
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div
            className={`relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-4 transition-all duration-700 ${
              phase === "asking"
                ? "border-rose-500 scale-105 shadow-[0_0_40px_rgba(99,102,241,0.5)]"
                : phase === "listening"
                ? "border-emerald-500/50 scale-100"
                : "border-zinc-700 scale-95 opacity-80"
            }`}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-zinc-800 to-zinc-900" />
            <div
              className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                phase === "asking" ? "opacity-100" : "opacity-40"
              }`}
            >
              <div className="w-12 h-12 md:w-16 md:h-16 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
                <div
                  className={`w-6 h-6 md:w-8 md:h-8 rounded-full bg-rose-100 transition-all duration-[400ms] ${
                    phase === "asking"
                      ? "animate-pulse scale-125 opacity-100"
                      : "scale-50 opacity-40"
                  }`}
                />
              </div>
            </div>
          </div>
        </div>
        {/* Asking glow sweep */}
        {phase === "asking" && (
          <div className="absolute inset-0 bg-gradient-to-t from-rose-600/10 to-transparent pointer-events-none animate-pulse" />
        )}
      </div>
      {/* Provider label */}
      <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-mono text-zinc-500 tracking-wide uppercase shadow-sm">
        Powered by <span className="text-zinc-300 font-bold">Orb Visuals</span>
      </div>
    </div>
  );
}
