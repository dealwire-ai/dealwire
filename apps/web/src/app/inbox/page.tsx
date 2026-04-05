"use client";

import React, { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ClientLogos } from "@/components/client-logos";
import { motion, useInView } from "framer-motion";
import {
  Sparkles,
  Linkedin,
  Mail,
  ArrowRight,
  Search,
  Brain,
  FileText,
  Database,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { DealFlowTicker } from "../../components/deal-flow-ticker";
import { useAuth, useClerk } from "@clerk/nextjs";
import posthog from "posthog-js";

// Signal wave logo mark — flat baseline with one surgical spike
function SignalMark({ className }: { className?: string }) {
  return (
    <svg
      width="36"
      height="22"
      viewBox="0 0 36 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M0 11 H12 L14 3 L16 19 L18 3 L20 11 H36"
        stroke="#C8A96E"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const FadeInSection = ({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.8, delay, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
};

export default function InboxPage() {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden font-sans">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#C8A96E]/4 rounded-full blur-[180px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#C8A96E]/6 rounded-full blur-[140px] translate-y-1/2 -translate-x-1/3" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 px-6 lg:px-16 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SignalMark />
            <span className="text-base font-medium tracking-tight text-white/90">
              Dealwire
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {[
              { label: "Services", id: "services" },
              { label: "How It Works", id: "how-it-works" },
              { label: "About", id: "about" },
            ].map(({ label, id }) => (
              <button
                key={id}
                onClick={() => {
                  posthog.capture("nav_section_clicked", {
                    section: id,
                    page: "inbox",
                  });
                  document
                    .getElementById(id)
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-xs font-mono tracking-widest uppercase text-white/40 hover:text-white/80 transition-colors cursor-pointer"
              >
                {label}
              </button>
            ))}
            <Link
              href="/"
              className="text-xs font-mono tracking-widest uppercase text-white/40 hover:text-white/80 transition-colors"
            >
              Deal Intelligence
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {isSignedIn ? (
              <>
                <Link
                  href="/dashboard"
                  onClick={() =>
                    posthog.capture("cta_clicked", {
                      cta_type: "go_to_dashboard",
                      location: "header",
                      page: "inbox",
                    })
                  }
                >
                  <Button className="bg-white/5 hover:bg-white/8 border border-white/10 text-white font-medium px-5 text-sm">
                    Dashboard
                  </Button>
                </Link>
                <Button
                  className="bg-white/5 hover:bg-white/8 border border-white/10 text-white font-medium px-5 text-sm"
                  onClick={() => {
                    posthog.capture("cta_clicked", {
                      cta_type: "sign_out",
                      location: "header",
                      page: "inbox",
                    });
                    posthog.reset();
                    signOut();
                  }}
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <Link
                href="/sign-in"
                onClick={() =>
                  posthog.capture("cta_clicked", {
                    cta_type: "sign_in",
                    location: "header",
                    page: "inbox",
                  })
                }
              >
                <Button className="bg-white/5 hover:bg-white/8 border border-white/10 text-white font-medium px-5 text-sm">
                  Sign In
                </Button>
              </Link>
            )}
            <Link
              href="/book"
              onClick={() =>
                posthog.capture("cta_clicked", {
                  cta_type: "lets_talk",
                  location: "header",
                  page: "inbox",
                })
              }
            >
              <Button className="bg-[#C8A96E] hover:bg-[#b8952a] text-black font-semibold px-5 text-sm">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section
        className="relative z-10 px-6 lg:px-16 pt-16 pb-24 lg:pt-24 lg:pb-36"
        style={{
          backgroundImage: `
          linear-gradient(to right, rgba(200, 169, 110, 0.04) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(200, 169, 110, 0.04) 1px, transparent 1px)
        `,
          backgroundSize: "80px 80px",
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Copy */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.25, 0.4, 0.25, 1] }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#C8A96E]/8 border border-[#C8A96E]/20 rounded-sm mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-[#C8A96E] animate-pulse" />
                <span className="text-xs font-mono text-[#C8A96E]/80 tracking-wider uppercase">
                  Inbox Intelligence · Live
                </span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-[4.5rem] font-normal tracking-tight leading-[1.0] mb-6">
                Your inbox is a
                <br />
                <span className="text-[#C8A96E]">untapped asset.</span>
                <br />
              </h1>

              <p className="text-lg text-white/45 max-w-lg leading-relaxed mb-10">
                Sales comps, underwriting assumptions, rent rolls, LOIs — the
                most valuable data in CRE is buried in email threads and
                attachments. Dead intelligence. We turn it into a structured,
                searchable asset that compounds with every deal.
              </p>

              <Link
                href="/book"
                onClick={() =>
                  posthog.capture("cta_clicked", {
                    cta_type: "get_started",
                    location: "hero",
                    page: "inbox",
                  })
                }
              >
                <Button
                  size="lg"
                  className="bg-[#C8A96E] hover:bg-[#b8952a] text-black font-semibold px-8 h-14 text-base"
                >
                  See What&apos;s In Your Inbox
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>

              <div className="mt-8">
                <DealFlowTicker />
              </div>
            </motion.div>

            {/* Right: Terminal widget */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 1,
                delay: 0.3,
                ease: [0.25, 0.4, 0.25, 1],
              }}
              className="hidden lg:block"
            >
              <div
                className="relative p-[1px] rounded-sm"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(200,169,110,0.25), rgba(200,169,110,0.04))",
                }}
              >
                <div className="bg-[#050505] rounded-sm p-6 font-mono text-xs">
                  {/* Terminal header bar */}
                  <div className="flex items-center justify-between mb-5 pb-4 border-b border-[#C8A96E]/10">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C8A96E] animate-pulse" />
                      <span className="text-[#C8A96E]/50 tracking-widest uppercase text-[10px]">
                        Inbox Agent · Scanning
                      </span>
                    </div>
                    <span className="text-white/15 text-[10px]">
                      03/12/2026 · 06:01 AM
                    </span>
                  </div>

                  {/* Agent activity log */}
                  <div className="space-y-3.5">
                    {[
                      {
                        time: "06:00",
                        agent: "SCAN",
                        action: "52 new emails ingested from Outlook",
                        result:
                          "8 deal emails identified · 14 attachments queued",
                        status: "text-[#C8A96E]",
                      },
                      {
                        time: "06:01",
                        agent: "EXTRACT",
                        action: "Parsing 247-unit OM from CBRE (PDF, 84 pages)",
                        result:
                          "T-12, rent roll, unit mix, and tax history extracted",
                        status: "text-[#C8A96E]",
                      },
                      {
                        time: "06:01",
                        agent: "EXTRACT",
                        action: "Processing Excel model from JLL broker thread",
                        result: "Cap rate, NOI, and debt assumptions captured",
                        status: "text-[#C8A96E]",
                      },
                      {
                        time: "06:02",
                        agent: "STRUCTURE",
                        action: "Indexing extracted data into deal database",
                        result: "3 new comps added · 2 existing deals updated",
                        status: "text-[#C8A96E]",
                      },
                      {
                        time: "06:02",
                        agent: "INTEL",
                        action:
                          "Cross-referencing against 1,847 historical deals",
                        result: "Flagged: asking cap 50bps below submarket avg",
                        status: "text-[#C8A96E]",
                      },
                    ].map(({ time, agent, action, result, status }) => (
                      <div
                        key={`${time}-${agent}-${action}`}
                        className="space-y-0.5"
                      >
                        <div className="flex items-baseline gap-3">
                          <span className="text-white/20 text-[10px] tabular-nums">
                            {time}
                          </span>
                          <span
                            className={`${status} text-[10px] tracking-widest`}
                          >
                            {agent}
                          </span>
                        </div>
                        <p className="text-white/55 pl-[42px]">{action}</p>
                        <p className="text-white/25 pl-[42px]">{result}</p>
                      </div>
                    ))}
                  </div>

                  {/* Status */}
                  <div className="pt-4 mt-4 border-t border-[#C8A96E]/10">
                    <p className="text-[#C8A96E] font-medium mb-1">
                      → 1,847 DEALS INDEXED · 23,419 DATA POINTS EXTRACTED
                    </p>
                    <p className="text-white/20">
                      Next scan: 12:00 PM · 0 errors · uptime 99.97%
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Logos Section */}
      <ClientLogos />

      {/* The Problem Section */}
      <section
        id="problem"
        className="relative z-10 px-6 lg:px-16 py-20 lg:py-28 border-t border-white/[0.04]"
      >
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <p className="text-[#C8A96E] text-xs font-mono tracking-widest uppercase mb-4">
              The Reality
            </p>
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-6 max-w-3xl">
              The best deal data in CRE
              <br />
              <span className="text-white/30">is dying in your inbox.</span>
            </h2>
          </FadeInSection>

          <div className="grid md:grid-cols-2 gap-3 mt-12">
            {[
              {
                num: "01",
                title: "Data dies in email",
                body: "Every OM, rent roll, and broker comp that hits your inbox becomes a dead file. Nobody extracts it. Nobody indexes it. Six months later, you're re-underwriting from scratch because nobody can find the T-12 from that thread in September.",
              },
              {
                num: "02",
                title: "Manual extraction kills speed",
                body: "Your analysts spend hours pulling numbers out of PDFs and pasting them into Excel. By the time the model is built, three other groups have already submitted LOIs. The bottleneck isn't analysis — it's extraction.",
              },
              {
                num: "03",
                title: "No institutional memory",
                body: "When an analyst leaves, their inbox goes with them. Every comp they tracked, every broker relationship signal, every underwriting assumption — gone. Your firm's knowledge resets with every departure.",
              },
              {
                num: "04",
                title: "Comps are scattered, not searchable",
                body: "You've seen hundreds of deals. The data exists — somewhere across thousands of emails, attachments, and spreadsheets. But there's no way to query it. \"What were cap rates for 200+ unit multifamily in Dallas last year?\" should be a 5-second answer. It's not.",
              },
            ].map(({ num, title, body }, index) => (
              <FadeInSection key={num} delay={index * 0.1}>
                <div className="p-8 bg-white/[0.015] border border-white/[0.06] rounded-sm hover:border-[#C8A96E]/20 transition-colors duration-300">
                  <div className="text-4xl font-mono text-white/8 mb-4">
                    {num}
                  </div>
                  <h3 className="text-base font-medium mb-3 text-white/90">
                    {title}
                  </h3>
                  <p className="text-white/40 leading-relaxed text-sm">
                    {body}
                  </p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Value Proposition Section */}
      <section className="relative z-10 px-6 lg:px-16 py-20 lg:py-28 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <div className="max-w-3xl">
              <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-6">
                Turn dead emails into
                <br />
                <span className="text-white/30">a living database.</span>
              </h2>
              <p className="text-white/40 text-lg leading-relaxed mb-12">
                Every deal email that hits your inbox gets automatically
                scanned, extracted, and structured. Attachments parsed. Comps
                indexed. Assumptions captured. Your inbox becomes a searchable
                deal intelligence layer that gets smarter with every email.
              </p>
            </div>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-3 mt-8">
            {[
              {
                value: "100%",
                label: "Capture rate",
                desc: "Every deal email, every attachment, every data point — automatically extracted and structured. Nothing slips through.",
              },
              {
                value: "24 / 7",
                label: "Automatic organization",
                desc: "Every deal email, attachment, and data point — filed, tagged, and structured around the clock. No manual sorting.",
              },
              {
                value: "∞",
                label: "Institutional memory",
                desc: "Every deal your firm has ever seen, searchable and queryable. Knowledge that compounds, never leaves.",
              },
            ].map((stat, index) => (
              <FadeInSection key={index} delay={index * 0.1} className="h-full">
                <div className="h-full p-7 bg-white/[0.015] border border-white/[0.06] rounded-sm hover:border-[#C8A96E]/20 transition-colors duration-300">
                  <div className="text-4xl font-mono text-white/85 mb-2 tracking-tight">
                    {stat.value}
                  </div>
                  <div className="text-[#C8A96E] text-xs font-mono tracking-widest uppercase mb-3">
                    {stat.label}
                  </div>
                  <div className="text-white/35 text-sm leading-relaxed">
                    {stat.desc}
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section
        id="services"
        className="relative z-10 px-6 lg:px-16 py-20 lg:py-28 border-t border-white/[0.04]"
      >
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <p className="text-[#C8A96E] text-xs font-mono tracking-widest uppercase mb-4">
              Capabilities
            </p>
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-6">
              Everything your inbox knows,
              <br />
              <span className="text-white/30">structured and searchable.</span>
            </h2>
          </FadeInSection>

          <div className="space-y-2 mt-12">
            {[
              {
                icon: Mail,
                title: "Email Monitoring & Triage",
                tagline: "Always scanning.",
                description:
                  "Connects to your Outlook or Gmail inbox and continuously monitors for deal-related emails. Automatically identifies OMs, teasers, LOIs, broker comps, and financials — no rules to configure. The agent learns what matters to your firm.",
              },
              {
                icon: FileText,
                title: "Attachment Extraction",
                tagline: "PDFs and models, parsed.",
                description:
                  "Reads every attachment — offering memorandums, rent rolls, T-12s, pro formas, Excel models, broker comp reports. Extracts the key numbers, assumptions, and deal terms into structured data. 84-page OM? Two minutes.",
              },
              {
                icon: Database,
                title: "Deal Data Structuring",
                tagline: "From email to database.",
                description:
                  "Every extracted data point gets normalized, tagged, and stored in a structured deal database. Property type, geography, unit count, cap rate, NOI, rent per unit, vintage — all queryable. Your inbox becomes a comp database.",
              },
              {
                icon: Search,
                title: "Searchable Comp Intelligence",
                tagline: "Ask anything.",
                description:
                  'Query your deal history in natural language. "Show me all multifamily deals over 200 units in the Southeast from the last 18 months." Instant answers from data you already had — it was just trapped in email.',
              },
              {
                icon: Brain,
                title: "Pattern Recognition & Alerts",
                tagline: "Spot what humans miss.",
                description:
                  "Cross-references incoming deals against your entire historical dataset. Flags anomalies — pricing below submarket averages, unusual assumptions, repeat broker patterns. Surfaces the signal in the noise before your competitors see it.",
              },
            ].map((service, index) => (
              <FadeInSection key={index} delay={index * 0.05}>
                <div className="group flex max-md:flex-col items-center max-md:items-start gap-6 p-6 md:p-8 bg-white/[0.015] border border-white/[0.06] rounded-sm hover:bg-white/[0.025] hover:border-[#C8A96E]/20 transition-all duration-500">
                  <div className="flex items-center gap-5 md:w-80 shrink-0">
                    <div className="w-10 h-10 bg-[#C8A96E]/8 border border-[#C8A96E]/15 rounded-sm flex items-center justify-center group-hover:bg-[#C8A96E]/15 transition-colors shrink-0">
                      <service.icon className="w-4 h-4 text-[#C8A96E]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-white/90">
                        {service.title}
                      </h3>
                      <p className="text-[#C8A96E]/70 text-xs font-mono mt-0.5">
                        {service.tagline}
                      </p>
                    </div>
                  </div>
                  <p className="text-white/38 leading-relaxed text-sm">
                    {service.description}
                  </p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section
        id="how-it-works"
        className="relative z-10 px-6 lg:px-16 py-20 lg:py-28 border-t border-white/[0.04]"
      >
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <p className="text-[#C8A96E] text-xs font-mono tracking-widest uppercase mb-4">
              The Process
            </p>
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-16">
              Connect your inbox.
              <br />
              <span className="text-white/30">
                We extract the intelligence.
              </span>
            </h2>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Connect Your Inbox",
                description:
                  "One-click OAuth connection to Outlook or Gmail. We get read access to your deal flow — nothing else. Your inbox agent starts scanning immediately, working through your backlog of deal emails and building your initial dataset.",
              },
              {
                step: "02",
                title: "We Extract & Structure",
                description:
                  "Every deal email and attachment gets parsed automatically. OMs, rent rolls, models, comps — all extracted into structured data, tagged by property type, geography, deal terms, and broker. Your historical deal flow becomes a queryable database.",
              },
              {
                step: "03",
                title: "Intelligence Compounds",
                description:
                  "From day one, you can search and query your deal data. As more emails flow in, your dataset grows. The agent gets smarter — spotting patterns, flagging anomalies, surfacing comps you didn't know you had. It never forgets a deal.",
              },
            ].map((item, index) => (
              <FadeInSection key={index} delay={index * 0.1}>
                <div>
                  <div className="text-5xl font-mono text-[#C8A96E]/15 mb-5 tracking-tight">
                    {item.step}
                  </div>
                  <h3 className="text-base font-medium mb-3 text-white/85">
                    {item.title}
                  </h3>
                  <p className="text-white/38 leading-relaxed text-sm">
                    {item.description}
                  </p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section
        id="about"
        className="relative z-10 px-6 lg:px-16 py-20 lg:py-28 border-t border-white/[0.04]"
      >
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <p className="text-[#C8A96E] text-xs font-mono tracking-widest uppercase mb-4">
              Who We Are
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
                              page: "inbox",
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
                              page: "inbox",
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
                            page: "inbox",
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

      {/* Final CTA Section */}
      <section
        id="contact"
        className="relative z-10 px-6 lg:px-16 py-20 lg:py-28 border-t border-white/[0.04]"
      >
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <div
              className="relative overflow-hidden rounded-sm bg-[#0a0a0a] border border-[#C8A96E]/15"
              style={{
                backgroundImage: `
                linear-gradient(to right, rgba(200, 169, 110, 0.04) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(200, 169, 110, 0.04) 1px, transparent 1px)
              `,
                backgroundSize: "60px 60px",
              }}
            >
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#C8A96E]/6 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/4" />

              <div className="relative px-8 py-16 lg:p-20">
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2 mb-6">
                    <SignalMark className="opacity-60" />
                  </div>
                  <h2 className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight mb-6">
                    See what&apos;s hiding
                    <br />
                    in your inbox.
                  </h2>
                  <p className="text-white/40 text-lg mb-10 leading-relaxed">
                    30 minutes. Connect your inbox. We&apos;ll show you the deal
                    intelligence you&apos;re sitting on — structured,
                    searchable, and ready to work for you.
                  </p>
                  <Link
                    href="/book"
                    onClick={() =>
                      posthog.capture("cta_clicked", {
                        cta_type: "get_started",
                        location: "final_cta",
                        page: "inbox",
                      })
                    }
                  >
                    <Button
                      size="lg"
                      className="bg-[#C8A96E] hover:bg-[#b8952a] text-black font-semibold px-8 h-14 text-base"
                    >
                      See What&apos;s In Your Inbox
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 px-6 lg:px-16 py-10 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <SignalMark />
            <span className="text-sm text-white/30 font-mono tracking-wide">
              Dealwire
            </span>
          </div>
          <p className="text-xs font-mono text-white/15 tracking-wider">
            © {new Date().getFullYear()} · Frontstep AI, LLC.
          </p>
        </div>
      </footer>
    </div>
  );
}
