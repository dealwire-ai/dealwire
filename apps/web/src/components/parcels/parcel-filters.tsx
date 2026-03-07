"use client";

import { useState } from "react";
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
import { ChevronDown } from "lucide-react";

/**
 * Building class groups per Daniel's 3/4 feedback:
 * - Residential: A, B, C (1-3 family homes)
 * - Commercial/Other: E through Z (commercial, industrial, mixed-use, vacant)
 * - Walk-up Apartments: C1-C7 (walk-up multi-family)
 * D class excluded entirely (elevator apartments, mostly coops)
 */
const BUILDING_CLASS_GROUPS = [
  {
    id: "residential",
    label: "Residential (A, B, C)",
    description: "1-3 family homes",
    prefixes: ["A", "B", "C"],
    // C1-C7 are in the walk-up group, not here
    excludePrefixes: [
      "C1",
      "C2",
      "C3",
      "C4",
      "C5",
      "C6",
      "C7",
      "C8",
      "C9",
      "CC",
    ],
  },
  {
    id: "commercial",
    label: "Commercial/Other (E-Z)",
    description: "Commercial, industrial, mixed-use, vacant",
    prefixes: [
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
      "M",
      "N",
      "O",
      "P",
      "Q",
      "R",
      "S",
      "T",
      "U",
      "V",
      "W",
      "X",
      "Y",
      "Z",
    ],
    excludePrefixes: [],
  },
  {
    id: "walkup",
    label: "Walk-up Apartments (C1-C7)",
    description: "Walk-up multi-family buildings",
    prefixes: ["C1", "C2", "C3", "C4", "C5", "C6", "C7"],
    excludePrefixes: [],
  },
] as const;

function BuildingClassGroupFilter({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedGroups = value ? value.split(",").filter(Boolean) : [];

  const toggle = (groupId: string) => {
    const next = selectedGroups.includes(groupId)
      ? selectedGroups.filter((g) => g !== groupId)
      : [...selectedGroups, groupId];
    onChange(next.join(","));
  };

  const groupCount = selectedGroups.length;
  const label =
    groupCount === 0
      ? "Building Class"
      : groupCount === 3
        ? "All Classes"
        : selectedGroups
            .map(
              (id) =>
                BUILDING_CLASS_GROUPS.find((g) => g.id === id)?.label.split(
                  " (",
                )[0],
            )
            .filter(Boolean)
            .join(", ");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="w-[220px] justify-between bg-zinc-950 border-zinc-800 text-white hover:bg-zinc-900 font-normal text-left"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[300px] p-2 bg-zinc-950 border-zinc-800"
        align="start"
      >
        <div className="space-y-1">
          {BUILDING_CLASS_GROUPS.map((group) => (
            <label
              key={group.id}
              className="flex items-start gap-2 px-2 py-2 rounded hover:bg-zinc-800/50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedGroups.includes(group.id)}
                onChange={() => toggle(group.id)}
                className="mt-0.5 rounded border-zinc-600 accent-[#C8A96E]"
              />
              <div>
                <div className="text-sm text-zinc-200">{group.label}</div>
                <div className="text-xs text-zinc-500">{group.description}</div>
              </div>
            </label>
          ))}
          <div className="px-2 pt-1 text-xs text-zinc-600">
            D class (elevator apts/coops) always excluded
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Expand selected group IDs into building class prefix filters for the API */
export function expandBuildingClassGroups(groupIds: string[]): string[] {
  const prefixes: string[] = [];
  for (const id of groupIds) {
    const group = BUILDING_CLASS_GROUPS.find((g) => g.id === id);
    if (group) {
      prefixes.push(...group.prefixes);
    }
  }
  return prefixes;
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
            filters.excludeCoops === "true" ? "" : "true",
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
            filters.hasActiveLien === "true" ? "" : "true",
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

      {/* Building class groups */}
      <BuildingClassGroupFilter
        value={filters.buildingClassGroups || ""}
        onChange={(v) => onSetFilter("buildingClassGroups", v)}
      />
    </div>
  );
}
