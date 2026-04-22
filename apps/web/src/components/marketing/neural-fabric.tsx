"use client";

import { useEffect, useRef } from "react";

const ACCENT = "200, 169, 110";
const GRID = 80;
const EDGE_THRESHOLD = GRID * 1.6;
const DROP_CUTOFF = 0.35;

type Node = { x: number; y: number; phase: number };
type Edge = { a: number; b: number; len: number };
type Signal = { edge: number; t: number; speed: number; dir: 1 | -1 };

export function NeuralFabric() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let edges: Edge[] = [];
    let signals: Signal[] = [];
    let raf = 0;
    const start = performance.now();
    let last = start;

    const hash = (i: number, j: number, salt: number) =>
      (Math.sin(i * 17.31 + j * 7.11 + salt) * 43758.5453) % 1;

    const newSignal = (): Signal => ({
      edge: Math.floor(Math.random() * Math.max(edges.length, 1)),
      t: Math.random() * 0.3,
      speed: 0.00025 + Math.random() * 0.00035,
      dir: Math.random() > 0.5 ? 1 : -1,
    });

    const buildGraph = () => {
      nodes = [];
      const cols = Math.ceil(width / GRID) + 2;
      const rows = Math.ceil(height / GRID) + 2;
      for (let i = -1; i < cols; i++) {
        for (let j = -1; j < rows; j++) {
          if (Math.abs(hash(i, j, 0)) < DROP_CUTOFF) continue;
          const jx = hash(i, j, 1.7) * 22;
          const jy = hash(i, j, 2.9) * 22;
          nodes.push({
            x: i * GRID + jx,
            y: j * GRID + jy,
            phase: ((i * 0.73 + j * 1.17) % (Math.PI * 2)) + Math.PI,
          });
        }
      }

      edges = [];
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const len = Math.hypot(dx, dy);
          if (len < EDGE_THRESHOLD) edges.push({ a: i, b: j, len });
        }
      }

      const targetSignals = Math.min(
        8,
        Math.max(3, Math.floor(edges.length / 80)),
      );
      signals = Array.from({ length: targetSignals }, newSignal);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildGraph();
    };

    const draw = (now: number) => {
      const dt = Math.min(now - last, 64);
      last = now;
      const t = (now - start) / 1000;

      ctx.clearRect(0, 0, width, height);

      for (const e of edges) {
        const a = nodes[e.a];
        const b = nodes[e.b];
        const falloff = 1 - e.len / EDGE_THRESHOLD;
        const alpha = 0.05 * falloff;
        ctx.strokeStyle = `rgba(${ACCENT}, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      for (let i = 0; i < signals.length; i++) {
        const s = signals[i];
        s.t += s.speed * dt;
        if (s.t >= 1) {
          signals[i] = newSignal();
          continue;
        }
        const e = edges[s.edge];
        if (!e) {
          signals[i] = newSignal();
          continue;
        }
        const a = nodes[e.a];
        const b = nodes[e.b];
        const u = s.dir === 1 ? s.t : 1 - s.t;
        const x = a.x + (b.x - a.x) * u;
        const y = a.y + (b.y - a.y) * u;
        const fade = Math.sin(s.t * Math.PI);
        const grad = ctx.createRadialGradient(x, y, 0, x, y, 14);
        grad.addColorStop(0, `rgba(${ACCENT}, ${0.55 * fade})`);
        grad.addColorStop(0.4, `rgba(${ACCENT}, ${0.15 * fade})`);
        grad.addColorStop(1, `rgba(${ACCENT}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const n of nodes) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.7 + n.phase);
        const alpha = 0.18 + 0.22 * pulse;
        ctx.fillStyle = `rgba(${ACCENT}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };

    const drawStatic = () => {
      ctx.clearRect(0, 0, width, height);
      for (const e of edges) {
        const a = nodes[e.a];
        const b = nodes[e.b];
        const falloff = 1 - e.len / EDGE_THRESHOLD;
        ctx.strokeStyle = `rgba(${ACCENT}, ${0.05 * falloff})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      for (const n of nodes) {
        ctx.fillStyle = `rgba(${ACCENT}, 0.25)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reducedMotion) drawStatic();
    });
    ro.observe(canvas);

    if (reducedMotion) {
      drawStatic();
    } else {
      raf = requestAnimationFrame(draw);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
