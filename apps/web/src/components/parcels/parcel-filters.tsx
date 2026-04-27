"use client";

import { useEffect, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  MultiSelectSearchFilter,
  type MultiSelectOption,
} from "./multi-select-search-filter";
import { useApi } from "@/hooks/use-api";

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
  { code: "1", name: "Manhattan" },
  { code: "3", name: "Brooklyn" },
  { code: "4", name: "Queens" },
];

/** Popover-based single-select filter (replaces Radix Select which has pointer event issues) */
function FilterSelect({
  value,
  onValueChange,
  options,
  width,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  width: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

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
          <span className="truncate">{selected?.label ?? value}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-1 bg-zinc-950 border-zinc-800"
        align="start"
      >
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => {
              onValueChange(opt.value);
              setOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800/50 cursor-pointer",
              opt.value === value && "text-white",
            )}
          >
            <Check
              className={cn(
                "h-4 w-4 shrink-0",
                opt.value === value ? "opacity-100" : "opacity-0",
              )}
            />
            {opt.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

interface ParcelFiltersProps {
  filters: Record<string, string>;
  onSetFilter: (key: string, value: string) => void;
}

export function ParcelFilters({ filters, onSetFilter }: ParcelFiltersProps) {
  const { apiCall } = useApi();
  const [zipOptions, setZipOptions] = useState<MultiSelectOption[]>([]);

  // Re-fetch zip options whenever non-zip filters change so the list narrows.
  // Strip `zipCode` from the params so the dropdown stays stable while the user
  // adds/removes zip selections.
  const otherFiltersKey = Object.entries(filters)
    .filter(([k, v]) => k !== "zipCode" && v)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (k !== "zipCode" && v) params.set(k, v);
    }
    apiCall(`/public-data/parcels/zip-options?${params.toString()}`)
      .then((res: { zipCodes: MultiSelectOption[] }) => {
        if (!cancelled) setZipOptions(res.zipCodes ?? []);
      })
      .catch(() => {
        // Non-critical; leave whatever we already have
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherFiltersKey]);

  const selectedZips = filters.zipCode
    ? filters.zipCode.split(",").filter(Boolean)
    : [];

  return (
    <>
      {/* Borough filter */}
      <FilterSelect
        value={filters.borough || "all"}
        onValueChange={(value) =>
          onSetFilter("borough", value === "all" ? "" : value)
        }
        width="w-[140px]"
        options={[
          { value: "all", label: "All Boroughs" },
          ...BOROUGHS.map((b) => ({ value: b.code, label: b.name })),
          { value: "3,4", label: "BK + QN" },
          { value: "1,3,4", label: "MN + BK + QN" },
        ]}
      />

      {/* Zip code (multi-select with search) */}
      <MultiSelectSearchFilter
        label="Zip Code"
        value={selectedZips}
        options={zipOptions}
        onChange={(next) => onSetFilter("zipCode", next.join(","))}
        width="w-[170px]"
        searchPlaceholder="Search zip..."
        emptyMessage="No zip codes match."
      />

      {/* Min distress score */}
      <FilterSelect
        value={filters.minDistressScore || "any"}
        onValueChange={(value) =>
          onSetFilter("minDistressScore", value === "any" ? "" : value)
        }
        width="w-[150px]"
        options={[
          { value: "any", label: "Any Score" },
          { value: "20", label: "Score 20+" },
          { value: "30", label: "Score 30+" },
          { value: "50", label: "Score 50+" },
          { value: "60", label: "Score 60+" },
          { value: "80", label: "Score 80+" },
        ]}
      />

      {/* Min outstanding tax bill */}
      <FilterSelect
        value={filters.minOutstandingTaxBill || "any"}
        onValueChange={(value) =>
          onSetFilter("minOutstandingTaxBill", value === "any" ? "" : value)
        }
        width="w-[160px]"
        options={[
          { value: "any", label: "Tax Bill" },
          { value: "1", label: "Has Tax Bill" },
          { value: "1000", label: "$1,000+" },
          { value: "5000", label: "$5,000+" },
          { value: "10000", label: "$10,000+" },
          { value: "25000", label: "$25,000+" },
        ]}
      />

      {/* Min lien sale amount */}
      <FilterSelect
        value={filters.minLienSaleAmount || "any"}
        onValueChange={(value) =>
          onSetFilter("minLienSaleAmount", value === "any" ? "" : value)
        }
        width="w-[170px]"
        options={[
          { value: "any", label: "Lien Sale" },
          { value: "1", label: "Has Lien Sale" },
          { value: "10000", label: "$10K+" },
          { value: "25000", label: "$25K+" },
          { value: "50000", label: "$50K+" },
          { value: "100000", label: "$100K+" },
        ]}
      />

      {/* Skip trace / phone filter */}
      <FilterSelect
        value={filters.skipTraceStatus || "any"}
        onValueChange={(value) =>
          onSetFilter("skipTraceStatus", value === "any" ? "" : value)
        }
        width="w-[150px]"
        options={[
          { value: "any", label: "Phone" },
          { value: "found", label: "Has Phone" },
          { value: "not_found", label: "No Phone" },
          { value: "pending", label: "Pending" },
        ]}
      />

      {/* Building class groups */}
      <BuildingClassGroupFilter
        value={filters.buildingClassGroups || ""}
        onChange={(v) => onSetFilter("buildingClassGroups", v)}
      />

      {/* List filter */}
      <FilterSelect
        value={filters.listType || filters.hasNoList || "all"}
        onValueChange={(value) => {
          if (value === "all") {
            onSetFilter("listType", "");
            onSetFilter("hasNoList", "");
          } else if (value === "uncategorized") {
            onSetFilter("listType", "");
            onSetFilter("hasNoList", "true");
          } else {
            onSetFilter("hasNoList", "");
            onSetFilter("listType", value);
          }
        }}
        width="w-[160px]"
        options={[
          { value: "all", label: "All Lists" },
          { value: "uncategorized", label: "Uncategorized" },
          { value: "IMMEDIATE", label: "Immediate" },
          { value: "LONG_TERM", label: "Long Term" },
          { value: "NOT_INTERESTED", label: "Not Interested" },
        ]}
      />
    </>
  );
}
