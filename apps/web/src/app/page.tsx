"use client";

import React, { useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useInView } from "framer-motion";
import {
  Workflow,
  Sparkles,
  Linkedin,
  Mail,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { Building2 } from "lucide-react";
import { Button } from "../components/ui/button";
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

export default function Home() {
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
              Levine & Weinstein
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
                  posthog.capture("nav_section_clicked", { section: id });
                  document
                    .getElementById(id)
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className="text-xs font-mono tracking-widest uppercase text-white/40 hover:text-white/80 transition-colors cursor-pointer"
              >
                {label}
              </button>
            ))}
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
                })
              }
            >
              <Button className="bg-[#C8A96E] hover:bg-[#b8952a] text-black font-semibold px-5 text-sm">
                Request Access
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
                  Live · Monitoring active inboxes
                </span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-[4.5rem] font-normal tracking-tight leading-[1.0] mb-6">
                Deal intelligence.
                <br />
                <span className="text-[#C8A96E]">From inbox</span>
                <br />
                to IC memo.
              </h1>

              <p className="text-lg text-white/45 max-w-lg leading-relaxed mb-10">
                A deal hits your inbox. Our system reads the OM, screens against
                your buy box, and fires the right action: skip it, draft a
                broker reply, or run a full underwriting that populates your
                Excel pro forma. Every morning, a digest of overnight deal flow.
                All configurable.
              </p>

              <Link
                href="/book"
                onClick={() =>
                  posthog.capture("cta_clicked", {
                    cta_type: "request_access",
                    location: "hero",
                  })
                }
              >
                <Button
                  size="lg"
                  className="bg-[#C8A96E] hover:bg-[#b8952a] text-black font-semibold px-8 h-14 text-base"
                >
                  Request Access
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
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
                        Deal Screener · Active
                      </span>
                    </div>
                    <span className="text-white/15 text-[10px]">
                      03/01/2026 · 06:42 AM
                    </span>
                  </div>

                  {/* Deal header */}
                  <p className="text-white/40 mb-1 tracking-wider">
                    INCOMING OM
                  </p>
                  <p className="text-white/85 mb-5">
                    84,500 SF Retail Strip · Salt Lake City, UT
                  </p>

                  {/* Metrics grid */}
                  <div className="space-y-2.5 mb-5">
                    {[
                      {
                        label: "Cap Rate (In-Place)",
                        value: "7.1%",
                        flag: "↑ Above market",
                        flagColor: "text-[#C8A96E]",
                      },
                      {
                        label: "NOI (T-12, extracted)",
                        value: "$452,000",
                        flag: "✓ Reconciled",
                        flagColor: "text-[#C8A96E]",
                      },
                      {
                        label: "Occupancy (rent roll)",
                        value: "94.2%",
                        flag: "✓ Stable",
                        flagColor: "text-[#C8A96E]",
                      },
                      {
                        label: "WALT",
                        value: "3.2 yrs",
                        flag: "⚠ Near-term rollover",
                        flagColor: "text-amber-400",
                      },
                      {
                        label: "Levered IRR (5-yr)",
                        value: "14.8%",
                        flag: "✓ Clears hurdle",
                        flagColor: "text-[#C8A96E]",
                      },
                      {
                        label: "Equity Multiple",
                        value: "1.87×",
                        flag: "─ Model sensitivity",
                        flagColor: "text-white/25",
                      },
                      {
                        label: "DSCR",
                        value: "1.31×",
                        flag: "✓ Passes threshold",
                        flagColor: "text-[#C8A96E]",
                      },
                    ].map(({ label, value, flag, flagColor }) => (
                      <div
                        key={label}
                        className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-baseline"
                      >
                        <span className="text-white/35">{label}</span>
                        <span className="text-white/80 tabular-nums">
                          {value}
                        </span>
                        <span className={`${flagColor} text-[10px] text-right`}>
                          {flag}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Decision */}
                  <div className="pt-4 border-t border-[#C8A96E]/10">
                    <p className="text-[#C8A96E] font-medium mb-1">
                      → PRO FORMA POPULATED · PROCEED TO IC
                    </p>
                    <p className="text-white/20">
                      Broker reply sent · IC memo drafted · 4m 12s
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Logos Section */}
      <section className="relative z-10 px-6 lg:px-16 py-14 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <p className="text-xs font-mono text-white/20 tracking-widest uppercase text-center mb-10">
            Trusted by operators who&apos;ve moved $2B+ across private markets
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-14 gap-y-8">
            {[
              { file: "hildreth.png", alt: "Hildreth Real Estate Advisors" },
              { file: "jke.svg", alt: "JK Equities" },
              { file: "dg-development.svg", alt: "DG Development Partners" },
            ].map(({ file, alt }) => (
              <div
                key={file}
                className="opacity-25 hover:opacity-55 transition-opacity duration-300"
                style={{ filter: "brightness(0) invert(1)" }}
              >
                <Image
                  src={`/logos/${file}`}
                  alt={alt}
                  width={140}
                  height={40}
                  className="object-contain h-8 w-auto"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

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
              Broker blasts go to 200 firms.
              <br />
              <span className="text-white/30">You have 48 hours.</span>
            </h2>
          </FadeInSection>

          <div className="grid md:grid-cols-2 gap-3 mt-12">
            {[
              {
                num: "01",
                title: "Analysts buried in OMs",
                body: "Your $150K analysts spend 3+ hours per OM extracting T-12s and rebuilding rent rolls. That's table stakes work. It shouldn't require a senior hire.",
              },
              {
                num: "02",
                title: "Speed wins deals",
                body: "By the time your team manually screens an OM, a faster firm has already toured the asset. The LOI window closes faster than most shops open a spreadsheet.",
              },
              {
                num: "03",
                title: "Scaling means hiring",
                body: "Evaluating 3x the deal flow means 3x the headcount. Months of recruiting and onboarding. The unit economics don't work.",
              },
              {
                num: "04",
                title: "The edge is already moving",
                body: "Top GP shops already have AI in production. They're not announcing it. They're sending LOIs while everyone else reads page one.",
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
                Full-stack acquisition intelligence.
                <br />
                <span className="text-white/30">End to end.</span>
              </h2>
              <p className="text-white/40 text-lg leading-relaxed mb-12">
                Not a screening tool. Not a dashboard. A custom AI analyst that
                handles the entire job: from inbox to populated pro forma.
                Without you touching it.
              </p>
            </div>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-3 mt-8">
            {[
              {
                value: "< 4 min",
                label: "OM to decision",
                desc: "Inbox to screened decision, pro forma populated, broker reply sent.",
              },
              {
                value: "24 / 7",
                label: "Always running",
                desc: "Deal flow doesn't stop on weekends. Neither does it.",
              },
              {
                value: "Hours",
                label: "Time to deploy",
                desc: "Custom-built, tested against your deal history, live in hours.",
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
              What We Build
            </p>
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-6">
              One platform. Every function
              <br />
              <span className="text-white/30">in the acquisition stack.</span>
            </h2>
          </FadeInSection>

          <div className="space-y-2 mt-12">
            {[
              {
                icon: TrendingUp,
                title: "Off-Market Deal Sourcing",
                tagline: "Deals your competitors will never see.",
                description:
                  "Monitors public records, delinquent tax filings, CMBS watchlists, and ownership transfers daily. Surfaces distressed and pre-market opportunities ranked by fit against your buy box. Before they hit CoStar.",
              },
              {
                icon: Building2,
                title: "Deal Screening & Full Underwriting",
                tagline: "Inbox to populated pro forma in under 5 minutes.",
                description:
                  "Reads every OM and teaser in your inbox, screens against your buy box, and for deals worth pursuing, extracts the T-12, rent roll, and opex detail. Runs your acquisition model end-to-end: levered IRR, CoC, equity multiple, sensitivity tables. Drafts the IC memo and broker reply. Configurable: documents, model, assumptions.",
              },
              {
                icon: Workflow,
                title: "Operations",
                tagline: "Back office that runs itself.",
                description:
                  "CAM reconciliations, lease abstract extraction, SNDA tracking, tenant notices. NOI reporting that stays current without a spreadsheet. Your ops team handles exceptions, not data entry.",
              },
              {
                icon: Sparkles,
                title: "Market Intelligence",
                tagline: "Know what others don't.",
                description:
                  "Tracks cap rate compression by submarket, flags SOFR-driven distress and loan maturities, surfaces comp sales before publication. Feeds live going-in yields, exit caps, and rent growth into your underwriting assumptions. Every model starts from ground truth, not a broker's pitch deck.",
              },
              {
                icon: Building2,
                title: "Deal History & Broker Intelligence",
                tagline: "Every deal you've ever seen. Every broker ranked.",
                description:
                  "Every OM and teaser that flows through gets indexed. Search your full deal history in seconds. Comp a live deal against everything you've screened in the same submarket. Over time: a broker intelligence layer showing which reps send quality deals, which blast noise, and where your best opportunities actually come from.",
              },
            ].map((service, index) => (
              <FadeInSection key={index} delay={index * 0.05}>
                <div className="group flex flex-col md:flex-row md:items-center gap-6 p-6 md:p-8 bg-white/[0.015] border border-white/[0.06] rounded-sm hover:bg-white/[0.025] hover:border-[#C8A96E]/20 transition-all duration-500">
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

      {/* Automated Triage Section */}
      <section className="relative z-10 px-6 lg:px-16 py-20 lg:py-28 border-t border-white/[0.04]">
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <p className="text-[#C8A96E] text-xs font-mono tracking-widest uppercase mb-4">
              Automated Triage
            </p>
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-4">
              Your buy box becomes
              <br />
              <span className="text-white/30">a set of automatic rules.</span>
            </h2>
            <p className="text-white/40 text-lg leading-relaxed max-w-2xl mb-12">
              Every deal in your inbox is assessed in real time. The right
              action fires automatically. You set the criteria. The system runs
              it.
            </p>
          </FadeInSection>

          <div className="space-y-1.5">
            {[
              {
                label: "SKIP INBOX",
                labelColor: "text-white/25",
                rowBg: "bg-white/[0.015]",
                rowBorder: "border-white/[0.06]",
                condition: "Doesn't fit your buy box",
                action:
                  "Moved to a designated Outlook folder. Logged and searchable. Never touches your inbox or digest.",
              },
              {
                label: "FLAG IN DIGEST",
                labelColor: "text-amber-400",
                rowBg: "bg-amber-500/[0.03]",
                rowBorder: "border-amber-500/15",
                condition: "In range, worth a look",
                action:
                  "Moved to your review folder and surfaced in your morning digest with a summary. Broker reply drafted and queued.",
              },
              {
                label: "FULL UNDERWRITING",
                labelColor: "text-[#C8A96E]",
                rowBg: "bg-[#C8A96E]/[0.04]",
                rowBorder: "border-[#C8A96E]/20",
                condition: "Matches your target profile",
                action:
                  "T-12 and rent roll extracted. Excel pro forma populated end-to-end. IC memo drafted. Broker reply sent. You open your laptop to a completed analysis.",
              },
            ].map(
              (
                { label, labelColor, rowBg, rowBorder, condition, action },
                i,
              ) => (
                <FadeInSection key={i} delay={i * 0.1}>
                  <div
                    className={`flex flex-col md:flex-row md:items-center gap-4 md:gap-0 p-5 md:p-6 ${rowBg} border ${rowBorder} rounded-sm`}
                  >
                    <div className="md:w-52 shrink-0">
                      <span
                        className={`text-xs font-mono tracking-widest ${labelColor}`}
                      >
                        {label}
                      </span>
                    </div>
                    <div className="flex-1 flex flex-col md:flex-row gap-4 md:items-center">
                      <div className="md:w-52 shrink-0">
                        <span className="text-white/35 text-sm">
                          {condition}
                        </span>
                      </div>
                      <div className="flex-1 md:border-l md:border-white/[0.06] md:pl-6">
                        <span className="text-white/45 text-sm leading-relaxed">
                          {action}
                        </span>
                      </div>
                    </div>
                  </div>
                </FadeInSection>
              ),
            )}
          </div>

          {/* Deal digest + configurable callouts */}
          <div className="grid md:grid-cols-2 gap-3 mt-3">
            <FadeInSection delay={0.3}>
              <div className="h-full p-6 bg-[#C8A96E]/[0.05] border border-[#C8A96E]/15 rounded-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-[#C8A96E]/10 border border-[#C8A96E]/20 rounded-sm flex items-center justify-center shrink-0">
                    <span className="text-[#C8A96E] text-[10px] font-mono font-medium">
                      6AM
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-white/85">
                    Daily Deal Digest
                  </h3>
                </div>
                <p className="text-white/40 text-sm leading-relaxed">
                  Every morning, a digest of the last 24 hours lands in your
                  inbox. Best deals at the top, ranked by fit. One-click actions
                  on each. Nothing slips. Nothing wastes your time.
                </p>
              </div>
            </FadeInSection>

            <FadeInSection delay={0.35}>
              <div className="h-full p-6 bg-white/[0.015] border border-white/[0.06] rounded-sm">
                <p className="text-xs font-mono text-white/25 tracking-widest uppercase mb-4">
                  Fully Configurable
                </p>
                <div className="space-y-2.5">
                  {[
                    "Buy box criteria and fit thresholds",
                    "Action rules per tier: skip, reply, or underwrite",
                    "Digest schedule and format (daily, real-time, weekly)",
                    "Excel model, underwriting assumptions, and output fields",
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-[#C8A96E]/60 text-xs mt-0.5 shrink-0">
                        →
                      </span>
                      <span className="text-white/38 text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeInSection>
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
              From call to deployed.
              <br />
              <span className="text-white/30">In hours, not weeks.</span>
            </h2>
          </FadeInSection>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Discovery Call",
                description:
                  "30 minutes. We map your buy box, your model, and where deals slip. You leave knowing exactly what we'll build and what it costs. No pitch deck.",
              },
              {
                step: "02",
                title: "We Configure & Build",
                description:
                  "We wire your AI analyst into your inbox and Excel model. Configure buy box rules, action thresholds, and digest schedule. You define what a great deal looks like. We make sure the system knows it.",
              },
              {
                step: "03",
                title: "Live in Hours",
                description:
                  "Live in hours. Every incoming deal is read, underwritten, and returned as a populated model with a go/no-go. We monitor, refine, and improve. ROI within 90 days or we keep working.",
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
            <p className="text-white/40 max-w-2xl text-lg leading-relaxed mb-16">
              Two Northeastern students who built, scaled, and sold a proptech
              company in between classes. We don&apos;t have decades of
              experience. We have something rarer: the depth to build what the
              industry needs, backed by operators who&apos;ve seen every type of
              deal.
            </p>
          </FadeInSection>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              {
                name: "Isaac Levine",
                role: "Co-Founder",
                bio: "Software Engineer at CarGurus (NASDAQ: CARG), where he architects agentic AI systems at scale. Computer Science at Northeastern. Co-founded and sold frontstep.ai.",
                linkedin: "https://www.linkedin.com/in/isaac-levine/",
                email: "isaac@frontstep.ai",
                headshot: "/headshots/isaac.webp",
              },
              {
                name: "Noah Weinstein",
                role: "Co-Founder",
                bio: "Former Software Engineer at Flexcar and Technical Product Manager at Siphox, a venture-backed health tech startup. Computer Science at Northeastern. Co-founded and sold frontstep.ai.",
                linkedin: "https://www.linkedin.com/in/noahweinstein/",
                email: "noah@frontstep.ai",
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
              <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-12">
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
                    startup competition. Acquired within weeks of launch. The
                    platform automatically qualified thousands of renters,
                    underwriting applicants the same way we now underwrite
                    deals.
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
                    See what a fully underwritten
                    <br />
                    deal looks like in 4 minutes.
                  </h2>
                  <p className="text-white/40 text-lg mb-10 leading-relaxed">
                    30 minutes. No pitch deck. Show us a deal. We&apos;ll show
                    you the output: T-12 extracted, rent roll reconciled, pro
                    forma populated, IC memo drafted.
                  </p>
                  <Link
                    href="/book"
                    onClick={() =>
                      posthog.capture("cta_clicked", {
                        cta_type: "request_access",
                        location: "final_cta",
                      })
                    }
                  >
                    <Button
                      size="lg"
                      className="bg-[#C8A96E] hover:bg-[#b8952a] text-black font-semibold px-8 h-14 text-base"
                    >
                      Request Access
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
              Levine & Weinstein
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
