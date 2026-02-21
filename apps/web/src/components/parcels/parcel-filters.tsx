"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const BOROUGHS = [
  { code: "1", name: "Manhattan" },
  { code: "2", name: "Bronx" },
  { code: "3", name: "Brooklyn" },
  { code: "4", name: "Queens" },
  { code: "5", name: "Staten Island" },
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
    </div>
  );
}
