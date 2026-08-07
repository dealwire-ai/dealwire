import { Eyebrow } from "@/components/marketing/eyebrow";
import { FadeInSection } from "@/components/marketing/fade-in-section";
import { SectionShell } from "@/components/marketing/section-shell";

export function AssetSection() {
  return (
    <SectionShell>
      <FadeInSection>
        <Eyebrow className="mb-6">The asset nobody is using</Eyebrow>
        <h2 className="text-4xl md:text-5xl font-normal tracking-tight mb-10 leading-[1.1]">
          Your firm&apos;s most valuable asset is already{" "}
          <span className="text-white/30">inside your firm.</span>
        </h2>
      </FadeInSection>

      <div className="space-y-8 text-lg text-white/55 leading-relaxed max-w-3xl">
        <FadeInSection delay={0.05}>
          <p>
            Twenty years of deal flow. Every memo, every IC discussion, every
            broker relationship, every call that was right, every call that was
            wrong. It sits in Outlook threads, PDF attachments, SharePoint
            folders, and the heads of your longest-tenured partners.
          </p>
        </FadeInSection>
        <FadeInSection delay={0.1}>
          <p>
            When a senior partner retires, most of it walks out the door. When a
            new deal lands on a Tuesday morning, the firm reinvents context it
            already paid to learn.
          </p>
        </FadeInSection>
        <FadeInSection delay={0.15}>
          <p>
            Generic AI tools don&apos;t fix this. A chatbot plugged into one
            inbox gives toy answers. The intelligence only shows up when the
            whole firm is unified &mdash; and someone builds on top of it.
          </p>
        </FadeInSection>
        <FadeInSection delay={0.2}>
          <p className="text-white/80 text-xl">That&apos;s the work we do.</p>
        </FadeInSection>
      </div>
    </SectionShell>
  );
}
