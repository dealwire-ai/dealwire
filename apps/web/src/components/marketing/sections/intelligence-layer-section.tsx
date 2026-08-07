import { Eyebrow } from "@/components/marketing/eyebrow";
import { FadeInSection } from "@/components/marketing/fade-in-section";
import { SectionShell } from "@/components/marketing/section-shell";

const LAYERS = [
  {
    num: "01",
    title: "A firm operating system.",
    body: "One system that holds the firm\u2019s knowledge and runs its workflows \u2014 deals, documents, relationships, decisions. Everyone, and every agent, works from the same source of truth.",
  },
  {
    num: "02",
    title: "Deal screening and underwriting.",
    body: "Inbound flow screened against your criteria, triaged, and underwritten \u2014 with the first-pass memo done before your team has opened the email.",
  },
  {
    num: "03",
    title: "Off-market sourcing.",
    body: "Public records and market signals mined for owners likely to sell, so you\u2019re in the door before the deal is a listing.",
  },
];

export function IntelligenceLayerSection() {
  return (
    <SectionShell id="approach">
      <FadeInSection>
        <Eyebrow className="mb-6">What we build</Eyebrow>
        <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-16 leading-[1.1] max-w-4xl">
          Real systems, running inside real firms.{" "}
          <span className="text-white/30">
            Every engagement is different. The work looks like this.
          </span>
        </h2>
      </FadeInSection>

      <div className="space-y-12">
        {LAYERS.map((layer, i) => (
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
    </SectionShell>
  );
}
