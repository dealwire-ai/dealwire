"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useClerk, useUser, OrganizationSwitcher } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { isFrontstepUser } from "@/lib/utils";
import posthog from "posthog-js";

interface NavItem {
  label: string;
  href: string;
  tab?: string;
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
    // Tab link: must be on /dashboard with exact tab match
    // /dashboard?tab=deals is also active when tab is null (default)
    isActive =
      pathname === "/dashboard" &&
      (tab === item.tab || (item.tab === "deals" && tab === null));
  } else {
    isActive = pathname.startsWith(item.href);
  }

  return (
    <Link
      href={item.href}
      className={`flex items-center px-3 py-1.5 rounded-md text-sm transition-colors ${
        isActive
          ? "text-[#C8A96E] bg-zinc-900"
          : "text-zinc-400 hover:text-white hover:bg-zinc-900"
      }`}
    >
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
      title: "Deal Flow",
      items: [
        { label: "Deals", href: "/dashboard?tab=deals", tab: "deals" },
        { label: "Contacts", href: "/dashboard?tab=contacts", tab: "contacts" },
        {
          label: "Properties",
          href: "/dashboard?tab=properties",
          tab: "properties",
        },
      ],
    },
    {
      title: "Underwriting",
      items: [{ label: "Templates", href: "/underwriting" }],
      flag: flags.underwriting,
    },
    {
      title: "Market Data",
      items: [{ label: "Parcels", href: "/public-data/parcels" }],
      flag: flags.parcels,
      frontstepOnly: true,
    },
    {
      title: "Settings",
      items: [{ label: "Buckets", href: "/manage" }],
    },
  ];

  const handleSignOut = () => {
    posthog.capture("sign_out_clicked");
    posthog.reset();
    signOut({ redirectUrl: "/sign-in" });
  };

  return (
    <aside className="w-[220px] flex flex-col bg-zinc-950 border-r border-zinc-800 h-screen shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-zinc-800">
        <span className="text-white font-semibold tracking-tight">
          ◈ Analyzer
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-5">
        {sections.map((section) => {
          // Hide flagged sections until flags are loaded (no flash)
          if (section.flag !== undefined && !flagsLoading && !section.flag)
            return null;
          if (section.frontstepOnly && !isFrontstep) return null;
          if (section.flag !== undefined && flagsLoading) return null;

          return (
            <div key={section.title}>
              <p className="px-3 mb-1 text-[10px] uppercase tracking-widest text-zinc-600">
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
      <div className="border-t border-zinc-800 px-3 py-3 space-y-2">
        {isFrontstep && (
          <OrganizationSwitcher hidePersonal appearance={{ baseTheme: dark }} />
        )}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-medium text-white shrink-0">
            {initials}
          </div>
          <span className="text-sm text-zinc-300 truncate flex-1">
            {displayName}
          </span>
          <button
            onClick={handleSignOut}
            className="text-xs text-zinc-500 hover:text-white transition-colors shrink-0"
          >
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
