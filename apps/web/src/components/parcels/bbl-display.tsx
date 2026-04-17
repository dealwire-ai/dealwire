"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { parseBbl } from "@/lib/bbl";
import { cn } from "@/lib/utils";

interface BblDisplayProps {
  bbl: string;
  className?: string;
}

export function BblDisplay({ bbl, className }: BblDisplayProps) {
  const parts = parseBbl(bbl);
  const hasParts = parts.borough !== "";

  const trigger = (
    <span
      className={cn(
        "font-mono tabular-nums",
        hasParts &&
          "cursor-help underline decoration-dotted decoration-zinc-600 underline-offset-2",
        className,
      )}
    >
      {parts.formatted}
    </span>
  );

  if (!hasParts) {
    return trigger;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-xs">
          <div className="space-y-1">
            <div className="font-medium">Borough-Block-Lot</div>
            <div>
              <span className="text-zinc-400">Borough </span>
              <span className="font-mono">{parts.borough}</span>
              {parts.boroughName && (
                <span className="text-zinc-400"> — {parts.boroughName}</span>
              )}
            </div>
            <div>
              <span className="text-zinc-400">Block </span>
              <span className="font-mono">{parts.block}</span>
            </div>
            <div>
              <span className="text-zinc-400">Lot </span>
              <span className="font-mono">{parts.lot}</span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
