"use client";

import { motion, useScroll, useSpring } from "framer-motion";

export function ScrollRail() {
  const { scrollYProgress } = useScroll();
  const scaleY = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    mass: 0.4,
  });

  return (
    <div
      aria-hidden="true"
      className="fixed right-6 lg:right-8 top-0 bottom-0 z-30 pointer-events-none hidden md:block"
    >
      <div className="relative h-full w-px">
        <div className="absolute inset-0 bg-[#C8A96E]/8" />
        <motion.div
          style={{ scaleY, transformOrigin: "top" }}
          className="absolute inset-0 bg-gradient-to-b from-[#C8A96E]/60 via-[#C8A96E]/40 to-[#C8A96E]/10"
        />
      </div>
    </div>
  );
}
