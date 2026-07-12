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
 *
 * Interaction: wheel/pinch zoom about the cursor, drag to pan, click to
 * select. A view transform (screen = base * k + t) layers on top of the
 * fit-to-container projection, so k=1 is exactly the statewide frame.
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

function rampIndex(score: number): number {
  return Math.min(
    RAMP.length - 1,
    Math.max(0, Math.floor((score / 100) * RAMP.length)),
  );
}

export function scoreColor(score: number): string {
  return RAMP[rampIndex(score)];
}

const EXCLUDED_DOT = "rgba(63, 63, 70, 0.35)"; // zinc-700 wash
const COUNTY_STROKE = "rgba(113, 113, 122, 0.35)"; // zinc-500 wash
const SURFACE = "#09090b";

const MIN_K = 1;
const MAX_K = 64;
// Dot screen radius grows sqrt(k), capped so zoomed-in dots never blob.
const DOT_GROWTH_CAP = 3.5;
const CLICK_SLOP_PX = 4; // drag-vs-click threshold
const BTN_ZOOM_FACTOR = 1.6;
// Dot paths are baked per quantized zoom step (~7%): radius error stays
// invisible while capping rebuilds at ~60 across the full 1x..64x range.
const QUANT_STEP = 1.07;

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

interface View {
  k: number;
  tx: number;
  ty: number;
}

// The scaled content box must always cover the viewport, so the state can
// never be dragged off-screen. At k=1 this pins tx=ty=0 (the fit view).
function clampView(v: View, w: number, h: number): View {
  const k = Math.min(MAX_K, Math.max(MIN_K, v.k));
  return {
    k,
    tx: Math.min(0, Math.max(w - w * k, v.tx)),
    ty: Math.min(0, Math.max(h - h * k, v.ty)),
  };
}

function quantizeZoom(k: number): number {
  return Math.pow(QUANT_STEP, Math.round(Math.log(k) / Math.log(QUANT_STEP)));
}

interface DotBucket {
  color: string;
  baseR: number;
  idxs: number[];
}

interface PathCache {
  quantK: number;
  buckets: { included: DotBucket[]; excluded: number[] };
  positions: Float32Array;
  dotPaths: { color: string; path: Path2D }[];
  excludedPath: Path2D;
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

  // Authoritative view transform lives in a ref: pan/zoom gestures mutate it
  // per frame and redraw imperatively without re-rendering React.
  const viewRef = useRef<View>({ k: 1, tx: 0, ty: 0 });
  const gestureRef = useRef({
    dragging: false,
    panned: false,
    downX: 0,
    downY: 0,
    lastX: 0,
    lastY: 0,
  });
  const rafRef = useRef<number | null>(null);
  const pathCacheRef = useRef<PathCache | null>(null);
  // Coarse mirror of viewRef.k for the button UI only (disabled states,
  // readout). Updated on ~0.1x boundaries; pure panning never touches it.
  const [uiZoom, setUiZoom] = useState(1);
  const uiZoomRef = useRef(1);

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

  // Base-space positions (canvas px at the fit view), computed once per
  // resize. The view transform maps these to the screen.
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
  // Built in base space, so it is zoom-independent.
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

  // Parcel indices grouped by (ramp color x size tier) so a frame is ~24
  // Path2D fills instead of 13.7k arcs. Slot order draws dim -> bright.
  const buckets = useMemo(() => {
    const slots: DotBucket[] = [];
    for (let r = 0; r < RAMP.length; r++) {
      slots.push({ color: RAMP[r], baseR: 1.8, idxs: [] });
      slots.push({ color: RAMP[r], baseR: 2.4, idxs: [] });
    }
    const excluded: number[] = [];
    for (let i = 0; i < parcels.length; i++) {
      const p = parcels[i];
      if (!filteredPins.has(p.pin)) {
        excluded.push(i);
        continue;
      }
      slots[rampIndex(p.score) * 2 + (p.score >= 70 ? 1 : 0)].idxs.push(i);
    }
    return { included: slots.filter((s) => s.idxs.length > 0), excluded };
  }, [parcels, filteredPins]);

  const pinIndex = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < parcels.length; i++) m.set(parcels[i].pin, i);
    return m;
  }, [parcels]);

  const countyPath = useMemo(() => {
    if (!proj) return null;
    const path = new Path2D();
    for (const ring of rings) {
      for (let i = 0; i < ring.pts.length; i++) {
        const [lng, lat] = ring.pts[i];
        const x = proj.x(lng);
        const y = proj.y(lat);
        if (i === 0) path.moveTo(x, y);
        else path.lineTo(x, y);
      }
    }
    return path;
  }, [rings, proj]);

  const nearestIndex = useCallback(
    (bx: number, by: number, maxDist: number): number => {
      if (!grid || !positions) return -1;
      const { map, cell } = grid;
      const cx = Math.floor(bx / cell);
      const cy = Math.floor(by / cell);
      let best = -1;
      let bestDist = maxDist * maxDist;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const bucket = map.get(`${cx + dx},${cy + dy}`);
          if (!bucket) continue;
          for (const i of bucket) {
            const ddx = positions[i * 2] - bx;
            const ddy = positions[i * 2 + 1] - by;
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

  // Hit-test at a constant 10 *screen* px radius: generous statewide,
  // surgical when zoomed in. 10/k <= 10 < 12 (grid cell), so the +-1-cell
  // neighborhood always covers the search radius.
  const hitTest = useCallback(
    (sx: number, sy: number): number => {
      const { k, tx, ty } = viewRef.current;
      return nearestIndex((sx - tx) / k, (sy - ty) / k, 10 / k);
    },
    [nearestIndex],
  );

  const buildPathCache = useCallback(
    (quantK: number): PathCache | null => {
      if (!positions) return null;
      const dotPaths: { color: string; path: Path2D }[] = [];
      for (const b of buckets.included) {
        const r =
          Math.min(b.baseR * Math.sqrt(quantK), b.baseR * DOT_GROWTH_CAP) /
          quantK;
        const path = new Path2D();
        for (const i of b.idxs) {
          const x = positions[i * 2];
          const y = positions[i * 2 + 1];
          // moveTo before each arc: consecutive arcs in one subpath would
          // otherwise be joined by chords that fill as slivers.
          path.moveTo(x + r, y);
          path.arc(x, y, r, 0, Math.PI * 2);
        }
        dotPaths.push({ color: b.color, path });
      }
      const excludedPath = new Path2D();
      const side = Math.min(1.5 * Math.sqrt(quantK), 4) / quantK;
      for (const i of buckets.excluded) {
        excludedPath.rect(
          positions[i * 2] - side / 2,
          positions[i * 2 + 1] - side / 2,
          side,
          side,
        );
      }
      return { quantK, buckets, positions, dotPaths, excludedPath };
    },
    [buckets, positions],
  );

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !proj || !positions || !countyPath || size.w === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const bw = Math.round(size.w * dpr);
    const bh = Math.round(size.h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { k, tx, ty } = viewRef.current;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = SURFACE;
    ctx.fillRect(0, 0, size.w, size.h);

    const quantK = quantizeZoom(k);
    let cache = pathCacheRef.current;
    if (
      !cache ||
      cache.quantK !== quantK ||
      cache.buckets !== buckets ||
      cache.positions !== positions
    ) {
      cache = buildPathCache(quantK);
      pathCacheRef.current = cache;
    }
    if (!cache) return;

    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * tx, dpr * ty);

    // County boundaries (constant screen-space hairline).
    ctx.strokeStyle = COUNTY_STROKE;
    ctx.lineWidth = 0.75 / k;
    ctx.stroke(countyPath);

    // Excluded parcels first (dim), included on top (score ramp).
    ctx.fillStyle = EXCLUDED_DOT;
    ctx.fill(cache.excludedPath);
    for (const { color, path } of cache.dotPaths) {
      ctx.fillStyle = color;
      ctx.fill(path);
    }

    // Selected parcel ring, drawn in screen space at constant weight.
    if (selectedPin) {
      const idx = pinIndex.get(selectedPin);
      if (idx !== undefined) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(
          positions[idx * 2] * k + tx,
          positions[idx * 2 + 1] * k + ty,
          Math.min(6 * Math.sqrt(k), 14),
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
    }
  };

  // rAF callbacks and the native wheel listener must see the latest render's
  // closures, so they go through refs refreshed after every render.
  const drawFnRef = useRef<() => void>(() => {});
  useEffect(() => {
    drawFnRef.current = draw;
  });

  const scheduleDraw = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      drawFnRef.current();
    });
  }, []);

  useEffect(
    () => () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  const applyView = (next: View) => {
    const v = clampView(next, size.w, size.h);
    viewRef.current = v;
    scheduleDraw();
    if (Math.round(v.k * 10) !== Math.round(uiZoomRef.current * 10)) {
      uiZoomRef.current = v.k;
      setUiZoom(v.k);
    }
  };

  const zoomAboutPoint = (factor: number, sx: number, sy: number) => {
    const { k, tx, ty } = viewRef.current;
    const k2 = Math.min(MAX_K, Math.max(MIN_K, k * factor));
    applyView({
      k: k2,
      tx: sx - ((sx - tx) * k2) / k,
      ty: sy - ((sy - ty) * k2) / k,
    });
  };

  // Wheel must be a native non-passive listener: React's onWheel can't
  // reliably preventDefault, and the page behind the map scrolls.
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    // d3-zoom delta normalization: trackpad pinch arrives as ctrl+wheel with
    // small deltas; deltaMode 1 is Firefox line-scrolling.
    const delta =
      -e.deltaY *
      (e.deltaMode === 1 ? 0.05 : e.deltaMode ? 1 : 0.002) *
      (e.ctrlKey ? 10 : 1);
    zoomAboutPoint(Math.exp(delta), sx, sy);
    // Keep the tooltip truthful mid-zoom.
    const idx = hitTest(sx, sy);
    setHover(idx >= 0 ? { parcel: parcels[idx], px: sx, py: sy } : null);
  };
  const wheelFnRef = useRef<(e: WheelEvent) => void>(() => {});
  useEffect(() => {
    wheelFnRef.current = onWheel;
  });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => wheelFnRef.current(e);
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  }, []);

  // Re-clamp (the view can exceed bounds after a resize) and redraw whenever
  // inputs change; the path cache invalidates itself via key checks.
  useEffect(() => {
    viewRef.current = clampView(viewRef.current, size.w, size.h);
    scheduleDraw();
  }, [buckets, selectedPin, positions, proj, countyPath, size, scheduleDraw]);

  const endDrag = () => {
    gestureRef.current.dragging = false;
    const canvas = canvasRef.current;
    if (canvas) canvas.style.cursor = "";
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const g = gestureRef.current;
    g.dragging = true;
    g.panned = false;
    g.downX = g.lastX = e.clientX - rect.left;
    g.downY = g.lastY = e.clientY - rect.top;
    setHover(null);
    canvas.style.cursor = "grabbing";
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const g = gestureRef.current;
    if (g.dragging) {
      if (!g.panned && Math.hypot(sx - g.downX, sy - g.downY) > CLICK_SLOP_PX) {
        g.panned = true;
      }
      if (g.panned) {
        const { k, tx, ty } = viewRef.current;
        applyView({ k, tx: tx + (sx - g.lastX), ty: ty + (sy - g.lastY) });
      }
      g.lastX = sx;
      g.lastY = sy;
      return;
    }
    const idx = hitTest(sx, sy);
    setHover(idx >= 0 ? { parcel: parcels[idx], px: sx, py: sy } : null);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const g = gestureRef.current;
    if (!canvas || !g.dragging) return;
    if (canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    const wasPanned = g.panned;
    endDrag();
    // A release after a real pan is not a click.
    if (wasPanned) return;
    const rect = canvas.getBoundingClientRect();
    const idx = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    onSelect(idx >= 0 ? parcels[idx].pin : null);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    zoomAboutPoint(2, e.clientX - rect.left, e.clientY - rect.top);
  };

  const atMinZoom = uiZoom <= MIN_K + 0.001;
  const atMaxZoom = uiZoom >= MAX_K * 0.99;

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        style={{ width: size.w, height: size.h }}
        className={`touch-none ${hover ? "cursor-pointer" : "cursor-grab"}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setHover(null)}
        onLostPointerCapture={endDrag}
        onDoubleClick={handleDoubleClick}
      />
      {/* Zoom controls */}
      <div className="absolute right-3 top-3 flex flex-col items-center gap-1.5">
        <div className="flex flex-col divide-y divide-zinc-800/60 overflow-hidden rounded border border-zinc-800/60 bg-zinc-950/80">
          <button
            type="button"
            aria-label="zoom in"
            disabled={atMaxZoom}
            onClick={() =>
              zoomAboutPoint(BTN_ZOOM_FACTOR, size.w / 2, size.h / 2)
            }
            className="flex h-7 w-7 items-center justify-center font-mono text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 disabled:pointer-events-none disabled:opacity-30"
          >
            +
          </button>
          <button
            type="button"
            aria-label="zoom out"
            disabled={atMinZoom}
            onClick={() =>
              zoomAboutPoint(1 / BTN_ZOOM_FACTOR, size.w / 2, size.h / 2)
            }
            className="flex h-7 w-7 items-center justify-center font-mono text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 disabled:pointer-events-none disabled:opacity-30"
          >
            −
          </button>
          <button
            type="button"
            aria-label="reset view"
            disabled={atMinZoom}
            onClick={() => applyView({ k: 1, tx: 0, ty: 0 })}
            className="flex h-7 w-7 items-center justify-center font-mono text-[9px] uppercase text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 disabled:pointer-events-none disabled:opacity-30"
          >
            fit
          </button>
        </div>
        {!atMinZoom && (
          <span className="font-mono text-[9px] text-zinc-600">
            {uiZoom.toFixed(1)}×
          </span>
        )}
      </div>
      {/* Interaction hint (statewide view only) */}
      {atMinZoom && (
        <p className="pointer-events-none absolute bottom-3 right-3 font-mono text-[9px] uppercase tracking-wider text-zinc-600">
          scroll to zoom · drag to pan
        </p>
      )}
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
