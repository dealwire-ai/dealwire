"use client";

import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, Search, X } from "lucide-react";
import { BUILDING_CLASS_LABELS } from "@/lib/building-class-labels";

const BUILDING_CLASS_OPTIONS = Object.entries(BUILDING_CLASS_LABELS).sort(
  ([a], [b]) => a.localeCompare(b)
);

function BuildingClassMultiSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = value ? value.split(",").map((c) => c.trim()).filter(Boolean) : [];

  const filtered = useMemo(() => {
    if (!search.trim()) return BUILDING_CLASS_OPTIONS;
    const s = search.toLowerCase();
    return BUILDING_CLASS_OPTIONS.filter(
      ([code, label]) =>
        code.toLowerCase().includes(s) || label.toLowerCase().includes(s)
    );
  }, [search]);

  const toggle = (code: string) => {
    const next = selected.includes(code)
      ? selected.filter((c) => c !== code)
      : [...selected, code];
    onChange(next.length ? next.join(",") : "");
  };

  const clear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearch("");
  };

  const label =
    selected.length === 0
      ? "Building Class"
      : selected.length <= 2
        ? selected.map((c) => `${c} — ${BUILDING_CLASS_LABELS[c] || c}`).join(", ")
        : `${selected.length} classes`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-[220px] justify-between bg-zinc-950 border-zinc-800 text-white hover:bg-zinc-900 font-normal text-left"
        >
          <span className="truncate">{label}</span>
          <div className="flex items-center gap-1 shrink-0">
            {selected.length > 0 && (
              <X
                className="h-3.5 w-3.5 opacity-60 hover:opacity-100"
                onClick={clear}
              />
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[320px] p-0 bg-zinc-950 border-zinc-800"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="p-2 border-b border-zinc-800">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <Input
              placeholder="Search building classes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 bg-zinc-900 border-zinc-800 text-white text-sm placeholder:text-zinc-500"
            />
          </div>
        </div>
        <ScrollArea className="h-[280px]">
          <div className="p-1">
            {filtered.map(([code, label]) => (
              <label
                key={code}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800/50 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(code)}
                  onChange={() => toggle(code)}
                  className="rounded border-zinc-600 accent-[#3ECFA0]"
                />
                <span className="text-zinc-200 truncate">
                  {code} — {label}
                </span>
              </label>
            ))}
            {filtered.length === 0 && (
              <div className="px-2 py-4 text-sm text-zinc-500 text-center">
                No matches
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

const BOROUGHS = [
  { code: "3", name: "Brooklyn" },
  { code: "4", name: "Queens" },
];

interface ParcelFiltersProps {
  filters: Record<string, string>;
  onSetFilter: (key: string, value: string) => void;
}

export function ParcelFilters({ filters, onSetFilter }: ParcelFiltersProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Borough filter */}
      <Select
        value={filters.borough || "all"}
        onValueChange={(value) =>
          onSetFilter("borough", value === "all" ? "" : value)
        }
      >
        <SelectTrigger className="w-[140px] bg-zinc-950 border-zinc-800 text-white">
          <SelectValue placeholder="Borough" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Boroughs</SelectItem>
          {BOROUGHS.map((b) => (
            <SelectItem key={b.code} value={b.code}>
              {b.name}
            </SelectItem>
          ))}
          <SelectItem value="3,4">BK + QN</SelectItem>
        </SelectContent>
      </Select>

      {/* Exclude Coops toggle */}
      <Button
        variant={filters.excludeCoops === "true" ? "default" : "outline"}
        size="sm"
        onClick={() =>
          onSetFilter(
            "excludeCoops",
            filters.excludeCoops === "true" ? "" : "true"
          )
        }
        className="text-xs"
      >
        Exclude Coops
      </Button>

      {/* Has Active Lien toggle */}
      <Button
        variant={filters.hasActiveLien === "true" ? "default" : "outline"}
        size="sm"
        onClick={() =>
          onSetFilter(
            "hasActiveLien",
            filters.hasActiveLien === "true" ? "" : "true"
          )
        }
        className="text-xs"
      >
        Active Liens Only
      </Button>

      {/* Min distress score */}
      <Select
        value={filters.minDistressScore || "any"}
        onValueChange={(value) =>
          onSetFilter("minDistressScore", value === "any" ? "" : value)
        }
      >
        <SelectTrigger className="w-[150px] bg-zinc-950 border-zinc-800 text-white">
          <SelectValue placeholder="Min Score" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any Score</SelectItem>
          <SelectItem value="20">Score 20+</SelectItem>
          <SelectItem value="30">Score 30+</SelectItem>
          <SelectItem value="50">Score 50+</SelectItem>
          <SelectItem value="60">Score 60+</SelectItem>
          <SelectItem value="80">Score 80+</SelectItem>
        </SelectContent>
      </Select>

      {/* Building class */}
      <BuildingClassMultiSelect
        value={filters.buildingClass || ""}
        onChange={(v) => onSetFilter("buildingClass", v)}
      />
    </div>
  );
}
