export function DataCoverageBar({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-400 w-44 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: "#C8A96E" }}
        />
      </div>
      <span className="text-xs text-zinc-300 w-28 text-right shrink-0 tabular-nums">
        {count.toLocaleString()} / {total.toLocaleString()}
      </span>
      <span className="text-xs text-zinc-500 w-10 text-right shrink-0 tabular-nums">
        {pct}%
      </span>
    </div>
  );
}
