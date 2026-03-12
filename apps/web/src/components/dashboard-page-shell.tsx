interface DashboardPageShellProps {
  title: string;
  /** Buttons/controls rendered on the right side of the header */
  actions?: React.ReactNode;
  /** Extra content rendered at the bottom of the header bar (e.g. tab navigation) */
  headerTabNavigation?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Standard page shell used by all dashboard pages.
 *
 * Structure:
 *   ┌─ header (title + actions) ──────────────────┐
 *   │  [headerTabNavigation — optional]            │  ← border-b
 *   ├──────────────────────────────────────────────┤
 *   │  children (scrollable)                       │
 *   └──────────────────────────────────────────────┘
 */
export function DashboardPageShell({
  title,
  actions,
  headerTabNavigation,
  children,
}: DashboardPageShellProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div
        className={`px-8 border-b border-zinc-800/60 ${headerTabNavigation ? "pt-6 pb-0" : "py-5"}`}
      >
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
        {headerTabNavigation}
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto px-8 py-6">{children}</div>
    </div>
  );
}
