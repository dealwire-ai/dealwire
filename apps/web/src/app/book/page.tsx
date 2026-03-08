"use client";

import { useEffect } from "react";
import Script from "next/script";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "../../components/ui/button";
import posthog from "posthog-js";

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

      {/* Navigation */}
      <nav className="relative z-50 px-6 lg:px-16 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <SignalMark />
            <span className="text-base font-medium tracking-tight text-white/90">
              Levine & Weinstein
            </span>
          </Link>
          <Link href="/">
            <Button
              variant="outline"
              className="border-white/10 bg-transparent text-white/60 hover:bg-white/5 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>
      </nav>

      {/* Booking Section */}
      <section className="relative z-10 px-6 lg:px-16 py-12 lg:py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-normal tracking-tight mb-6">
              Join the waitlist
            </h1>
            <p className="text-white/40 text-lg max-w-xl mx-auto">
              We'll be in touch soon.
            </p>
          </div>

          {/* Typeform Embed */}
          <div className="relative rounded-sm overflow-hidden border border-white/[0.06] bg-white/[0.02] min-h-[500px]">
            <div data-tf-live="01KH5DZ4JXVZX44M5662APZ80D" />
          </div>
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
