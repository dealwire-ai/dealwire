"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

const responseItems = [
  {
    label: "Screening",
    content: "Midtown office, $150\u2013250M, stabilized. Buy box match.",
    accent: true,
  },
  {
    label: "Broker Intel",
    content:
      "Eastdil has sent your firm 23 deals since 2021. 4 reached LOI. Marcus Chen specifically \u2014 8 deals, 35% hit rate.",
  },
  {
    label: "Firm History",
    content:
      "Your firm underwrote this asset Q3 2019 at $165M \u2014 passed on retail basis risk. Corridor vacancy since dropped 18% \u2192 6%.",
  },
  {
    label: "Market",
    content:
      "Cap rate at ask: 5.2%. Your last 3 Midtown bids averaged 5.45%. Submarket rents +12% YoY.",
  },
  {
    label: "Actions Taken",
    content:
      "IC memo drafted. Broker reply composed. David flagged \u2014 LP Group B expressed Midtown office interest this quarter.",
    accent: true,
  },
];

export function IntelligenceDemo() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  return (
    <div ref={ref} className="relative">
      {/* Outer glow */}
      <div className="absolute -inset-1 bg-gradient-to-b from-[#C8A96E]/15 via-[#C8A96E]/5 to-transparent rounded-lg blur-md opacity-60" />

      <div className="relative bg-[#0c0c0c] border border-white/[0.08] rounded-lg overflow-hidden shadow-2xl">
        {/* Window chrome */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.06]">
          <div className="w-2 h-2 rounded-full bg-white/10" />
          <div className="w-2 h-2 rounded-full bg-white/10" />
          <div className="w-2 h-2 rounded-full bg-white/10" />
          <span className="ml-auto text-[10px] font-mono text-white/20">
            via email
          </span>
        </div>

        {/* Forwarded email */}
        <div className="px-5 py-4 border-b border-white/[0.06] bg-white/[0.015]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-mono text-white/25">
              to: dealwire@yourfirm.com
            </span>
            <span className="text-[11px] font-mono text-white/20">
              11:42 AM
            </span>
          </div>
          <p className="text-sm text-white/70 font-medium mb-1">
            FW: 450 Park Ave &mdash; Eastdil Offering Memorandum
          </p>
          <p className="text-xs text-white/35 leading-relaxed">
            Just got this from Marcus at Eastdil. $180M ask, Midtown office.
            Worth a look?
          </p>
        </div>

        {/* Dealwire response */}
        <div className="px-5 py-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ delay: 1.2, duration: 0.4 }}
            className="flex items-center gap-2 mb-3"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-[#C8A96E]" />
            <span className="text-[11px] font-mono text-[#C8A96E]/60 tracking-wide">
              Analysis complete &middot; 4.2s
            </span>
          </motion.div>

          <div className="space-y-2">
            {responseItems.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 10 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{
                  delay: 1.5 + i * 0.2,
                  duration: 0.45,
                  ease: [0.25, 0.4, 0.25, 1],
                }}
              >
                <div
                  className={`px-3 py-2.5 rounded border ${
                    item.accent
                      ? "bg-[#C8A96E]/[0.05] border-[#C8A96E]/12"
                      : "bg-white/[0.015] border-white/[0.04]"
                  }`}
                >
                  <span className="text-[10px] font-mono tracking-[0.15em] uppercase text-[#C8A96E]/45 block mb-1">
                    {item.label}
                  </span>
                  <p className="text-xs text-white/50 leading-relaxed">
                    {item.content}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
