export function ScoreDial({ score, size = 64, label, labelClassName }: { score: number; size?: number; label?: string; labelClassName?: string }) {
  const pct = score / 100;
  const r = (size / 2) - 6;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} className="dark:stroke-zinc-800" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.6s ease" }} />
        <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
          style={{ transform: "rotate(90deg)", transformOrigin: `${size/2}px ${size/2}px`, fill: color, fontSize: size * 0.22, fontWeight: 800 }}>
          {score}
        </text>
      </svg>
      {label && <p className={labelClassName || "text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500 text-center"}>{label}</p>}
    </div>
  );
}
