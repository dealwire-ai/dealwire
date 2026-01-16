'use client';

import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Building2, Brain, Workflow, Sparkles, Linkedin, Mail } from 'lucide-react';
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
            <a href="#services" className="hover:text-white transition-colors">Services</a>
            <a href="#about" className="hover:text-white transition-colors">About</a>
            <a href="#contact" className="hover:text-white transition-colors">Contact</a>
          </div>
          <Button 
            className="bg-[#3ECFA0] hover:bg-[#35b88f] text-black font-medium px-6"
            onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
          >
            Get Started
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 px-6 lg:px-16 pt-20 pb-32 lg:pt-32 lg:pb-48" style={{
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
            
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-normal tracking-tight leading-[0.95] mb-8">
              Custom AI tooling for modern RE firms
            </h1>
            
            <p className="text-lg md:text-xl text-white/50 max-w-xl leading-relaxed mb-12">
              We build bespoke artificial intelligence solutions that streamline operations, 
              enhance decision-making, and drive growth for real estate businesses.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg"
                className="bg-[#3ECFA0] hover:bg-[#35b88f] text-black font-semibold px-8 h-14 text-base uppercase tracking-wide"
                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Get Started
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-white/20 bg-transparent text-white hover:bg-white/5 px-8 h-14 text-base uppercase tracking-wide"
                onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Key Features
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="relative z-10 px-6 lg:px-16 py-24 lg:py-32">
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <p className="text-[#3ECFA0] text-sm font-medium tracking-wider uppercase mb-4">What We Build</p>
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-16">
              Tailored AI solutions
            </h2>
          </FadeInSection>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Building2,
                title: "Acquisitions",
                description: "Streamline deal sourcing, due diligence, and underwriting. From automated comps analysis to AI-powered property evaluation, we accelerate your acquisition pipeline."
              },
              {
                icon: Workflow,
                title: "Operations",
                description: "Optimize property and portfolio management. Automate tenant communications, maintenance workflows, lease administration, and reporting to run smoother operations."
              },
              {
                icon: Brain,
                title: "Capital & Investors",
                description: "Enhance fundraising and investor relations. Automate LP reporting, personalized communications, and capital pipeline management to strengthen relationships and close faster."
              }
            ].map((service, index) => (
              <FadeInSection key={index} delay={index * 0.1}>
                <div className="group p-8 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-white/[0.04] hover:border-white/10 transition-all duration-500 h-full">
                  <div className="w-12 h-12 bg-[#3ECFA0]/10 rounded-xl flex items-center justify-center mb-6 group-hover:bg-[#3ECFA0]/20 transition-colors">
                    <service.icon className="w-6 h-6 text-[#3ECFA0]" />
                  </div>
                  <h3 className="text-xl font-medium mb-3">{service.title}</h3>
                  <p className="text-white/50 leading-relaxed">{service.description}</p>
                </div>
              </FadeInSection>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="relative z-10 px-6 lg:px-16 py-24 lg:py-32">
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <p className="text-[#3ECFA0] text-sm font-medium tracking-wider uppercase mb-4">The Founders</p>
            <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-6">
              Built by engineers,
              <br />
              <span className="text-white/40">designed for real estate</span>
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
                bio: "Computer Science @ Northeastern. Co-built frontstep.ai and now focuses on creating AI solutions that solve real problems for RE professionals."
              },
              {
                name: "Noah Weinstein",
                role: "Co-Founder",
                bio: "Computer Science @ Northeastern. Co-built frontstep.ai and brings a passion for clean architecture and scalable systems to every project."
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
                        <a href="#" className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
                          <Linkedin className="w-4 h-4 text-white/50" />
                        </a>
                        <a href="#" className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors">
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

          <FadeInSection delay={0.3}>
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
                    Our experience building frontstep.ai gave us deep insight into what real estate 
                    professionals actually need—not just flashy features, but tools that genuinely 
                    make their work easier.
                  </p>
                </div>
              </div>
            </div>
          </FadeInSection>
        </div>
      </section>

      {/* Contact CTA Section */}
      <section id="contact" className="relative z-10 px-6 lg:px-16 py-24 lg:py-32">
        <div className="max-w-7xl mx-auto">
          <FadeInSection>
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#111111] to-black border border-white/5">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#3ECFA0]/10 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/4" />
              
              <div className="relative px-8 py-16 lg:p-20 text-center">
                <h2 className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight mb-6">
                  Let&apos;s build something together
                </h2>
                <p className="text-white/50 text-lg max-w-xl mx-auto mb-10">
                  Ready to explore how custom AI tooling can transform your real estate operations? 
                  Let&apos;s start a conversation.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a href="mailto:hello@levineweinstein.com">
                    <Button 
                      size="lg"
                      className="bg-[#3ECFA0] hover:bg-[#35b88f] text-black font-semibold px-8 h-14 text-base uppercase tracking-wide w-full sm:w-auto"
                    >
                      <Mail className="w-5 h-5 mr-2" />
                      Get in touch
                    </Button>
                  </a>
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
