"use client";

import { Badge } from "@/components/ui/badge";

interface ScoreBadgeProps {
  score: number | null | undefined;
}

export function ScoreBadge({ score }: ScoreBadgeProps) {
  if (score === null || score === undefined) {
    return <span className="text-zinc-500">-</span>;
  }

  const rounded = Math.round(score);

  let className: string;
  if (rounded >= 60) {
    className =
      "bg-red-900/30 text-red-400 border-red-900/50 hover:bg-red-900/40";
  } else if (rounded >= 30) {
    className =
      "bg-yellow-900/30 text-yellow-400 border-yellow-900/50 hover:bg-yellow-900/40";
  } else {
    className =
      "bg-green-900/30 text-green-400 border-green-900/50 hover:bg-green-900/40";
  }

  return <Badge className={className}>{rounded}</Badge>;
}
