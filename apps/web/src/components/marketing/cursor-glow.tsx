"use client";

import { motion, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useState, useSyncExternalStore } from "react";

const SELECTOR = "[data-cursor-glow='true']";

const subscribeMedia = (cb: () => void) => {
  if (typeof window === "undefined") return () => {};
  const a = window.matchMedia("(hover: hover) and (pointer: fine)");
  const b = window.matchMedia("(prefers-reduced-motion: reduce)");
  a.addEventListener("change", cb);
  b.addEventListener("change", cb);
  return () => {
    a.removeEventListener("change", cb);
    b.removeEventListener("change", cb);
  };
};

const getHoverable = () =>
  window.matchMedia("(hover: hover) and (pointer: fine)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function CursorGlow() {
  const x = useMotionValue(-1000);
  const y = useMotionValue(-1000);
  const sx = useSpring(x, { stiffness: 150, damping: 25, mass: 0.5 });
  const sy = useSpring(y, { stiffness: 150, damping: 25, mass: 0.5 });

  const [active, setActive] = useState(false);
  const hoverable = useSyncExternalStore(
    subscribeMedia,
    getHoverable,
    () => false,
  );

  useEffect(() => {
    if (!hoverable) return;

    const targets = Array.from(
      document.querySelectorAll<HTMLElement>(SELECTOR),
    );
    if (targets.length === 0) return;

    const visible = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target);
          else visible.delete(e.target);
        }
        setActive(visible.size > 0);
      },
      { threshold: 0.15 },
    );
    targets.forEach((t) => io.observe(t));

    const onMove = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener("mousemove", onMove);
    };
  }, [hoverable, x, y]);

  if (!hoverable) return null;

  return (
    <motion.div
      aria-hidden="true"
      style={{
        x: sx,
        y: sy,
        translateX: "-50%",
        translateY: "-50%",
      }}
      animate={{ opacity: active ? 1 : 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.4, 0.25, 1] }}
      className="fixed top-0 left-0 z-20 pointer-events-none w-[520px] h-[520px] rounded-full blur-[90px]"
    >
      <div className="w-full h-full rounded-full bg-[radial-gradient(circle_at_center,rgba(200,169,110,0.18),rgba(200,169,110,0.06)_45%,transparent_70%)]" />
    </motion.div>
  );
}
