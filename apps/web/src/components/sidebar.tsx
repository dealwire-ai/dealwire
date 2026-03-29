"use client";

import Link from "next/link";
import { SignalMark } from "@/components/signal-mark";
import { usePathname, useSearchParams } from "next/navigation";
import { useClerk, useUser, OrganizationSwitcher } from "@clerk/nextjs";
import {
  Inbox,
  Users,
  Building2,
  SlidersHorizontal,
  LayoutTemplate,
  Map,
  Presentation,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Building,
  MoreHorizontal,
} from "lucide-react";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { isInternalUser, isAdminUser } from "@/lib/utils";
import posthog from "posthog-js";
import { useState, useCallback } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

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

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
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

  const linkContent = (
    <Link
      href={item.href}
      className={`group flex items-center gap-2.5 rounded-md text-[13px] transition-all ${
        collapsed ? "px-3 py-2 justify-center" : "px-3 py-1.5"
      } ${
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
      {!collapsed && item.label}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

export function Sidebar() {
  const { signOut, openUserProfile, openOrganizationProfile } = useClerk();
  const { user } = useUser();
  const { flags, loading: flagsLoading } = useFeatureFlags();

  const [collapsed, setCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("sidebar-collapsed") === "true",
  );

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", String(next));
      return next;
    });
  }, []);

  const email = user?.primaryEmailAddress?.emailAddress;
  const isFrontstep = isInternalUser(email);
  const isAdmin = isAdminUser(email);

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
        {
          label: "Model Templates",
          href: "/underwriting",
          icon: LayoutTemplate,
        },
      ],
      flag: flags.underwriting,
    },
    {
      title: "Market Data",
      items: [{ label: "Parcels", href: "/public-data/parcels", icon: Map }],
      flag: flags.parcels,
    },
    {
      title: "Demos",
      items: [{ label: "Demos", href: "/demos", icon: Presentation }],
      frontstepOnly: true,
    },
  ];

  const handleSignOut = () => {
    posthog.capture("sign_out_clicked");
    posthog.reset();
    signOut({ redirectUrl: "/sign-in" });
  };

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={`flex flex-col h-screen shrink-0 transition-all duration-200 ${
          collapsed ? "w-[56px]" : "w-[240px]"
        }`}
      >
        {/* Logo + collapse toggle */}
        <div className="px-3 py-4 flex items-center justify-between min-h-[53px]">
          {!collapsed && (
            <Link href="/" className="flex items-center gap-2.5 min-w-0 group">
              <SignalMark className="shrink-0 w-[28px]" />
              <span className="text-white font-semibold tracking-tight text-sm truncate group-hover:text-zinc-300 transition-colors">
                Dealwire
              </span>
            </Link>
          )}
          <button
            onClick={toggleCollapsed}
            className={`cursor-pointer text-zinc-600 hover:text-zinc-300 transition-colors rounded-md p-0.5 hover:bg-zinc-800 ${
              collapsed ? "mx-auto" : "ml-auto"
            }`}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-5 h-5" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
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
                {!collapsed && (
                  <p className="px-3 mb-1 text-[11px] font-medium uppercase tracking-widest text-zinc-600">
                    {section.title}
                  </p>
                )}
                {collapsed && <div className="mb-1 h-px bg-zinc-800/60 mx-1" />}
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <NavLink
                      key={item.href}
                      item={item}
                      collapsed={collapsed}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-2">
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <button className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-zinc-800/80 transition-colors group min-w-0">
                    <Avatar className="w-6 h-6 shrink-0">
                      <AvatarImage src={user?.imageUrl} />
                      <AvatarFallback className="bg-zinc-700 text-[10px] font-semibold text-zinc-200">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {!collapsed && (
                      <>
                        <span className="text-xs text-zinc-400 truncate flex-1 min-w-0 text-left">
                          {displayName}
                        </span>
                        <MoreHorizontal className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
                      </>
                    )}
                  </button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right" className="text-xs">
                  {displayName}
                </TooltipContent>
              )}
            </Tooltip>

            <DropdownMenuContent
              side="right"
              align="end"
              sideOffset={8}
              className="w-52 bg-zinc-900 border-zinc-800 text-zinc-100"
            >
              <DropdownMenuLabel className="text-zinc-400 font-normal text-xs">
                {email}
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-zinc-800" />
              {isAdmin && (
                <>
                  <div className="px-2 py-1.5">
                    <OrganizationSwitcher hidePersonal />
                  </div>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                </>
              )}
              <DropdownMenuItem
                onClick={() => openUserProfile()}
                className="gap-2 cursor-pointer focus:bg-zinc-800 focus:text-zinc-100"
              >
                <Settings className="w-3.5 h-3.5 text-zinc-400" />
                Account settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => openOrganizationProfile()}
                className="gap-2 cursor-pointer focus:bg-zinc-800 focus:text-zinc-100"
              >
                <Building className="w-3.5 h-3.5 text-zinc-400" />
                Organization settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-zinc-800" />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="gap-2 cursor-pointer text-red-400 focus:bg-zinc-800 focus:text-red-400"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </TooltipProvider>
  );
}
