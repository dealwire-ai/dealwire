'use client';

import React, { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { Building2, Brain, Workflow, Sparkles, Linkedin, Mail, TrendingUp, Clock, Users, DollarSign, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from "../components/ui/button";

const FadeInSection = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.8, delay, ease: [0.25, 0.4, 0.25, 1] }}
    >
      {children}
    </motion.div>
  );
};

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white overflow-x-hidden font-sans">
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#3ECFA0]/5 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#3ECFA0]/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/3" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 px-6 lg:px-16 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#3ECFA0] rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-black" />
            </div>
            <span className="text-xl font-semibold tracking-tight">Levine & Weinstein</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
            <button onClick={() => document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white transition-colors">Services</button>
            <button onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white transition-colors">How It Works</button>
            <button onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })} className="hover:text-white transition-colors">About</button>
          </div>
          <Link href="/book">
            <Button className="bg-[#3ECFA0] hover:bg-[#35b88f] text-black font-medium px-6">
               Let's Talk
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 lg:px-16 pt-20 pb-24 lg:pt-28 lg:pb-36" style={{
        backgroundImage: `
          linear-gradient(to right, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 1px, transparent 1px)
        `,
        backgroundSize: '80px 80px'
      }}>
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.25, 0.4, 0.25, 1] }}
            className="max-w-4xl"
          >
            {/* <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#3ECFA0]/10 border border-[#3ECFA0]/20 rounded-full mb-8">
              <TrendingUp className="w-4 h-4 text-[#3ECFA0]" />
              <span className="text-sm text-[#3ECFA0] font-medium">AI employees that pay for themselves in 90 days</span>
            </div> */}
            
            <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-normal tracking-tight leading-[0.95] mb-8">
              Your next hire works<br />
              <span className="text-[#3ECFA0]">24/7.</span> Never quits.<br />
              Costs 90% less.
            </h1>
            
            <p className="text-xl md:text-2xl text-white/60 max-w-2xl leading-relaxed mb-6">
              We build custom AI employees for real estate firms. They find off market deals, screen deals, handle investor reports, and free your team to do what actually moves the needle.
            </p>

            {/* <p className="text-lg text-white/40 max-w-xl mb-12">
              The firms adopting AI now will outperform. The rest will wonder what happened.
            </p> */}
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/book">
                <Button 
                  size="lg"
                  className="bg-[#3ECFA0] hover:bg-[#35b88f] text-black font-semibold px-8 h-14 text-base"
                >
                  Book Your Call
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* The Problem Section
      <section id="problem" className="relative z-10 px-6 lg:px-16 py-20 lg:py-28 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <p className="text-[#3ECFA0] text-sm font-medium tracking-wider uppercase mb-4">The Reality</p>
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-6 max-w-3xl">
              Your best people are drowning in work that doesn&apos;t require their talent.
            </h2>
          </FadeInSection>
          
          <div className="grid md:grid-cols-2 gap-8 mt-12">
            <FadeInSection delay={0.1}>
              <div className="p-8 bg-white/[0.02] border border-white/5 rounded-2xl">
                <div className="text-5xl font-light text-white/20 mb-4">01</div>
                <h3 className="text-xl font-medium mb-3">Analysts buried in busywork</h3>
                <p className="text-white/50 leading-relaxed">
                  Your $150K analysts spend 60% of their time on data entry, formatting reports, and chasing documents. That&apos;s $90K/year in wasted salary—per person.
                </p>
              </div>
            </FadeInSection>
            
            <FadeInSection delay={0.2}>
              <div className="p-8 bg-white/[0.02] border border-white/5 rounded-2xl">
                <div className="text-5xl font-light text-white/20 mb-4">02</div>
                <h3 className="text-xl font-medium mb-3">Deals slipping through</h3>
                <p className="text-white/50 leading-relaxed">
                  While your team manually screens OMs, faster firms are already sending LOIs. Every hour of delay costs you leverage—or the deal entirely.
                </p>
              </div>
            </FadeInSection>
            
            <FadeInSection delay={0.3}>
              <div className="p-8 bg-white/[0.02] border border-white/5 rounded-2xl">
                <div className="text-5xl font-light text-white/20 mb-4">03</div>
                <h3 className="text-xl font-medium mb-3">Scaling means hiring</h3>
                <p className="text-white/50 leading-relaxed">
                  Want to evaluate 2x the deals? That means 2x the headcount, 2x the overhead, and months of recruiting and training. The math doesn&apos;t work.
                </p>
              </div>
            </FadeInSection>
            
            <FadeInSection delay={0.4}>
              <div className="p-8 bg-white/[0.02] border border-white/5 rounded-2xl">
                <div className="text-5xl font-light text-white/20 mb-4">04</div>
                <h3 className="text-xl font-medium mb-3">Competitors are moving</h3>
                <p className="text-white/50 leading-relaxed">
                  The top PE firms already have AI in production. They&apos;re not talking about it—they&apos;re using it. Every quarter you wait, they pull further ahead.
                </p>
              </div>
            </FadeInSection>
          </div>
        </div>
      </section> */}

      {/* Value Proposition Section */}
      <section className="relative z-10 px-6 lg:px-16 py-20 lg:py-28 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <div className="max-w-3xl">
              {/* <p className="text-[#3ECFA0] text-sm font-medium tracking-wider uppercase mb-4">The Solution</p> */}
              <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-6">
                Hire AI employees.<br />
                <span className="text-white/40">Not more headcount.</span>
              </h2>
              <p className="text-white/50 text-xl leading-relaxed mb-12">
                We don&apos;t sell software. We deliver working AI employees—custom-built for your firm, trained on your criteria, deployed in weeks.
              </p>
            </div>
          </FadeInSection>
          
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            {[
              { icon: Clock, value: "24/7", label: "Always on", desc: "Works nights, weekends, holidays" },
              { icon: DollarSign, value: "90%", label: "Cost reduction", desc: "vs. equivalent human labor" },
              { icon: Sparkles, value: "Weeks", label: "Time to deploy", desc: "vs. months of hiring and training" },
            ].map((stat, index) => (
              <FadeInSection key={index} delay={index * 0.1}>
                <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl text-center">
                  <stat.icon className="w-6 h-6 text-[#3ECFA0] mx-auto mb-4" />
                  <div className="text-4xl font-light text-white mb-1">{stat.value}</div>
                  <div className="text-white font-medium mb-1">{stat.label}</div>
                  <div className="text-white/40 text-sm">{stat.desc}</div>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="relative z-10 px-6 lg:px-16 py-20 lg:py-28 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <p className="text-[#3ECFA0] text-sm font-medium tracking-wider uppercase mb-4">What We Build</p>
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-6">
              AI employees for every function.
            </h2>
          </FadeInSection>
          
          <div className="space-y-4">
            {[
              {
                icon: TrendingUp,
                title: "Off-Market Deal Sourcing",
                tagline: "Deals your competitors will never see.",
                description: "An AI agent that continuously scans public records, monitors ownership changes, identifies distressed assets, and surfaces off-market opportunities that match your criteria—before they hit the market."
              },
              {
                icon: Building2,
                title: "Deal Screening",
                tagline: "From 500 emails to 5 qualified leads.",
                description: "Auto-parse every OM and teaser that hits your inbox. Screen against your buy box instantly. Generate preliminary underwriting and draft LOIs before competitors even open the email."
              },
              {
                icon: Workflow,
                title: "Operations",
                tagline: "Back office that runs itself.",
                description: "Lease abstracts in seconds. CAM reconciliations automated. Tenant notices on autopilot. NOI tracking in real-time. Your ops team focuses on exceptions, not data entry."
              },
              {
                icon: Sparkles,
                title: "Market Intelligence",
                tagline: "Know what others don't.",
                description: "An AI analyst that monitors market trends, tracks comp sales and zoning changes and delivers insights before you grab coffee."
              }
            ].map((service, index) => (
              <FadeInSection key={index} delay={index * 0.05}>
                <div className="group flex flex-col md:flex-row md:items-center gap-6 p-6 md:p-8 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.04] hover:border-white/10 transition-all duration-500">
                  <div className="flex items-center gap-5 md:w-80 shrink-0">
                    <div className="w-12 h-12 bg-[#3ECFA0]/10 rounded-xl flex items-center justify-center group-hover:bg-[#3ECFA0]/20 transition-colors shrink-0">
                      <service.icon className="w-6 h-6 text-[#3ECFA0]" />
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">{service.title}</h3>
                      <p className="text-[#3ECFA0] text-sm">{service.tagline}</p>
                    </div>
                  </div>
                  <p className="text-white/50 leading-relaxed">{service.description}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="relative z-10 px-6 lg:px-16 py-20 lg:py-28 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <p className="text-[#3ECFA0] text-sm font-medium tracking-wider uppercase mb-4">The Process</p>
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-16">
              From call to deployed.<br />
              <span className="text-white/40">In weeks, not months.</span>
            </h2>
          </FadeInSection>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Discovery Call",
                description: "30 minutes. We learn your workflows, pain points, and criteria. You learn if we're the right fit. No pressure, no pitch deck."
              },
              {
                step: "02",
                title: "We Build",
                description: "Custom AI employee, trained on your specific criteria and workflows. We handle the technical complexity—you provide the domain expertise."
              },
              {
                step: "03",
                title: "Deploy & Iterate",
                description: "Your AI employee goes live. We monitor, refine, and improve. You see ROI within 90 days or we keep working until you do."
              }
            ].map((item, index) => (
              <FadeInSection key={index} delay={index * 0.1}>
                <div className="relative">
                  <div className="text-7xl font-light text-[#3ECFA0]/30 mb-4">{item.step}</div>
                  <h3 className="text-xl font-medium mb-3">{item.title}</h3>
                  <p className="text-white/50 leading-relaxed">{item.description}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="relative z-10 px-6 lg:px-16 py-20 lg:py-28 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <p className="text-[#3ECFA0] text-sm font-medium tracking-wider uppercase mb-4">Who We Are</p>
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-6">
              Built by engineers.
              <br />
              <span className="text-white/40">Backed by RE titans.</span>
            </h2>
            <p className="text-white/50 max-w-2xl text-lg leading-relaxed mb-16">
              We&apos;re Isaac and Noah—two computer science majors from Northeastern University 
              who believe the real estate industry deserves better technology.
            </p>
          </FadeInSection>

          <div className="grid md:grid-cols-2 gap-8">
            {[
              {
                name: "Isaac Levine",
                role: "Co-Founder",
                bio: "Computer Science @ Northeastern. Previously co-founded frontstep.ai.",
                linkedin: "https://www.linkedin.com/in/isaac-levine/",
                email: "isaac@frontstep.ai",
              },
              {
                name: "Noah Weinstein",
                role: "Co-Founder",
                bio: "Computer Science @ Northeastern. Previously co-founded frontstep.ai.",
                linkedin: "https://www.linkedin.com/in/noahweinstein/",
                email: "noah@frontstep.ai",
              }
            ].map((founder, index) => (
              <FadeInSection key={index} delay={index * 0.15}>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-[#3ECFA0]/10 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative p-8 lg:p-10 bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5 rounded-3xl">
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-16 h-16 bg-[#3ECFA0]/10 border border-[#3ECFA0]/20 rounded-2xl flex items-center justify-center text-2xl font-medium text-[#3ECFA0]">
                        {founder.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="flex gap-2">
                        <a href={founder.linkedin} target="_blank" rel="noopener noreferrer" className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                          <Linkedin className="w-4 h-4 text-white/50" />
                        </a>
                        <a href={`mailto:${founder.email}`} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                          <Mail className="w-4 h-4 text-white/50" />
                        </a>
                      </div>
                    </div>
                    <h3 className="text-2xl font-medium mb-1">{founder.name}</h3>
                    <p className="text-[#3ECFA0] text-sm mb-4">{founder.role}</p>
                    <p className="text-white/50 leading-relaxed">{founder.bio}</p>
                  </div>
                </div>
              </FadeInSection>
            ))}
          </div>

          {/* Strategic Advisors */}
          <FadeInSection delay={0.3}>
            <p className="text-[#3ECFA0] text-sm font-medium tracking-wider uppercase mb-4 mt-20">Strategic Advisors</p>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                {
                  name: "Advisor 1",
                  role: "Advisor",
                  bio: "bio for advisor 1."
                },
                {
                  name: "Advisor 2",
                  role: "Advisor",
                  bio: "bio for advisor 2."
                }
              ].map((advisor, index) => (
                <div key={index} className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-[#3ECFA0]/10 border border-[#3ECFA0]/20 rounded-xl flex items-center justify-center text-lg font-medium text-[#3ECFA0]">
                      {advisor.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">{advisor.name}</h3>
                      <p className="text-[#3ECFA0] text-sm">{advisor.role}</p>
                    </div>
                  </div>
                  <p className="text-white/50 text-sm leading-relaxed">{advisor.bio}</p>
                </div>
              ))}
            </div>
          </FadeInSection>

          <FadeInSection delay={0.4}>
            <div className="mt-16 p-8 lg:p-12 bg-gradient-to-r from-[#3ECFA0]/5 to-transparent border border-[#3ECFA0]/10 rounded-3xl">
              <div className="flex flex-col lg:flex-row lg:items-center gap-6 lg:gap-12">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#3ECFA0]/20 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-[#3ECFA0]" />
                  </div>
                  <div>
                    <p className="text-sm text-white/50">Previously built</p>
                    <p className="text-xl font-medium">frontstep.ai</p>
                  </div>
                </div>
                <div className="lg:border-l lg:border-white/10 lg:pl-12">
                  <p className="text-white/60 leading-relaxed">
                    Our experience building, scaling, and exiting frontstep.ai taught us what actually works in RE tech—
                    and more importantly, what doesn&apos;t. We only build what delivers real ROI.
                  </p>
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Final CTA Section */}
      <section id="contact" className="relative z-10 px-6 lg:px-16 py-20 lg:py-28 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#111111] to-black border border-white/5">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#3ECFA0]/10 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/4" />
              
              <div className="relative px-8 py-16 lg:p-20">
                <div className="max-w-2xl">
                  <h2 className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight mb-6">
                    Ready to see what we can build?
                  </h2>
                  <p className="text-white/70 text-lg mb-10">
                    30 minutes. No pitch deck. Just an honest conversation about whether AI can help your firm.
                  </p>
                  <Link href="/book">
                    <Button 
                      size="lg"
                      className="bg-[#3ECFA0] hover:bg-[#35b88f] text-black font-semibold px-8 h-14 text-base"
                    >
                      Book Your Call
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
      <footer className="relative z-10 px-6 lg:px-16 py-12 border-t border-white/5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#3ECFA0] rounded-md flex items-center justify-center">
              <Building2 className="w-3 h-3 text-black" />
            </div>
            <span className="text-sm text-white/50">Levine & Weinstein</span>
          </div>
          <p className="text-sm text-white/30">
            © {new Date().getFullYear()} All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
