import type { VisualPhase } from "@/lib/ai-interview/providers/visual/types";
import { Loader2 } from "lucide-react";

interface VideoAvatarDisplayProps {
  phase: VisualPhase;
  subProvider: string;
  streamUrl?: string | null;
}

export function VideoAvatarDisplay({ phase, subProvider, streamUrl }: VideoAvatarDisplayProps) {
  const isAsking = phase === "asking";
  
  // Format provider name for the badge
  const displayProvider = subProvider === "did" ? "D-ID" : 
                          subProvider === "tavus" ? "Tavus" : 
                          subProvider === "simli" ? "Simli" : subProvider;

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Label */}
      <div className="flex items-center gap-2">
        <div
          className={`w-2 h-2 rounded-full transition-all duration-500 ${
            isAsking ? "bg-rose-400 animate-pulse" : "bg-zinc-600"
          }`}
        />
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
          AI Interviewer
        </span>
      </div>

      {/* Video Container Card (16:9 aspect ratio) */}
      <div
        className={`relative w-[340px] sm:w-[500px] md:w-[700px] lg:w-[860px] aspect-video rounded-2xl bg-zinc-900 border-2 transition-all duration-700 overflow-hidden shadow-lg ${
          isAsking
            ? "border-rose-500 shadow-rose-500/20"
            : "border-zinc-800 shadow-black/40"
        }`}
      >
        {/* Placeholder / Fallback / Loading State */}
        {!streamUrl && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950">
            <div className="relative w-16 h-16 rounded-full border border-zinc-800 flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
              {isAsking && (
                <div className="absolute inset-[-10px] rounded-full ring-2 ring-rose-500/40 animate-ping pointer-events-none" />
              )}
            </div>
            <p className="text-xs text-zinc-500 font-medium tracking-wide">Connecting Avatar...</p>
          </div>
        )}

        {/* Real Video WebRTC / Iframe block */}
        {streamUrl && (
          <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center">
            {subProvider === "tavus" ? (
              <iframe 
                src={streamUrl} 
                allow="camera; microphone" 
                scrolling="no"
                className="w-full h-full border-0 pointer-events-auto" 
              />
            ) : (
              <span className="text-xs text-zinc-500 font-mono italic">Video Stream ({subProvider})</span>
            )}
          </div>
        )}

        {/* Live badge overlay */}
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isAsking ? "bg-rose-400 animate-pulse" : "bg-zinc-500"
            }`}
          />
          <span className="text-[9px] font-bold text-white uppercase tracking-wider">
            {isAsking ? "Speaking" : "Idle"}
          </span>
        </div>
      </div>

      {/* Provider label */}
      <div className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-mono text-zinc-500 tracking-wide uppercase shadow-sm">
        Powered by <span className="text-zinc-300 font-bold">{displayProvider}</span>
      </div>
    </div>
  );
}
