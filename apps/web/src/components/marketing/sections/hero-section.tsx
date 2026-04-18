"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import posthog from "posthog-js";

import { Button } from "@/components/ui/button";
import { IntelligenceDemo } from "@/components/marketing/intelligence-demo";
import { NeuralFabric } from "@/components/marketing/neural-fabric";

const GRID_BACKGROUND = {
  backgroundImage: `
    linear-gradient(to right, rgba(200, 169, 110, 0.04) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(200, 169, 110, 0.04) 1px, transparent 1px)
  `,
  backgroundSize: "80px 80px",
};

const EASE_OUT_QUINT: [number, number, number, number] = [0.25, 0.4, 0.25, 1];

export function HeroSection() {
  return (
    <section
      data-cursor-glow="true"
      className="relative z-10 px-6 lg:px-16 pt-20 pb-20 lg:pt-28 lg:pb-32 overflow-hidden"
      style={GRID_BACKGROUND}
    >
      <NeuralFabric />
      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: EASE_OUT_QUINT }}
          >
            <h1 className="text-5xl md:text-6xl lg:text-[4.5rem] font-normal tracking-tight leading-[1.05] mb-8">
              Your firm&apos;s
              <br />
              <span className="text-[#C8A96E]">private brain.</span>
            </h1>

            <p className="text-lg md:text-xl text-white/50 max-w-xl leading-relaxed mb-12">
              Every deal, every relationship, every decision &mdash; unified
              with the outside data that makes them readable. Specialized agents
              screen inbound flow, underwrite, draft memos, and surface deals
              before the rest of the market sees them &mdash; each reading from
              your firm&apos;s full history. All through email.
            </p>

            <Link
              href="/book"
              onClick={() =>
                posthog.capture("cta_clicked", {
                  cta_type: "talk_to_founders",
                  location: "hero",
                })
              }
            >
              <Button className="bg-[#C8A96E] hover:bg-[#b8952a] text-black font-semibold px-6 py-6 text-sm tracking-wide">
                Talk to founders
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: EASE_OUT_QUINT }}
          >
            <IntelligenceDemo />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
