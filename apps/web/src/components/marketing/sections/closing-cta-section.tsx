"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import posthog from "posthog-js";

import { Button } from "@/components/ui/button";
import { FadeInSection } from "@/components/marketing/fade-in-section";
import { NeuralFabric } from "@/components/marketing/neural-fabric";

const GRID_BACKGROUND = {
  backgroundImage: `
    linear-gradient(to right, rgba(200, 169, 110, 0.025) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(200, 169, 110, 0.025) 1px, transparent 1px)
  `,
  backgroundSize: "80px 80px",
};

export function ClosingCtaSection() {
  return (
    <section
      data-cursor-glow="true"
      className="relative z-10 px-6 lg:px-16 py-28 lg:py-40 border-t border-white/[0.04] overflow-hidden"
      style={GRID_BACKGROUND}
    >
      <NeuralFabric />

      {/* Soften the transition from the section above */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[#080808] via-[#080808]/80 to-transparent z-[1]" />
      {/* Fade into footer */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#080808] to-transparent z-[1]" />

      {/* Radial gold glow, pulled toward the CTA button */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="w-[900px] h-[900px] bg-[radial-gradient(circle_at_center,rgba(200,169,110,0.14),rgba(200,169,110,0.04)_40%,transparent_70%)] rounded-full blur-[40px] translate-y-20" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="max-w-5xl mx-auto">
          <FadeInSection>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight mb-8 leading-[1.1]">
              Build your firm&apos;s{" "}
              <span className="text-[#C8A96E]">institutional brain.</span>
            </h2>
            <p className="text-lg text-white/50 leading-relaxed mb-12 max-w-2xl">
              We take on a small number of engagements each quarter. If your
              firm is ready to turn decades of institutional knowledge into a
              permanent competitive advantage, we&apos;d like to talk.
            </p>
            <Link
              href="/book"
              onClick={() =>
                posthog.capture("cta_clicked", {
                  cta_type: "talk_to_founders",
                  location: "closing_cta",
                })
              }
              className="relative inline-block group"
            >
              <span className="absolute -inset-3 rounded-md bg-[#C8A96E]/25 blur-xl opacity-70 group-hover:opacity-100 transition-opacity duration-500" />
              <Button className="relative bg-[#C8A96E] hover:bg-[#b8952a] text-black font-semibold px-6 py-6 text-sm tracking-wide shadow-[0_0_30px_rgba(200,169,110,0.35)]">
                Talk to founders
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </FadeInSection>
        </div>
      </div>
    </section>
  );
}
