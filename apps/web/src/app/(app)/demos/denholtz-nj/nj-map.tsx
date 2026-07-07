"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NjParcel } from "./data";
import countiesGeo from "./nj-counties.json";

/**
 * Self-contained statewide parcel map: every screened parcel is a canvas dot
 * (the dots themselves draw the shape of New Jersey), county boundaries
 * stroked from an embedded 18KB GeoJSON. No map API dependency. Dots are
 * colored by developability score on a sequential blue ramp (bright = high);
 * parcels excluded by the active filters stay visible but dimmed, so
 * tightening a filter visibly switches off regions of the state.
 */

// Sequential blue ramp (dark-surface anchoring: light end = max magnitude).
const RAMP = [
  "#0d366b",
  "#104281",
  "#184f95",
  "#1c5cab",
  "#256abf",
  "#2a78d6",
  "#3987e5",
  "#5598e7",
  "#6da7ec",
  "#86b6ef",
  "#9ec5f4",
  "#cde2fb",
];

export function scoreColor(score: number): string {
  const idx = Math.min(
    RAMP.length - 1,
    Math.max(0, Math.floor((score / 100) * RAMP.length)),
  );
  return RAMP[idx];
}

const EXCLUDED_DOT = "rgba(63, 63, 70, 0.35)"; // zinc-700 wash
const COUNTY_STROKE = "rgba(113, 113, 122, 0.35)"; // zinc-500 wash
const SURFACE = "#09090b";

interface Ring {
  pts: [number, number][];
}

function extractRings(): Ring[] {
  const rings: Ring[] = [];
  const fc = countiesGeo as {
    features: { geometry: { type: string; coordinates: unknown } }[];
  };
  for (const f of fc.features) {
    const g = f.geometry;
    if (g.type === "Polygon") {
      for (const ring of g.coordinates as [number, number][][]) {
        rings.push({ pts: ring });
      }
    } else if (g.type === "MultiPolygon") {
      for (const poly of g.coordinates as [number, number][][][]) {
        for (const ring of poly) rings.push({ pts: ring });
      }
    }
  }
  return rings;
}

interface Projection {
  x: (lng: number) => number;
  y: (lat: number) => number;
}

function buildProjection(w: number, h: number, pad: number): Projection {
  // NJ bounds from the county layer, with a cos(midLat) aspect correction.
  const minLng = -75.57;
  const maxLng = -73.88;
  const minLat = 38.92;
  const maxLat = 41.36;
  const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const spanX = (maxLng - minLng) * kx;
  const spanY = maxLat - minLat;
  const scale = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY);
  const ox = (w - spanX * scale) / 2;
  const oy = (h - spanY * scale) / 2;
  return {
    x: (lng) => ox + (lng - minLng) * kx * scale,
    y: (lat) => oy + (maxLat - lat) * scale,
  };
}

interface HoverInfo {
  parcel: NjParcel;
  px: number;
  py: number;
}

export function NjMap({
  parcels,
  filteredPins,
  selectedPin,
  onSelect,
}: {
  parcels: NjParcel[];
  filteredPins: Set<string>;
  selectedPin: string | null;
  onSelect: (pin: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<HoverInfo | null>(null);

  const rings = useMemo(() => extractRings(), []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const proj = useMemo(
    () => (size.w > 0 ? buildProjection(size.w, size.h, 18) : null),
    [size],
  );

  // Screen-space positions, computed once per resize.
  const positions = useMemo(() => {
    if (!proj) return null;
    const arr = new Float32Array(parcels.length * 2);
    for (let i = 0; i < parcels.length; i++) {
      arr[i * 2] = proj.x(parcels[i].lng);
      arr[i * 2 + 1] = proj.y(parcels[i].lat);
    }
    return arr;
  }, [parcels, proj]);

  // Spatial grid over INCLUDED parcels for hover/click hit-testing.
  const grid = useMemo(() => {
    if (!positions) return null;
    const cell = 12;
    const map = new Map<string, number[]>();
    for (let i = 0; i < parcels.length; i++) {
      if (!filteredPins.has(parcels[i].pin)) continue;
      const key = `${Math.floor(positions[i * 2] / cell)},${Math.floor(positions[i * 2 + 1] / cell)}`;
      const bucket = map.get(key);
      if (bucket) bucket.push(i);
      else map.set(key, [i]);
    }
    return { map, cell };
  }, [positions, parcels, filteredPins]);

  const nearestIndex = useCallback(
    (px: number, py: number): number => {
      if (!grid || !positions) return -1;
      const { map, cell } = grid;
      const cx = Math.floor(px / cell);
      const cy = Math.floor(py / cell);
      let best = -1;
      let bestDist = 10 * 10; // 10px hit radius
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bucket = map.get(`${cx + dx},${cy + dy}`);
          if (!bucket) continue;
          for (const i of bucket) {
            const ddx = positions[i * 2] - px;
            const ddy = positions[i * 2 + 1] - py;
            const d = ddx * ddx + ddy * ddy;
            if (d < bestDist) {
              bestDist = d;
              best = i;
            }
          }
        }
      }
      return best;
    },
    [grid, positions],
  );

  // Draw.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !proj || !positions || size.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = SURFACE;
    ctx.fillRect(0, 0, size.w, size.h);

    // County boundaries.
    ctx.strokeStyle = COUNTY_STROKE;
    ctx.lineWidth = 0.75;
    for (const ring of rings) {
      ctx.beginPath();
      for (let i = 0; i < ring.pts.length; i++) {
        const [lng, lat] = ring.pts[i];
        const x = proj.x(lng);
        const y = proj.y(lat);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // Excluded parcels first (dim), included on top (score ramp).
    ctx.fillStyle = EXCLUDED_DOT;
    for (let i = 0; i < parcels.length; i++) {
      if (filteredPins.has(parcels[i].pin)) continue;
      ctx.fillRect(
        positions[i * 2] - 0.75,
        positions[i * 2 + 1] - 0.75,
        1.5,
        1.5,
      );
    }
    for (let i = 0; i < parcels.length; i++) {
      const p = parcels[i];
      if (!filteredPins.has(p.pin)) continue;
      ctx.fillStyle = scoreColor(p.score);
      ctx.beginPath();
      ctx.arc(
        positions[i * 2],
        positions[i * 2 + 1],
        p.score >= 70 ? 2.4 : 1.8,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }

    // Selected parcel ring.
    if (selectedPin) {
      const idx = parcels.findIndex((p) => p.pin === selectedPin);
      if (idx >= 0) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(positions[idx * 2], positions[idx * 2 + 1], 6, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }, [parcels, filteredPins, selectedPin, positions, proj, rings, size]);

  const handleMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const idx = nearestIndex(px, py);
    setHover(idx >= 0 ? { parcel: parcels[idx], px, py } : null);
  };

  const handleClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const idx = nearestIndex(e.clientX - rect.left, e.clientY - rect.top);
    onSelect(idx >= 0 ? parcels[idx].pin : null);
  };

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h }}
        className={hover ? "cursor-pointer" : "cursor-crosshair"}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        onClick={handleClick}
      />
      {/* Legend */}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded border border-zinc-800/60 bg-zinc-950/80 px-3 py-2">
        <p className="mb-1.5 text-[9px] uppercase tracking-wider text-zinc-500 font-mono">
          developability score
        </p>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-zinc-600 font-mono">0</span>
          <div
            className="h-1.5 w-24 rounded-full"
            style={{
              background: `linear-gradient(to right, ${RAMP[0]}, ${RAMP[5]}, ${RAMP[11]})`,
            }}
          />
          <span className="text-[9px] text-zinc-600 font-mono">99</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-sm bg-zinc-700/50" />
          <span className="text-[9px] text-zinc-600 font-mono">
            excluded by filters
          </span>
        </div>
      </div>
      {/* Hover tooltip */}
      {hover && (
        <div
          className="pointer-events-none absolute z-10 max-w-[240px] rounded border border-zinc-700/60 bg-zinc-950/95 px-3 py-2 shadow-xl"
          style={{
            left: Math.min(hover.px + 14, size.w - 250),
            top: Math.max(hover.py - 10, 8),
          }}
        >
          <p className="text-xs font-medium text-zinc-200">
            {hover.parcel.address || hover.parcel.pin}
          </p>
          <p className="text-[10px] text-zinc-500 font-mono">
            {hover.parcel.muni} · {hover.parcel.county}
          </p>
          <p className="mt-1 text-[10px] text-zinc-400 font-mono">
            {hover.parcel.acres} ac · score{" "}
            <span style={{ color: scoreColor(hover.parcel.score) }}>
              {hover.parcel.score}
            </span>
            {hover.parcel.sewer ? " · sewer" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
