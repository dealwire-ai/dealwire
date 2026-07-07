"use client";

import { useMemo, useState } from "react";
import type { NjParcel } from "./data";

/**
 * Plain-SVG charts for the filtered parcel set. Single-series marks wear one
 * hue (slot-1 blue, dark step); identity never rides on color alone; both
 * charts carry a per-mark hover tooltip. Values live in ink tokens, not
 * series color.
 */

const BAR = "#3987e5"; // categorical slot-1, dark surface step
const BAR_HOVER = "#6da7ec";
const INK_MUTED = "#71717a"; // zinc-500
const INK_FAINT = "#52525b"; // zinc-600

interface TooltipState {
  x: number;
  y: number;
  title: string;
  value: string;
}

function ChartTooltip({ tip }: { tip: TooltipState | null }) {
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none absolute z-10 rounded border border-zinc-700/60 bg-zinc-950/95 px-2.5 py-1.5 shadow-xl"
      style={{ left: tip.x, top: tip.y }}
    >
      <p className="text-[10px] text-zinc-400 font-mono">{tip.title}</p>
      <p className="text-xs font-medium text-zinc-200 font-mono">{tip.value}</p>
    </div>
  );
}

// ── Score distribution histogram ───────────────────────────

export function ScoreHistogram({ parcels }: { parcels: NjParcel[] }) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [hovered, setHovered] = useState(-1);

  const buckets = useMemo(() => {
    const b = new Array(10).fill(0) as number[];
    for (const p of parcels) b[Math.min(9, Math.floor(p.score / 10))]++;
    return b;
  }, [parcels]);

  const max = Math.max(...buckets, 1);
  const W = 260;
  const H = 96;
  const gap = 2;
  const bw = (W - gap * 9) / 10;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H + 14}`}
        className="w-full"
        onMouseLeave={() => {
          setTip(null);
          setHovered(-1);
        }}
      >
        {buckets.map((count, i) => {
          const h = Math.max(count > 0 ? 2 : 0, (count / max) * H);
          const x = i * (bw + gap);
          return (
            <g key={i}>
              {/* hit target taller than the mark */}
              <rect
                x={x}
                y={0}
                width={bw}
                height={H}
                fill="transparent"
                onMouseEnter={() => {
                  setHovered(i);
                  setTip({
                    x: x + bw / 2,
                    y: 0,
                    title: `score ${i * 10}–${i * 10 + 9}`,
                    value: `${count.toLocaleString()} parcels`,
                  });
                }}
              />
              <rect
                x={x}
                y={H - h}
                width={bw}
                height={h}
                rx={2}
                fill={hovered === i ? BAR_HOVER : BAR}
                pointerEvents="none"
              />
            </g>
          );
        })}
        {/* baseline + selective end labels */}
        <line x1={0} y1={H + 0.5} x2={W} y2={H + 0.5} stroke="#27272a" />
        <text
          x={0}
          y={H + 11}
          fontSize={8}
          fill={INK_FAINT}
          fontFamily="monospace"
        >
          0
        </text>
        <text
          x={W}
          y={H + 11}
          fontSize={8}
          fill={INK_FAINT}
          fontFamily="monospace"
          textAnchor="end"
        >
          99
        </text>
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  );
}

// ── County breakdown (top 8 by parcel count) ───────────────

export function CountyBars({ parcels }: { parcels: NjParcel[] }) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [hovered, setHovered] = useState(-1);

  const rows = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of parcels)
      counts.set(p.county, (counts.get(p.county) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [parcels]);

  const max = Math.max(...rows.map((r) => r[1]), 1);
  const W = 260;
  const rowH = 17;
  const labelW = 82;
  const H = rows.length * rowH;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        onMouseLeave={() => {
          setTip(null);
          setHovered(-1);
        }}
      >
        {rows.map(([county, count], i) => {
          const w = Math.max(2, (count / max) * (W - labelW - 34));
          const y = i * rowH;
          return (
            <g
              key={county}
              onMouseEnter={() => {
                setHovered(i);
                setTip({
                  x: labelW + w,
                  y: y - 6,
                  title: county,
                  value: `${count.toLocaleString()} parcels`,
                });
              }}
            >
              <rect x={0} y={y} width={W} height={rowH} fill="transparent" />
              <text
                x={labelW - 6}
                y={y + rowH / 2 + 3}
                fontSize={9}
                fill={INK_MUTED}
                fontFamily="monospace"
                textAnchor="end"
              >
                {county.length > 10 ? `${county.slice(0, 9)}…` : county}
              </text>
              <rect
                x={labelW}
                y={y + 3.5}
                width={w}
                height={rowH - 7}
                rx={2}
                fill={hovered === i ? BAR_HOVER : BAR}
              />
              <text
                x={labelW + w + 5}
                y={y + rowH / 2 + 3}
                fontSize={9}
                fill={INK_FAINT}
                fontFamily="monospace"
              >
                {count.toLocaleString()}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartTooltip tip={tip} />
    </div>
  );
}
