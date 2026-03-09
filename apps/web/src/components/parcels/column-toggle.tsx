"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Columns3, ChevronDown } from "lucide-react";
import { COLUMNS, DEFAULT_VISIBLE_COLUMNS } from "./parcel-table";

interface ColumnToggleProps {
  visibleColumns: Set<string>;
  onToggle: (key: string) => void;
}

export function ColumnToggle({ visibleColumns, onToggle }: ColumnToggleProps) {
  const [open, setOpen] = useState(false);

  const nonDefaultCount = COLUMNS.filter((c) => {
    const isVisible = visibleColumns.has(c.key);
    const isDefault = DEFAULT_VISIBLE_COLUMNS.has(c.key);
    return isVisible !== isDefault;
  }).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-zinc-950 border-zinc-800 text-white hover:bg-zinc-900 font-normal gap-1.5"
        >
          <Columns3 className="h-3.5 w-3.5" />
          Columns
          {nonDefaultCount > 0 && (
            <span className="ml-0.5 text-[10px] bg-[#C8A96E]/20 text-[#C8A96E] rounded-full px-1.5 py-0.5 leading-none">
              {nonDefaultCount}
            </span>
          )}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[220px] p-2 bg-zinc-950 border-zinc-800"
        align="end"
      >
        <div className="space-y-0.5">
          {COLUMNS.map((col) => (
            <label
              key={col.key}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800/50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={visibleColumns.has(col.key)}
                onChange={() => onToggle(col.key)}
                className="rounded border-zinc-600 accent-[#C8A96E]"
              />
              <span className="text-sm text-zinc-200">{col.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
