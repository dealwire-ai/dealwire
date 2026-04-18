import { Eyebrow } from "@/components/marketing/eyebrow";
import { FadeInSection } from "@/components/marketing/fade-in-section";
import { SectionShell } from "@/components/marketing/section-shell";

const PHASES = [
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
];

export function EngagementsSection() {
  return (
    <SectionShell id="engagements">
      <FadeInSection>
        <Eyebrow className="mb-6">Engagements</Eyebrow>
        <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-16 leading-[1.1]">
          How an engagement runs.
        </h2>
      </FadeInSection>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-6">
        {PHASES.map((phase, i) => (
          <FadeInSection key={phase.step} delay={i * 0.08} className="h-full">
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
    </SectionShell>
  );
}
