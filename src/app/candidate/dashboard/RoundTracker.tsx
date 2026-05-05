interface Round {
  label:      string;
  stageIndex: number;
}

interface Props {
  completedRounds:   Round[];
  currentStageIndex: number;
  currentLabel:      string;
  upcomingRounds:    Round[];
}

export function RoundTracker({ completedRounds, currentStageIndex, currentLabel, upcomingRounds }: Props) {
  const all: { label: string; type: "done" | "current" | "upcoming" }[] = [
    ...completedRounds.map((r) => ({ label: r.label, type: "done" as const })),
    { label: currentLabel, type: "current" as const },
    ...upcomingRounds.map((r) => ({ label: r.label, type: "upcoming" as const })),
  ];

  return (
    <div className="border border-zinc-800 rounded-2xl bg-zinc-900/40 p-6">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-8">
        Your Interview Pipeline
      </h2>
      <div className="flex items-start">
        {all.map((round, i) => {
          const isLast = i === all.length - 1;
          return (
            <div key={i} className="flex items-start flex-1 min-w-0">
              {/* Node + label */}
              <div className="flex flex-col items-center flex-1">
                {/* Dot */}
                <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border-2 shrink-0 ${
                  round.type === "done"
                    ? "bg-rose-600 border-rose-600"
                    : round.type === "current"
                    ? "bg-zinc-950 border-rose-500 ring-4 ring-rose-500/20"
                    : "bg-zinc-950 border-zinc-700"
                }`}>
                  {round.type === "done" ? (
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : round.type === "current" ? (
                    <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse" />
                  ) : (
                    <span className="w-3 h-3 rounded-full bg-zinc-700" />
                  )}
                </div>

                {/* Label */}
                <p className={`text-[10px] font-bold text-center mt-2 leading-tight max-w-[72px] ${
                  round.type === "done"    ? "text-rose-400" :
                  round.type === "current" ? "text-white"      : "text-zinc-600"
                }`}>
                  {round.label}
                </p>
                {round.type === "current" && (
                  <span className="text-[9px] text-rose-400 font-black mt-0.5 tracking-widest">● NOW</span>
                )}
              </div>

              {/* Connector */}
              {!isLast && (
                <div className={`h-0.5 flex-1 mx-0.5 mt-4 transition-colors ${
                  round.type === "done" ? "bg-rose-600" : "bg-zinc-800"
                }`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
