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
        className="relative z-10 px-6 lg:px-16 pt-20 pb-28 lg:pt-28 lg:pb-40"
        style={{
          backgroundImage: `
          linear-gradient(to right, rgba(200, 169, 110, 0.04) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(200, 169, 110, 0.04) 1px, transparent 1px)
        `,
          backgroundSize: "80px 80px",
        }}
      >
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.25, 0.4, 0.25, 1] }}
          >
            <h1 className="text-5xl md:text-6xl lg:text-[4.5rem] font-normal tracking-tight leading-[1.05] mb-8">
              We build your firm&apos;s
              <br />
              <span className="text-[#C8A96E]">private intelligence</span>{" "}
              layer.
            </h1>

            <p className="text-lg md:text-xl text-white/50 max-w-2xl leading-relaxed mb-12">
              Every deal your firm has ever seen, every memo ever written, every
              broker relationship ever formed &mdash; connected, queryable, and
              working for your team the moment a new deal lands. Your
              institutional knowledge stops being something only a handful of
              senior partners carry, and starts being something your whole firm
              operates on.
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
        </div>
      </section>

      {/* Logos — directly under hero */}
      <ClientLogos />

      {/* The asset nobody is using */}
      <section className="relative z-10 px-6 lg:px-16 py-24 lg:py-32 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
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
                context it already paid to learn. The knowledge exists. The firm
                just can&apos;t reach it.
              </p>
            </FadeInSection>
            <FadeInSection delay={0.15}>
              <p>
                Generic AI tools don&apos;t fix this. Plugging a chatbot into
                one inbox, one CRM, or one data room produces toy answers
                &mdash; because none of those systems, on their own, contains
                what your firm actually knows. The institutional intelligence
                only appears once the whole corpus is unified.
              </p>
            </FadeInSection>
            <FadeInSection delay={0.2}>
              <p className="text-white/80 text-xl">
                That&apos;s what we build.
              </p>
            </FadeInSection>
          </div>
        </div>
      </section>

      {/* What your firm gets */}
      <section className="relative z-10 px-6 lg:px-16 py-24 lg:py-32 border-t border-white/[0.04]">
        <div className="max-w-5xl mx-auto">
          <FadeInSection>
            <p className="text-[#C8A96E] text-xs font-mono tracking-widest uppercase mb-6">
              What your firm gets
            </p>
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-16 leading-[1.1] max-w-3xl">
              Capabilities your firm{" "}
              <span className="text-white/30">did not have before.</span>
            </h2>
          </FadeInSection>

          <div className="space-y-16">
            {[
              {
                title: "Your firm's memory, on call.",
                body: "Ask, in plain English, any question about any deal your firm has ever touched. Which broker showed you this asset in 2019, and what did you pass on. How your firm has historically underwritten distress in this submarket. Which LP questions came up the last time you raised a fund with this strategy. This used to live only in the heads of your longest-tenured partners. Now the whole firm can reach it.",
              },
              {
                title: "Patterns across your own deal flow.",
                body: "Fifteen years of deals, sitting in PDFs and inboxes, becomes a queryable record of what your firm has seen, priced, and passed. The next time a teaser lands, your team sees every comparable your firm has ever underwritten, every broker relationship you have with the seller's side, and every reason you'd have to move faster than the other twenty firms on the blast. These are analyses your team cannot currently run, at any speed.",
              },
              {
                title: "Screening and memo drafting, operationalized.",
                body: "Inbound deal flow \u2014 OMs, rent rolls, teasers \u2014 gets read against your buy box the moment it lands, and first-pass memos get drafted from the underlying documents in minutes. Your team stops triaging and starts deciding. Senior time stops going to first drafts and starts going to judgment.",
              },
            ].map((pillar, i) => (
              <FadeInSection key={pillar.title} delay={i * 0.1}>
                <div className="grid md:grid-cols-[1fr_2fr] gap-6 md:gap-16 items-start">
                  <h3 className="text-2xl md:text-3xl font-normal tracking-tight text-white/90 leading-[1.2]">
                    {pillar.title}
                  </h3>
                  <p className="text-base md:text-lg text-white/50 leading-relaxed">
                    {pillar.body}
                  </p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* How an engagement runs */}
      <section
        id="engagements"
        className="relative z-10 px-6 lg:px-16 py-24 lg:py-32 border-t border-white/[0.04]"
      >
        <div className="max-w-6xl mx-auto">
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
                body: "We build the first agents against your workflows \u2014 deal screening, memo drafting, relationship recall, market queries \u2014 and deploy them where your team already works. Analysts start answering questions the firm could not previously answer at all.",
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
      </section>

      {/* Who builds this — preserved founder + advisor section */}
      <section
        id="about"
        className="relative z-10 px-6 lg:px-16 py-20 lg:py-28 border-t border-white/[0.04]"
      >
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <p className="text-[#C8A96E] text-xs font-mono tracking-widest uppercase mb-4">
              Who builds this
            </p>
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-6">
              Built by engineers.
              <br />
              <span className="text-white/30">Backed by top operators.</span>
            </h2>
          </FadeInSection>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                name: "Isaac Levine",
                role: "Co-Founder",
                bio: "Software Engineer at CarGurus (NASDAQ: CARG), where he architects agentic AI systems at scale. Computer Science at Northeastern. Co-founded and sold frontstep.ai.",
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
                        → {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Security trust band */}
      <section className="relative z-10 px-6 lg:px-16 py-20 lg:py-24 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
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
      </section>

      {/* Closing CTA */}
      <section className="relative z-10 px-6 lg:px-16 py-24 lg:py-32 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <FadeInSection>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight mb-8 leading-[1.1]">
              Build your firm&apos;s{" "}
              <span className="text-[#C8A96E]">intelligence layer.</span>
            </h2>
            <p className="text-lg text-white/50 leading-relaxed mb-12 max-w-2xl">
              We take on a small number of engagements each quarter. If your
              firm is evaluating what AI can actually do inside institutional
              private markets, we&apos;d like to talk.
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
      </section>

      <MarketingFooter />
    </div>
  );
}
