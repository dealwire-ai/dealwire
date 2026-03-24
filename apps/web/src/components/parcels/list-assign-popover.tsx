"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useApi } from "@/hooks/use-api";

export type ParcelListType = "IMMEDIATE" | "LONG_TERM" | "NOT_INTERESTED";

export const LIST_CONFIG: Record<
  ParcelListType,
  { label: string; color: string; bgClass: string }
> = {
  IMMEDIATE: {
    label: "Immediate",
    color: "#22c55e",
    bgClass: "bg-green-900/30 text-green-400 border-green-900/50",
  },
  LONG_TERM: {
    label: "Long Term",
    color: "#3b82f6",
    bgClass: "bg-blue-900/30 text-blue-400 border-blue-900/50",
  },
  NOT_INTERESTED: {
    label: "Not Interested",
    color: "#ef4444",
    bgClass: "bg-red-900/30 text-red-400 border-red-900/50",
  },
} as const;

const LIST_OPTIONS: ParcelListType[] = [
  "IMMEDIATE",
  "LONG_TERM",
  "NOT_INTERESTED",
];

interface ListAssignPopoverProps {
  bbl: string;
  currentList: ParcelListType | null;
  onAssigned: (listType: ParcelListType | null) => void;
}

export function ListAssignPopover({
  bbl,
  currentList,
  onAssigned,
}: ListAssignPopoverProps) {
  const { apiCall } = useApi();
  const [open, setOpen] = useState(false);

  async function handleSelect(listType: ParcelListType | null) {
    setOpen(false);
    const prev = currentList;
    onAssigned(listType);

    try {
      await apiCall(`/public-data/parcels/${bbl}/list`, {
        method: "PUT",
        body: JSON.stringify({ listType }),
      });
    } catch {
      // Revert on error
      onAssigned(prev);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center"
          onClick={(e) => e.stopPropagation()}
        >
          {currentList ? (
            <ListBadge listType={currentList} />
          ) : (
            <span className="text-zinc-600 text-xs hover:text-zinc-400 transition-colors">
              &mdash;
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[180px] p-1 bg-zinc-950 border-zinc-800"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-0.5">
          {LIST_OPTIONS.map((type) => {
            const config = LIST_CONFIG[type];
            const isActive = currentList === type;
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
                {isActive && (
                  <Check className="h-3.5 w-3.5 text-zinc-400 ml-auto" />
                )}
              </button>
            );
          })}
          {currentList && (
            <>
              <div className="border-t border-zinc-800 my-1" />
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-400 transition-colors"
                onClick={() => handleSelect(null)}
              >
                <X className="h-3 w-3" />
                Remove from list
              </button>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ListBadge({ listType }: { listType: ParcelListType }) {
  const config = LIST_CONFIG[listType];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs border ${config.bgClass}`}
    >
      {config.label}
    </span>
  );
}
