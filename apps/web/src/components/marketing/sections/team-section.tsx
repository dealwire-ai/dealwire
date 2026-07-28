"use client";

import Image from "next/image";
import { Linkedin, Mail, Sparkles } from "lucide-react";
import posthog from "posthog-js";

import { Eyebrow } from "@/components/marketing/eyebrow";
import { FadeInSection } from "@/components/marketing/fade-in-section";
import { SectionShell } from "@/components/marketing/section-shell";

type Founder = {
  name: string;
  role: string;
  bio: string;
  linkedin: string;
  email: string;
  headshot: string;
};

type Member = {
  name: string;
  role: string;
  headshot: string;
  linkedin: string;
  bio: string;
};

const FOUNDERS: Founder[] = [
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
];

const ENGINEERS: Member[] = [
  {
    name: "Jackson Zheng",
    role: "Forward Deployed Engineer",
    headshot: "/headshots/jackson.webp",
    linkedin: "https://www.linkedin.com/in/jackson-zheng-844172247/",
    bio: "Software Engineer at a private healthcare company, where he builds and automates the internal systems their operations run on. Computer Science and Mathematics at Northeastern. 4x hackathon winner.",
  },
  {
    name: "Alex Weinberger",
    role: "Forward Deployed Engineer",
    headshot: "/headshots/alex.webp",
    linkedin: "https://www.linkedin.com/in/weinberger-alexander/",
    bio: "Former Full-Stack Software Engineer at MORSE Corp, building software for defense and national security. Focused on distributed systems and fintech. Computer Science at Northeastern.",
  },
];

const ADVISORS: Member[] = [
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
    linkedin: "https://www.linkedin.com/in/jordan-karlik-b546b83/",
    bio: "Principal at JK Equities. Started at Deutsche Bank and Ernst & Young in CMBS. JK Equities has owned, operated, and developed nearly $2B in property across 15+ states.",
  },
];

const FRONTSTEP_TAGS = [
  "Built in 3 months",
  "Northeastern startup prize winner",
  "Acquired post-launch",
  "Thousands of renters qualified",
];

function FounderCard({ founder }: { founder: Founder }) {
  return (
    <div className="relative group h-full">
      <div className="absolute inset-0 bg-gradient-to-br from-[#C8A96E]/8 to-transparent rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative h-full p-6 bg-white/[0.015] border border-white/[0.06] rounded-sm group-hover:border-[#C8A96E]/20 transition-colors duration-300">
        <div className="flex items-start justify-between mb-4">
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
        <Eyebrow className="mb-4">{founder.role}</Eyebrow>
        <p className="text-white/38 leading-relaxed text-sm">{founder.bio}</p>
      </div>
    </div>
  );
}

function MemberCard({ member }: { member: Member }) {
  return (
    <div className="relative group h-full">
      <div className="absolute inset-0 bg-gradient-to-br from-[#C8A96E]/6 to-transparent rounded-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative h-full p-6 bg-white/[0.015] border border-white/[0.06] rounded-sm group-hover:border-[#C8A96E]/20 transition-colors duration-300">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="relative w-11 h-11 rounded-sm overflow-hidden border border-[#C8A96E]/15 shrink-0">
              <Image
                src={member.headshot}
                alt={member.name}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white/90">
                {member.name}
              </h3>
              <Eyebrow>{member.role}</Eyebrow>
            </div>
          </div>
          <a
            href={member.linkedin}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              posthog.capture("founder_linkedin_clicked", {
                founder_name: member.name,
                role: member.role.toLowerCase(),
              })
            }
            className="p-2 bg-white/[0.04] rounded-sm hover:bg-white/8 transition-colors shrink-0"
          >
            <Linkedin className="w-4 h-4 text-white/35" />
          </a>
        </div>
        <p className="text-white/35 text-sm leading-relaxed">{member.bio}</p>
      </div>
    </div>
  );
}

function PreviouslyBuilt() {
  return (
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
            <p className="text-base font-medium text-white/85">frontstep.ai</p>
          </div>
        </div>
        <div className="lg:border-l lg:border-white/[0.06] lg:pl-12">
          <p className="text-white/38 leading-relaxed text-sm mb-4">
            Built in 3 months. Won a cash prize at Northeastern&apos;s startup
            competition. Acquired within months of launch. The platform
            automatically qualified thousands of renters.
          </p>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {FRONTSTEP_TAGS.map((tag) => (
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
  );
}

export function TeamSection() {
  return (
    <SectionShell id="team" className="py-20 lg:py-28">
      <FadeInSection>
        <Eyebrow className="mb-4">Team</Eyebrow>
        <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-6">
          Engineers backed by
          <br />
          <span className="text-white/30">veteran CRE operators.</span>
        </h2>
      </FadeInSection>

      <div className="grid md:grid-cols-2 gap-3">
        {FOUNDERS.map((founder, index) => (
          <FadeInSection
            key={founder.name}
            delay={index * 0.15}
            className="h-full"
          >
            <FounderCard founder={founder} />
          </FadeInSection>
        ))}
      </div>

      <FadeInSection delay={0.3}>
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          {ENGINEERS.map((engineer) => (
            <MemberCard key={engineer.name} member={engineer} />
          ))}
        </div>
      </FadeInSection>

      <FadeInSection delay={0.35}>
        <Eyebrow className="mb-4 mt-20">Strategic Advisors</Eyebrow>
        <div className="grid md:grid-cols-2 gap-3">
          {ADVISORS.map((advisor) => (
            <MemberCard key={advisor.name} member={advisor} />
          ))}
        </div>
      </FadeInSection>

      <FadeInSection delay={0.4}>
        <PreviouslyBuilt />
      </FadeInSection>
    </SectionShell>
  );
}
