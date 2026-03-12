"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

const TARGET = 6.4;
const DURATION_MS = 2000;

export function DealFlowTicker() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const [value, setValue] = useState(0);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!isInView || hasStarted.current) return;
    hasStarted.current = true;

    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / DURATION_MS, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(eased * TARGET);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [isInView]);

  return (
    <div
      ref={ref}
      className="inline-flex items-center gap-2.5 px-3.5 py-2 bg-white/[0.03] border border-white/[0.06] rounded-sm"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C8A96E]/60" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C8A96E]" />
      </span>
      <span className="text-[0.8125rem] font-mono text-white/45 tracking-wide">
        <span className="text-[#C8A96E] font-medium">
          ${value.toFixed(1)}B+
        </span>{" "}
        in deal flow analyzed
      </span>
    </div>
  );
}
