"use client";

import Link from "next/link";
import posthog from "posthog-js";
import { SignalMark } from "../signal-mark";

export function MarketingFooter() {
  return (
    <footer className="relative z-10 px-6 lg:px-16 py-10 border-t border-white/[0.04]">
      <div className="max-w-7xl mx-auto flex max-md:flex-col items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <SignalMark />
          <span className="text-sm text-white/30 font-mono tracking-wide">
            Dealwire
          </span>
        </Link>
        <div className="flex max-md:flex-col items-center gap-x-6 gap-y-2">
          <Link
            href="/security"
            onClick={() =>
              posthog.capture("cta_clicked", {
                cta_type: "security_link",
                location: "footer",
              })
            }
            className="text-xs font-mono text-white/40 hover:text-white/80 tracking-wider transition-colors"
          >
            Security
          </Link>
          <Link
            href="/terms-of-use"
            className="text-xs font-mono text-white/40 hover:text-white/80 tracking-wider transition-colors"
          >
            Terms of Use
          </Link>
          <Link
            href="/privacy-policy"
            className="text-xs font-mono text-white/40 hover:text-white/80 tracking-wider transition-colors"
          >
            Privacy Policy
          </Link>
          <p className="text-xs font-mono text-white/15 tracking-wider">
            © {new Date().getFullYear()} · Frontstep AI, LLC.
          </p>
        </div>
      </div>
    </footer>
  );
}
