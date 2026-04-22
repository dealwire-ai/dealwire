import { Eyebrow } from "@/components/marketing/eyebrow";
import { FadeInSection } from "@/components/marketing/fade-in-section";
import { SectionShell } from "@/components/marketing/section-shell";

const LAYERS = [
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
];

export function IntelligenceLayerSection() {
  return (
    <SectionShell id="approach">
      <FadeInSection>
        <Eyebrow className="mb-6">The intelligence layer</Eyebrow>
        <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-16 leading-[1.1] max-w-4xl">
          Everything an analyst does.{" "}
          <span className="text-white/30">Nothing an analyst forgets.</span>
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
