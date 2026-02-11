'use client';

import { useEffect } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { Building2, ArrowLeft } from 'lucide-react';
import { Button } from "../../components/ui/button";
import posthog from 'posthog-js';

export default function BookPage() {
  useEffect(() => {
    posthog.capture('booking_page_viewed');
  }, []);

  return (
    <div className="min-h-screen bg-black text-white font-sans">
      <Script src="//embed.typeform.com/next/embed.js" strategy="afterInteractive" />
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#3ECFA0]/5 rounded-full blur-[150px] -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#3ECFA0]/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/3" />
      </div>

      {/* Navigation */}
      <nav className="relative z-50 px-6 lg:px-16 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#3ECFA0] rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-black" />
            </div>
            <span className="text-xl font-semibold tracking-tight">Levine & Weinstein</span>
          </Link>
          <Link href="/">
            <Button 
              variant="outline"
              className="border-white/20 bg-transparent text-white hover:bg-white/5"
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
              Book a Call
            </h1>
            <p className="text-white/50 text-lg max-w-xl mx-auto">
              We look forward to meeting you. We&apos;ll discuss your current workflows and explore how AI can help.
            </p>
          </div>

          {/* Typeform Embed */}
          <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-white/5 min-h-[500px]">
            <div data-tf-live="01KH5DZ4JXVZX44M5662APZ80D" />
          </div>
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
