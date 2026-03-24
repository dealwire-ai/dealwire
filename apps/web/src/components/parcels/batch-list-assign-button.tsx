"use client";

import { useState } from "react";
import { ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useApi } from "@/hooks/use-api";
import { LIST_CONFIG, type ParcelListType } from "./list-assign-popover";
import { X } from "lucide-react";

const LIST_OPTIONS: ParcelListType[] = [
  "IMMEDIATE",
  "LONG_TERM",
  "NOT_INTERESTED",
];

interface BatchListAssignButtonProps {
  selectedBbls: Set<string>;
  onAssigned: (listType: ParcelListType | null) => void;
}

export function BatchListAssignButton({
  selectedBbls,
  onAssigned,
}: BatchListAssignButtonProps) {
  const { apiCall } = useApi();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSelect(listType: ParcelListType | null) {
    setOpen(false);
    setLoading(true);
    onAssigned(listType);

    try {
      await apiCall("/public-data/parcels/batch-list", {
        method: "POST",
        body: JSON.stringify({
          bbls: Array.from(selectedBbls),
          listType,
        }),
      });
    } catch {
      // Already optimistically updated — user can re-assign if needed
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5"
          disabled={loading}
        >
          <ListChecks className="w-3.5 h-3.5" />
          {loading ? "Assigning..." : "Assign List"}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[180px] p-1 bg-zinc-950 border-zinc-800"
        align="start"
      >
        <div className="space-y-0.5">
          {LIST_OPTIONS.map((type) => {
            const config = LIST_CONFIG[type];
            return (
              <button
                key={type}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-zinc-800/50 transition-colors"
                onClick={() => handleSelect(type)}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: config.color }}
                />
                <span className="text-zinc-200">{config.label}</span>
              </button>
            );
          })}
          <div className="border-t border-zinc-800 my-1" />
          <button
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-400 transition-colors"
            onClick={() => handleSelect(null)}
          >
            <X className="h-3 w-3" />
            Remove from list
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
