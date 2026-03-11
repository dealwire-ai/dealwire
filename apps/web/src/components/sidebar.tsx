"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useClerk, useUser, OrganizationSwitcher } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import {
  Inbox,
  Users,
  Building2,
  SlidersHorizontal,
  LayoutTemplate,
  Map,
  LogOut,
} from "lucide-react";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { isFrontstepUser } from "@/lib/utils";
import posthog from "posthog-js";

interface NavItem {
  label: string;
  href: string;
  tab?: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
  flag?: boolean;
  frontstepOnly?: boolean;
}

function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");

  let isActive: boolean;
  if (item.tab) {
    isActive =
      pathname === "/dashboard" &&
      (tab === item.tab || (item.tab === "deals" && tab === null));
  } else {
    isActive = pathname.startsWith(item.href);
  }

  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={`group flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-all ${
        isActive
          ? "bg-zinc-800 text-white font-medium"
          : "text-zinc-500 hover:text-zinc-100 hover:bg-zinc-900"
      }`}
    >
      <Icon
        className={`w-4 h-4 shrink-0 transition-colors ${
          isActive
            ? "text-[#C8A96E]"
            : "text-zinc-600 group-hover:text-zinc-400"
        }`}
      />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const { flags, loading: flagsLoading } = useFeatureFlags();

  const email = user?.primaryEmailAddress?.emailAddress;
  const isFrontstep = isFrontstepUser(email);

  const initials =
    [user?.firstName?.[0], user?.lastName?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() ||
    email?.[0]?.toUpperCase() ||
    "?";

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || email || "";

  const sections: NavSection[] = [
    {
      title: "Deal Screening",
      items: [
        {
          label: "Deals",
          href: "/dashboard?tab=deals",
          tab: "deals",
          icon: Inbox,
        },
        {
          label: "Contacts",
          href: "/dashboard?tab=contacts",
          tab: "contacts",
          icon: Users,
        },
        {
          label: "Properties",
          href: "/dashboard?tab=properties",
          tab: "properties",
          icon: Building2,
        },
        {
          label: "Screening Buckets",
          href: "/manage",
          icon: SlidersHorizontal,
        },
      ],
    },
    {
      title: "Underwriting",
      items: [
        { label: "Templates", href: "/underwriting", icon: LayoutTemplate },
      ],
      flag: flags.underwriting,
    },
    {
      title: "Market Data",
      items: [{ label: "Parcels", href: "/public-data/parcels", icon: Map }],
      flag: flags.parcels,
      frontstepOnly: true,
    },
  ];

  const handleSignOut = () => {
    posthog.capture("sign_out_clicked");
    posthog.reset();
    signOut({ redirectUrl: "/sign-in" });
  };

  return (
    <aside className="w-[220px] flex flex-col bg-zinc-950 border-r border-zinc-800/60 h-screen shrink-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-zinc-800/60">
        <div className="flex items-center gap-2">
          <span className="text-[#C8A96E]">◈</span>
          <span className="text-white font-semibold tracking-tight text-sm">
            Dealwire
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {sections.map((section) => {
          if (section.flag !== undefined && !flagsLoading && !section.flag)
            return null;
          if (section.frontstepOnly && !isFrontstep) return null;
          if (section.flag !== undefined && flagsLoading) return null;

          return (
            <div key={section.title}>
              <p className="px-3 mb-1 text-[10px] font-medium uppercase tracking-widest text-zinc-600">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink key={item.href} item={item} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-800/60 px-3 py-3 space-y-2.5">
        {isFrontstep && (
          <OrganizationSwitcher hidePersonal appearance={{ baseTheme: dark }} />
        )}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-[10px] font-semibold text-zinc-200 shrink-0">
            {initials}
          </div>
          <span className="text-xs text-zinc-400 truncate flex-1 min-w-0">
            {displayName}
          </span>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
