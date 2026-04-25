"use client";

import { useEffect } from "react";
import Script from "next/script";
import posthog from "posthog-js";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { MarketingFooter } from "@/components/marketing/marketing-footer";
import { RB2BScript } from "@/components/marketing/rb2b-script";

export default function BookPage() {
  useEffect(() => {
    posthog.capture("booking_page_viewed");
  }, []);

  return (
    <div className="min-h-screen bg-[#080808] text-white font-sans">
      <Script
        src="//embed.typeform.com/next/embed.js"
        strategy="afterInteractive"
      />
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#C8A96E]/4 rounded-full blur-[180px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#C8A96E]/6 rounded-full blur-[140px] translate-y-1/2 -translate-x-1/3" />
      </div>

      <MarketingNav />

      {/* Booking Section */}
      <section className="relative z-10 px-6 lg:px-16 py-12 lg:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight mb-6">
              Book an intro call
            </h1>
            <p className="text-white/40 text-lg max-w-xl mx-auto">
              20 minutes — no pitch deck. We look forward to meeting you.
            </p>
          </div>

          {/* Typeform Embed */}
          <div className="relative rounded-sm overflow-hidden border border-white/[0.06] bg-white/[0.02] min-h-[500px]">
            <div data-tf-live="01KH5DZ4JXVZX44M5662APZ80D" />
          </div>
        </div>
      </section>

      <MarketingFooter />
      <RB2BScript />
    </div>
  );
}
