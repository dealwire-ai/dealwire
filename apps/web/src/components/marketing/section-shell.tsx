import { cn } from "@/lib/utils";

type SectionShellProps = {
  id?: string;
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
};

/**
 * Standard section wrapper used across the marketing page — consistent padding,
 * top border, and the max-w-7xl → max-w-5xl nesting pattern.
 */
export function SectionShell({
  id,
  children,
  className,
  innerClassName,
}: SectionShellProps) {
  return (
    <section
      id={id}
      className={cn(
        "relative z-10 px-6 lg:px-16 py-24 lg:py-32 border-t border-white/[0.04]",
        className,
      )}
    >
      <div className="max-w-7xl mx-auto">
        <div className={cn("max-w-5xl mx-auto", innerClassName)}>
          {children}
        </div>
      </div>
    </section>
  );
}
