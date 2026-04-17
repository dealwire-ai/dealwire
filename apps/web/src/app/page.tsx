"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Linkedin, Mail, Sparkles, ArrowRight } from "lucide-react";
import posthog from "posthog-js";

import { ClientLogos } from "@/components/client-logos";
import { Button } from "@/components/ui/button";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { FadeInSection } from "@/components/marketing/fade-in-section";
import { IntelligenceDemo } from "@/components/marketing/intelligence-demo";
import { NeuralFabric } from "@/components/marketing/neural-fabric";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden font-sans">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#C8A96E]/4 rounded-full blur-[180px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#C8A96E]/6 rounded-full blur-[140px] translate-y-1/2 -translate-x-1/3" />
      </div>

      <MarketingNav variant="home" />

      {/* Hero */}
      <section
        className="relative z-10 px-6 lg:px-16 pt-20 pb-20 lg:pt-28 lg:pb-32 overflow-hidden"
        style={{
          backgroundImage: `
          linear-gradient(to right, rgba(200, 169, 110, 0.04) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(200, 169, 110, 0.04) 1px, transparent 1px)
        `,
          backgroundSize: "80px 80px",
        }}
      >
        <NeuralFabric />
        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left: Copy */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <h1 className="text-5xl md:text-6xl lg:text-[4.5rem] font-normal tracking-tight leading-[1.05] mb-8">
                Your firm&apos;s
                <br />
                <span className="text-[#C8A96E]">private brain.</span>
              </h1>

              <p className="text-lg md:text-xl text-white/50 max-w-xl leading-relaxed mb-12">
                Every deal, every relationship, every decision &mdash; unified
                with the outside data that makes them readable. Specialized
                agents screen inbound flow, underwrite, draft memos, and surface
                deals before the rest of the market sees them &mdash; each
                reading from your firm&apos;s full history. All through email.
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

            {/* Right: Intelligence Demo */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.8,
                delay: 0.3,
                ease: [0.25, 0.4, 0.25, 1],
              }}
            >
              <IntelligenceDemo />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Logos */}
      <ClientLogos />

      {/* The asset nobody is using */}
      <section className="relative z-10 px-6 lg:px-16 py-24 lg:py-32 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-5xl mx-auto">
            <FadeInSection>
              <p className="text-[#C8A96E] text-xs font-mono tracking-widest uppercase mb-6">
                The asset nobody is using
              </p>
              <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-10 leading-[1.1]">
                Your firm&apos;s most valuable asset is already{" "}
                <span className="text-white/30">inside your firm.</span>
              </h2>
            </FadeInSection>

            <div className="space-y-8 text-lg text-white/55 leading-relaxed max-w-3xl">
              <FadeInSection delay={0.05}>
                <p>
                  Twenty years of deal flow. Every memo, every IC discussion,
                  every broker relationship, every rent roll, every comp, every
                  call that was right, every call that was wrong. It sits in
                  Outlook threads, PDF attachments, SharePoint folders, and the
                  heads of your longest-tenured partners.
                </p>
              </FadeInSection>
              <FadeInSection delay={0.1}>
                <p>
                  When a senior partner retires, most of it walks out the door.
                  When a new deal lands on a Tuesday morning, the firm reinvents
                  context it already paid to learn.
                </p>
              </FadeInSection>
              <FadeInSection delay={0.15}>
                <p>
                  Generic AI tools don&apos;t fix this. Plugging a chatbot into
                  one inbox or one data room produces toy answers &mdash;
                  because the institutional intelligence only appears once the
                  whole corpus is unified.
                </p>
              </FadeInSection>
              <FadeInSection delay={0.2}>
                <p className="text-white/80 text-xl">
                  That&apos;s what we build.
                </p>
              </FadeInSection>
            </div>
          </div>
        </div>
      </section>

      {/* The Intelligence Layer — Five Layers */}
      <section className="relative z-10 px-6 lg:px-16 py-24 lg:py-32 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-5xl mx-auto">
            <FadeInSection>
              <p className="text-[#C8A96E] text-xs font-mono tracking-widest uppercase mb-6">
                The intelligence layer
              </p>
              <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-16 leading-[1.1] max-w-4xl">
                Everything an analyst does.{" "}
                <span className="text-white/30">
                  Nothing an analyst forgets.
                </span>
              </h2>
            </FadeInSection>

            <div className="space-y-12">
              {[
                {
                  num: "01",
                  title: "Captures the firm.",
                  body: "Every deal, every email, every broker interaction, every screening decision, every underwriting run \u2014 ingested automatically. Zero data entry. Within weeks of deployment, your firm\u2019s complete institutional knowledge lives in one system.",
                },
                {
                  num: "02",
                  title: "Connects the dots.",
                  body: "Every new opportunity is cross-referenced against your firm\u2019s full corpus. \u201CThis deal is in the same submarket where you closed 3 deals last year. The broker has sent you 12 deals \u2014 2 made it to LOI. Your investor Group B expressed interest in this market. Cap rates have compressed 30bps since Q3.\u201D The context a senior partner would surface, surfaced automatically.",
                },
                {
                  num: "03",
                  title: "Acts on your pipeline.",
                  body: "Screens inbound flow against your buy box. Underwrites opportunities. Drafts IC memos. Composes broker replies. Follows up, reminds, alerts. The analyst work happens around the clock \u2014 freeing your team for the decisions only they can make.",
                },
                {
                  num: "04",
                  title: "Sources what others can\u2019t see.",
                  body: "Tax lien lists, lis pendens filings, code violations, distress signals buried in public records. Properties surface before they\u2019re listed; owners surface before they\u2019re sellers. Your team lands first in line on deals the rest of the market never sees.",
                },
                {
                  num: "05",
                  title: "Compounds with use.",
                  body: "Every screened deal, every decision, every outcome sharpens the system \u2014 until it reads your firm\u2019s taste better than any new hire ever could.",
                },
              ].map((layer, i) => (
                <FadeInSection key={layer.num} delay={i * 0.06}>
                  <div className="grid md:grid-cols-[1fr_2fr] gap-4 md:gap-12 items-baseline">
                    <div className="flex items-baseline gap-4">
                      <span className="text-[#C8A96E]/50 font-mono text-xs">
                        {layer.num}
                      </span>
                      <h3 className="text-xl md:text-2xl font-normal tracking-tight text-white/90 leading-[1.2]">
                        {layer.title}
                      </h3>
                    </div>
                    <p className="text-base text-white/45 leading-relaxed">
                      {layer.body}
                    </p>
                  </div>
                </FadeInSection>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Compounding Intelligence */}
      <section className="relative z-10 px-6 lg:px-16 py-24 lg:py-32 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-5xl mx-auto">
            <FadeInSection>
              <p className="text-[#C8A96E] text-xs font-mono tracking-widest uppercase mb-6">
                Compounding intelligence
              </p>
              <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-6 leading-[1.1]">
                Your proprietary{" "}
                <span className="text-white/30">data asset.</span>
              </h2>
              <p className="text-lg text-white/50 leading-relaxed mb-16 max-w-2xl">
                Every month your firm uses Dealwire, the intelligence deepens.
                After 12 months, you&apos;ve built something no competitor can
                buy, copy, or replicate.
              </p>
            </FadeInSection>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
              {[
                {
                  label: "Month 1",
                  body: "Your firm\u2019s complete deal history and email archive become searchable for the first time.",
                },
                {
                  label: "Month 3",
                  body: "Agents autonomously screen, underwrite, and respond to inbound deal flow. First-pass memos draft themselves.",
                },
                {
                  label: "Month 6",
                  body: "Your institutional knowledge \u2014 every deal, relationship, and decision \u2014 is a queryable competitive advantage.",
                },
                {
                  label: "Month 12",
                  body: "Your firm has built a proprietary data asset no competitor can replicate. Your deal history, relationship graph, market intelligence, and screening patterns all live in one system. Switching costs are astronomical.",
                  final: true,
                },
              ].map((milestone, i) => (
                <FadeInSection
                  key={milestone.label}
                  delay={i * 0.08}
                  className="h-full"
                >
                  <div className="h-full flex flex-col">
                    <div className="flex items-center gap-3 mb-4">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          (milestone as { final?: boolean }).final
                            ? "bg-[#C8A96E]"
                            : "bg-[#C8A96E]/40"
                        }`}
                      />
                      <span className="text-sm font-mono text-[#C8A96E]/60">
                        {milestone.label}
                      </span>
                    </div>
                    <p className="text-sm text-white/45 leading-relaxed">
                      {milestone.body}
                    </p>
                  </div>
                </FadeInSection>
              ))}
            </div>

            <FadeInSection delay={0.4}>
              <p className="text-xl text-white/65 max-w-2xl mt-16 leading-relaxed">
                This isn&apos;t software your firm subscribes to. It&apos;s
                infrastructure your firm cannot operate without.
              </p>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* How an engagement runs */}
      <section
        id="engagements"
        className="relative z-10 px-6 lg:px-16 py-24 lg:py-32 border-t border-white/[0.04]"
      >
        <div className="max-w-7xl mx-auto">
          <div className="max-w-5xl mx-auto">
            <FadeInSection>
              <p className="text-[#C8A96E] text-xs font-mono tracking-widest uppercase mb-6">
                Engagements
              </p>
              <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-16 leading-[1.1]">
                How an engagement runs.
              </h2>
            </FadeInSection>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
              {[
                {
                  step: "01",
                  title: "Mapping",
                  body: "We spend the first week inside your firm \u2014 reading memos, sitting on IC, shadowing acquisitions. You walk away with a concrete plan naming the intelligence gaps that are costing your team deals, and what we\u2019ll build to close them.",
                },
                {
                  step: "02",
                  title: "Unification",
                  body: "We provision your private data layer and ingest the sources that matter: email, CRM, diligence archives, underwriting models, market data, public records. Within weeks, your firm\u2019s full corpus becomes searchable for the first time.",
                },
                {
                  step: "03",
                  title: "Agents",
                  body: "We build the first agents against your workflows \u2014 deal screening, underwriting, memo drafting, relationship recall, market queries \u2014 and deploy them where your team already works. Analysts start answering questions the firm could not previously answer at all.",
                },
                {
                  step: "04",
                  title: "Operation",
                  body: "We stay embedded. New questions, new data sources, new capabilities ship continuously. Every month your firm\u2019s intelligence layer gets sharper, and the compounding advantage it produces is one your competitors can\u2019t buy off a shelf.",
                },
              ].map((phase, i) => (
                <FadeInSection
                  key={phase.step}
                  delay={i * 0.08}
                  className="h-full"
                >
                  <div className="h-full flex flex-col">
                    <p className="text-[#C8A96E]/60 text-xs font-mono tracking-widest mb-4">
                      {phase.step}
                    </p>
                    <h3 className="text-xl font-medium mb-4 text-white/90">
                      {phase.title}
                    </h3>
                    <p className="text-white/45 leading-relaxed text-sm">
                      {phase.body}
                    </p>
                  </div>
                </FadeInSection>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Who builds this */}
      <section
        id="about"
        className="relative z-10 px-6 lg:px-16 py-20 lg:py-28 border-t border-white/[0.04]"
      >
        <div className="max-w-7xl mx-auto">
          <div className="max-w-5xl mx-auto">
            <FadeInSection>
              <p className="text-[#C8A96E] text-xs font-mono tracking-widest uppercase mb-4">
                Team
              </p>
              <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-6">
                Engineers backed by
                <br />
                <span className="text-white/30">veteran CRE operators.</span>
              </h2>
            </FadeInSection>

            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  name: "Isaac Levine",
                  role: "Co-Founder",
                  bio: "Software Engineer at CarGurus (NASDAQ: CARG), where he builds high-throughput data systems processing hundreds of millions of inventory updates daily. Computer Science at Northeastern. Co-founded and sold frontstep.ai.",
                  linkedin: "https://www.linkedin.com/in/isaac-levine/",
                  email: "isaac@dealwire.ai",
                  headshot: "/headshots/isaac.webp",
                },
                {
                  name: "Noah Weinstein",
                  role: "Co-Founder",
                  bio: "Former Software Engineer at Flexcar and Technical Product Manager at Siphox, a venture-backed health tech startup. Computer Science at Northeastern. Co-founded and sold frontstep.ai.",
                  linkedin: "https://www.linkedin.com/in/noahweinstein/",
                  email: "noah@dealwire.ai",
                  headshot: "/headshots/noah.webp",
                },
              ].map((founder, index) => (
                <FadeInSection
                  key={index}
                  delay={index * 0.15}
                  className="h-full"
                >
                  <div className="relative group h-full">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#C8A96E]/8 to-transparent rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative h-full p-8 lg:p-10 bg-white/[0.015] border border-white/[0.06] rounded-sm group-hover:border-[#C8A96E]/20 transition-colors duration-300">
                      <div className="flex items-start justify-between mb-6">
                        <div className="relative w-14 h-14 rounded-sm overflow-hidden border border-[#C8A96E]/15">
                          <Image
                            src={founder.headshot}
                            alt={founder.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={founder.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() =>
                              posthog.capture("founder_linkedin_clicked", {
                                founder_name: founder.name,
                              })
                            }
                            className="p-2 bg-white/[0.04] rounded-sm hover:bg-white/8 transition-colors"
                          >
                            <Linkedin className="w-4 h-4 text-white/40" />
                          </a>
                          <a
                            href={`mailto:${founder.email}`}
                            onClick={() =>
                              posthog.capture("founder_email_clicked", {
                                founder_name: founder.name,
                                email: founder.email,
                              })
                            }
                            className="p-2 bg-white/[0.04] rounded-sm hover:bg-white/8 transition-colors"
                          >
                            <Mail className="w-4 h-4 text-white/40" />
                          </a>
                        </div>
                      </div>
                      <h3 className="text-lg font-medium mb-1 text-white/90">
                        {founder.name}
                      </h3>
                      <p className="text-[#C8A96E] text-xs font-mono tracking-widest uppercase mb-4">
                        {founder.role}
                      </p>
                      <p className="text-white/38 leading-relaxed text-sm">
                        {founder.bio}
                      </p>
                    </div>
                  </div>
                </FadeInSection>
              ))}
            </div>

            {/* Strategic Advisors */}
            <FadeInSection delay={0.3}>
              <p className="text-[#C8A96E] text-xs font-mono tracking-widest uppercase mb-4 mt-20">
                Strategic Advisors
              </p>
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  {
                    name: "David Shorenstein",
                    role: "Advisor",
                    headshot: "/headshots/david.png",
                    linkedin: "https://www.linkedin.com/in/davidshorenstein/",
                    bio: "Principal at Hildreth Real Estate Advisors. Co-founded Silvershore Properties, assembling a $300M+ NYC portfolio across 250+ assets. Former CIO at Forrest Shorenstein Capital Partners. $250M+ in sales at Marcus & Millichap.",
                  },
                  {
                    name: "Jordan Karlik",
                    role: "Advisor",
                    headshot: "/headshots/jordan.jpeg",
                    linkedin:
                      "https://www.linkedin.com/in/jordan-karlik-b546b83/",
                    bio: "Principal at JK Equities. Started at Deutsche Bank and Ernst & Young in CMBS. JK Equities has owned, operated, and developed nearly $2B in property across 15+ states.",
                  },
                ].map((advisor, index) => (
                  <div key={index} className="relative group h-full">
                    <div className="absolute inset-0 bg-gradient-to-br from-[#C8A96E]/6 to-transparent rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="relative h-full p-6 bg-white/[0.015] border border-white/[0.06] rounded-sm group-hover:border-[#C8A96E]/20 transition-colors duration-300">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="relative w-11 h-11 rounded-sm overflow-hidden border border-[#C8A96E]/15 shrink-0">
                            <Image
                              src={advisor.headshot}
                              alt={advisor.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-white/90">
                              {advisor.name}
                            </h3>
                            <p className="text-[#C8A96E] text-xs font-mono tracking-widest uppercase">
                              {advisor.role}
                            </p>
                          </div>
                        </div>
                        <a
                          href={advisor.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() =>
                            posthog.capture("founder_linkedin_clicked", {
                              founder_name: advisor.name,
                              role: "advisor",
                            })
                          }
                          className="p-2 bg-white/[0.04] rounded-sm hover:bg-white/8 transition-colors shrink-0"
                        >
                          <Linkedin className="w-4 h-4 text-white/35" />
                        </a>
                      </div>
                      <p className="text-white/35 text-sm leading-relaxed">
                        {advisor.bio}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </FadeInSection>

            <FadeInSection delay={0.4}>
              <div className="mt-10 p-8 lg:p-10 bg-[#C8A96E]/[0.04] border border-[#C8A96E]/12 rounded-sm">
                <div className="flex max-lg:flex-col items-center max-lg:items-start gap-6 lg:gap-12">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#C8A96E]/10 border border-[#C8A96E]/20 rounded-sm flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-[#C8A96E]" />
                    </div>
                    <div>
                      <p className="text-xs text-white/25 font-mono tracking-wider uppercase mb-0.5">
                        Previously built
                      </p>
                      <p className="text-base font-medium text-white/85">
                        frontstep.ai
                      </p>
                    </div>
                  </div>
                  <div className="lg:border-l lg:border-white/[0.06] lg:pl-12">
                    <p className="text-white/38 leading-relaxed text-sm mb-4">
                      Built in 3 months. Won a cash prize at Northeastern&apos;s
                      startup competition. Acquired within months of launch. The
                      platform automatically qualified thousands of renters.
                    </p>
                    <div className="flex flex-wrap gap-x-6 gap-y-1">
                      {[
                        "Built in 3 months",
                        "Northeastern startup prize winner",
                        "Acquired post-launch",
                        "Thousands of renters qualified",
                      ].map((tag) => (
                        <span
                          key={tag}
                          className="text-xs font-mono text-[#C8A96E]/45 tracking-wider"
                        >
                          &rarr; {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* Security trust band */}
      <section className="relative z-10 px-6 lg:px-16 py-20 lg:py-24 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-5xl mx-auto">
            <FadeInSection>
              <p className="text-[#C8A96E] text-xs font-mono tracking-widest uppercase mb-6">
                Security
              </p>
              <h2 className="text-3xl md:text-4xl font-normal tracking-tight mb-6 leading-[1.15]">
                Your firm&apos;s data{" "}
                <span className="text-white/30">stays your firm&apos;s.</span>
              </h2>
              <p className="text-lg text-white/50 leading-relaxed mb-8 max-w-2xl">
                Every Dealwire deployment runs on infrastructure provisioned for
                your firm alone. Your data is never mingled with another
                client&apos;s, and it is never used to train an AI model.
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
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative z-10 px-6 lg:px-16 py-24 lg:py-32 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
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
              >
                <Button className="bg-[#C8A96E] hover:bg-[#b8952a] text-black font-semibold px-6 py-6 text-sm tracking-wide">
                  Talk to founders
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </FadeInSection>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
