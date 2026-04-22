import { cn } from "@/lib/utils";

type EyebrowProps = {
  children: React.ReactNode;
  className?: string;
};

export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <p
      className={cn(
        "text-[#C8A96E] text-xs font-mono tracking-widest uppercase",
        className,
      )}
    >
      {children}
    </p>
  );
}
