"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, useClerk } from "@clerk/nextjs";
import posthog from "posthog-js";
import { Button } from "../ui/button";
import { SignalMark } from "../signal-mark";

type Variant = "home" | "security";

export function MarketingNav({ variant = "home" }: { variant?: Variant }) {
  const { isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const router = useRouter();

  const handleAnchorClick = (anchorId: string, ctaType: string) => {
    posthog.capture("cta_clicked", {
      cta_type: ctaType,
      location: "header",
    });
    const el =
      typeof document !== "undefined"
        ? document.getElementById(anchorId)
        : null;
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      router.push(`/#${anchorId}`);
    }
  };

  const anchorLinkClass =
    "text-xs font-mono tracking-widest uppercase text-white/40 hover:text-white/80 transition-colors cursor-pointer";

  return (
    <nav className="relative z-50 px-6 lg:px-16 py-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <SignalMark className="w-[48px] h-[30px]" />
          <span className="text-lg font-medium tracking-tight text-white/90">
            Dealwire
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          <button
            onClick={() => handleAnchorClick("approach", "approach_anchor")}
            className={anchorLinkClass}
          >
            Approach
          </button>
          <button
            onClick={() =>
              handleAnchorClick("engagements", "engagements_anchor")
            }
            className={anchorLinkClass}
          >
            Engagements
          </button>
          <button
            onClick={() => handleAnchorClick("team", "team_anchor")}
            className={anchorLinkClass}
          >
            Team
          </button>
          <Link
            href="/security"
            onClick={() =>
              posthog.capture("cta_clicked", {
                cta_type: "security_link",
                location: "header",
              })
            }
            className={`text-xs font-mono tracking-widest uppercase transition-colors ${
              variant === "security"
                ? "text-white/80"
                : "text-white/40 hover:text-white/80"
            }`}
          >
            Security
          </Link>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {isSignedIn ? (
            <>
              <Link
                href="/dashboard"
                onClick={() =>
                  posthog.capture("cta_clicked", {
                    cta_type: "go_to_dashboard",
                    location: "header",
                  })
                }
              >
                <Button className="bg-white/5 hover:bg-white/8 border border-white/10 text-white font-medium px-3 md:px-5 text-xs md:text-sm">
                  Dashboard
                </Button>
              </Link>
              <Button
                className="hidden md:inline-flex bg-white/5 hover:bg-white/8 border border-white/10 text-white font-medium px-3 md:px-5 text-xs md:text-sm"
                onClick={() => {
                  posthog.capture("cta_clicked", {
                    cta_type: "sign_out",
                    location: "header",
                  });
                  posthog.reset();
                  signOut();
                }}
              >
                Sign Out
              </Button>
            </>
          ) : (
            <Link
              href="/sign-in"
              onClick={() =>
                posthog.capture("cta_clicked", {
                  cta_type: "sign_in",
                  location: "header",
                })
              }
            >
              <Button className="bg-white/5 hover:bg-white/8 border border-white/10 text-white font-medium px-3 md:px-5 text-xs md:text-sm">
                Sign In
              </Button>
            </Link>
          )}
          <Link
            href="/book"
            onClick={() =>
              posthog.capture("cta_clicked", {
                cta_type: "talk_to_founders",
                location: "header",
              })
            }
          >
            <Button className="bg-[#C8A96E] hover:bg-[#d9bb80] text-black font-semibold px-3 md:px-5 text-xs md:text-sm">
              Talk to founders
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
