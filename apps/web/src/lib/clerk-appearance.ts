import { dark } from "@clerk/themes";

export const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: "#C8A96E",
    colorTextOnPrimaryBackground: "#000000",
    colorBackground: "#0a0a0a",
    colorInputBackground: "#18181b", // zinc-900
    colorInputText: "#ededed",
    colorText: "#ededed",
    colorTextSecondary: "#a1a1aa", // zinc-400
    colorDanger: "#ef4444",
    colorSuccess: "#22c55e",
    borderRadius: "0.5rem",
    fontFamily:
      "var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif",
    fontFamilyButtons:
      "var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif",
  },
  elements: {
    // Cards & containers
    card: "bg-zinc-950 border border-zinc-800 shadow-xl",
    rootBox: "mx-auto",

    // Header
    headerTitle: "text-zinc-100",
    headerSubtitle: "text-zinc-400",

    // Social / OAuth buttons
    socialButtonsBlockButton:
      "bg-zinc-900 border-zinc-700 text-zinc-100 hover:bg-zinc-800",
    socialButtonsBlockButtonText: "text-zinc-100",

    // Divider
    dividerLine: "bg-zinc-800",
    dividerText: "text-zinc-500",

    // Form fields
    formFieldLabel: "text-zinc-300",
    formFieldInput:
      "bg-zinc-900 border-zinc-700 text-zinc-100 focus:border-[#C8A96E] focus:ring-[#C8A96E]/20",

    // Buttons
    formButtonPrimary: "bg-[#C8A96E] hover:bg-[#b8996e] text-black font-medium",

    // Footer
    footerActionLink: "text-[#C8A96E] hover:text-[#b8996e]",
    footerActionText: "text-zinc-400",

    // User button & profile
    userButtonPopoverCard: "bg-zinc-950 border border-zinc-800",
    userButtonPopoverActionButton: "hover:bg-zinc-900 text-zinc-300",
    userButtonPopoverActionButtonText: "text-zinc-300",
    userButtonPopoverFooter: "border-t border-zinc-800",
    userPreviewMainIdentifier: "text-zinc-100",
    userPreviewSecondaryIdentifier: "text-zinc-400",

    // Active device / sessions
    activeDeviceListItem: "border-zinc-800",

    // Navbar (profile/org modals)
    navbar: "bg-zinc-950 border-r border-zinc-800",
    navbarButton: "text-zinc-300 hover:bg-zinc-900",
    navbarButtonIcon: "text-zinc-400",

    // Page / profile sections
    page: "bg-zinc-950",
    profileSection: "border-zinc-800",
    profileSectionTitle: "text-zinc-100 border-b border-zinc-800",
    profileSectionTitleText: "text-zinc-100",
    profileSectionContent: "text-zinc-300",
    profileSectionPrimaryButton: "text-[#C8A96E] hover:text-[#b8996e]",

    // Badges
    badge: "bg-zinc-800 text-zinc-300 border-zinc-700",

    // Modals
    modalBackdrop: "bg-black/60 backdrop-blur-sm",
    modalContent: "bg-zinc-950 border border-zinc-800",

    // Org switcher
    organizationSwitcherTrigger:
      "text-zinc-100 hover:bg-zinc-800 border-zinc-700",
    organizationSwitcherPopoverCard: "bg-zinc-950 border border-zinc-800",
    organizationSwitcherPopoverActionButton: "hover:bg-zinc-900 text-zinc-300",
    organizationPreviewMainIdentifier: "text-zinc-100",
    organizationPreviewSecondaryIdentifier: "text-zinc-400",

    // Scrollbar
    scrollBox: "[&::-webkit-scrollbar-thumb]:bg-zinc-700",

    // Alerts
    alertText: "text-zinc-300",

    // Table rows (members list, etc.)
    tableHead: "text-zinc-400 border-b border-zinc-800",
    tableBodyRow: "border-b border-zinc-800 hover:bg-zinc-900",
  },
};
