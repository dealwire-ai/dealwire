"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import posthog from "posthog-js";

import { Eyebrow } from "@/components/marketing/eyebrow";
import { FadeInSection } from "@/components/marketing/fade-in-section";
import { SectionShell } from "@/components/marketing/section-shell";

export function SecuritySection() {
  return (
    <SectionShell className="py-20 lg:py-24">
      <FadeInSection>
        <Eyebrow className="mb-6">Security</Eyebrow>
        <h2 className="text-3xl md:text-4xl font-normal tracking-tight mb-6 leading-[1.15]">
          Your firm&apos;s data{" "}
          <span className="text-white/30">stays your firm&apos;s.</span>
        </h2>
        <p className="text-lg text-white/50 leading-relaxed mb-8 max-w-2xl">
          Every Dealwire deployment runs on infrastructure provisioned for your
          firm alone. Your data is never mingled with another client&apos;s, and
          it is never used to train an AI model.
        </p>
        <Link
          href="/security"
          onClick={() =>
            posthog.capture("cta_clicked", {
              cta_type: "security_link",
              location: "trust_band",
            })
          }
          className="inline-flex items-center gap-2 text-sm font-mono tracking-wider text-[#C8A96E] hover:text-[#d9bb80] transition-colors"
        >
          Read our security commitments
          <ArrowRight className="w-4 h-4" />
        </Link>
      </FadeInSection>
    </SectionShell>
  );
}
