"use client";

import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label?: string;
  count?: number;
}

interface MultiSelectSearchFilterProps {
  label: string;
  value: string[];
  options: MultiSelectOption[];
  onChange: (next: string[]) => void;
  width?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
}

export function MultiSelectSearchFilter({
  label,
  value,
  options,
  onChange,
  width = "w-[200px]",
  searchPlaceholder = "Search...",
  emptyMessage = "No matches.",
}: MultiSelectSearchFilterProps) {
  const [open, setOpen] = useState(false);
  const selected = new Set(value);

  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    onChange(Array.from(next));
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const count = value.length;
  const triggerLabel =
    count === 0
      ? label
      : count === 1
        ? (options.find((o) => o.value === value[0])?.label ?? value[0])
        : `${count} selected`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            width,
            "justify-between bg-zinc-950 border-zinc-800 text-white hover:bg-zinc-900 font-normal text-left",
          )}
        >
          <span className="truncate">{triggerLabel}</span>
          <span className="flex items-center gap-1">
            {count > 0 && (
              <X
                className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
                onClick={clear}
              />
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn(width, "p-0 bg-zinc-950 border-zinc-800")}>
        <Command className="bg-transparent">
          <CommandInput
            placeholder={searchPlaceholder}
            className="text-white"
          />
          <CommandList>
            <CommandEmpty className="text-zinc-400">
              {emptyMessage}
            </CommandEmpty>
            {options.map((opt) => {
              const isSelected = selected.has(opt.value);
              return (
                <CommandItem
                  key={opt.value}
                  value={opt.label ?? opt.value}
                  onSelect={() => toggle(opt.value)}
                  className="text-white aria-selected:bg-zinc-900 cursor-pointer"
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex-1 truncate">
                    {opt.label ?? opt.value}
                  </span>
                  {opt.count !== undefined && (
                    <span className="text-xs text-zinc-500">{opt.count}</span>
                  )}
                </CommandItem>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
