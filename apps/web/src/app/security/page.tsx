"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import posthog from "posthog-js";

import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { FadeInSection } from "@/components/marketing/fade-in-section";

export default function SecurityPage() {
  return (
    <div className="marketing-cursor min-h-screen bg-[#080808] text-white overflow-x-hidden font-sans">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#C8A96E]/4 rounded-full blur-[180px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#C8A96E]/6 rounded-full blur-[140px] translate-y-1/2 -translate-x-1/3" />
      </div>

      <MarketingNav variant="security" />

      {/* Hero */}
      <section className="relative z-10 px-6 lg:px-16 pt-16 pb-20 lg:pt-24 lg:pb-28">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.25, 0.4, 0.25, 1] }}
          >
            <p className="text-[#C8A96E] text-xs font-mono tracking-widest uppercase mb-6">
              Security
            </p>
            <h1 className="text-5xl md:text-6xl font-normal tracking-tight leading-[1.05] mb-10">
              Built for firms whose{" "}
              <span className="text-white/30">data is the business.</span>
            </h1>
            <p className="text-lg md:text-xl text-white/50 leading-relaxed max-w-3xl">
              What flows through Dealwire is a firm&apos;s most sensitive
              material: inbound deal flow, LP communications, proprietary
              underwriting, decades of institutional knowledge. Two commitments
              underpin everything we build.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Two pillars */}
      <section className="relative z-10 px-6 lg:px-16 py-16 lg:py-20 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto space-y-16">
          <FadeInSection>
            <div className="grid md:grid-cols-[1fr_2fr] gap-6 md:gap-16 items-start">
              <h2 className="text-2xl md:text-3xl font-normal tracking-tight text-white/90 leading-[1.15]">
                Per-client isolation.
              </h2>
              <p className="text-base md:text-lg text-white/55 leading-relaxed">
                Your Dealwire is not a tenant on a shared platform. It runs on
                infrastructure we provision for your firm alone &mdash; separate
                database, separate environment, separate credentials. Your data
                is never mingled with another firm&apos;s. This is a direct
                consequence of the way we work: because every engagement is
                bespoke, isolation isn&apos;t a paid-upgrade tier, it&apos;s how
                the system is shaped from day one.
              </p>
            </div>
          </FadeInSection>

          <FadeInSection delay={0.1}>
            <div className="grid md:grid-cols-[1fr_2fr] gap-6 md:gap-16 items-start">
              <h2 className="text-2xl md:text-3xl font-normal tracking-tight text-white/90 leading-[1.15]">
                Your data never trains a model.
              </h2>
              <p className="text-base md:text-lg text-white/55 leading-relaxed">
                We do not fine-tune or train foundation models on your
                firm&apos;s data. Every model call runs under zero-retention
                enterprise terms with our AI providers. The intelligence we
                build on your corpus is yours; it does not become anyone
                else&apos;s, and it does not leak into any model anyone else
                uses.
              </p>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Further detail */}
      <section className="relative z-10 px-6 lg:px-16 py-20 lg:py-24 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <FadeInSection>
            <p className="text-[#C8A96E] text-xs font-mono tracking-widest uppercase mb-10">
              Further detail
            </p>
          </FadeInSection>

          <div className="space-y-10">
            {[
              {
                title: "Model providers.",
                body: "Inference is handled by enterprise accounts with our LLM providers, under zero-retention and no-training terms. Specific providers, model versions, and terms are available under NDA.",
              },
              {
                title: "Sub-processors.",
                body: "A current list of sub-processors (hosting, observability, email-provider integrations) is available under NDA.",
              },
              {
                title: "Data residency.",
                body: "Deployments can be shaped to your firm's residency requirements. Where region constraints apply, we provision your data layer in the region you specify.",
              },
              {
                title: "Access controls.",
                body: "SSO via your identity provider. Role-based access within the Dealwire system, scoped to your firm's existing access patterns. Engineering access to client environments is logged and auditable.",
              },
              {
                title: "Incident response.",
                body: "Defined notification timelines and a named point of contact for each engagement. Specifics provided as part of contracting.",
              },
              {
                title: "Compliance roadmap.",
                body: "SOC 2 Type II is on our roadmap; if you require it before engagement, tell us \u2014 we can share current status under NDA.",
              },
            ].map((item, i) => (
              <FadeInSection key={item.title} delay={i * 0.05}>
                <div className="grid md:grid-cols-[1fr_2fr] gap-4 md:gap-12 items-start border-t border-white/[0.04] pt-8">
                  <h3 className="text-base font-medium text-white/85 tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-sm md:text-base text-white/50 leading-relaxed">
                    {item.body}
                  </p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 lg:px-16 py-20 lg:py-28 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <FadeInSection>
            <h2 className="text-3xl md:text-4xl font-normal tracking-tight mb-8 leading-[1.15]">
              Need more?{" "}
              <span className="text-white/30">
                Request our security diligence pack.
              </span>
            </h2>
            <p className="text-lg text-white/50 leading-relaxed mb-12 max-w-2xl">
              For procurement, legal, or IT review: a full diligence pack
              covering model providers, sub-processors, data handling, and
              incident response is available under NDA.
            </p>
            <a
              href="mailto:noah@dealwire.ai?subject=Security%20diligence%20pack%20request"
              onClick={() =>
                posthog.capture("cta_clicked", {
                  cta_type: "request_diligence_pack",
                  location: "security_page",
                })
              }
            >
              <Button className="bg-[#C8A96E] hover:bg-[#d9bb80] text-black font-semibold px-6 py-6 text-sm tracking-wide">
                Request security diligence pack
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </a>
          </FadeInSection>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
