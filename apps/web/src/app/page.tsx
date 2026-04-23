import { ClientLogos } from "@/components/client-logos";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { CursorGlow } from "@/components/marketing/cursor-glow";
import { AmbientBackground } from "@/components/marketing/sections/ambient-background";
import { HeroSection } from "@/components/marketing/sections/hero-section";
import { AssetSection } from "@/components/marketing/sections/asset-section";
import { IntelligenceLayerSection } from "@/components/marketing/sections/intelligence-layer-section";
import { EngagementsSection } from "@/components/marketing/sections/engagements-section";
import { TeamSection } from "@/components/marketing/sections/team-section";
import { SecuritySection } from "@/components/marketing/sections/security-section";
import { ClosingCtaSection } from "@/components/marketing/sections/closing-cta-section";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden font-sans">
      <AmbientBackground />
      <CursorGlow />
      <MarketingNav variant="home" />

      <HeroSection />
      <ClientLogos />
      <AssetSection />
      <IntelligenceLayerSection />
      <EngagementsSection />
      <TeamSection />
      <SecuritySection />
      <ClosingCtaSection />

      <MarketingFooter />
    </div>
  );
}
