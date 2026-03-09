"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

interface TableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  totalLabel: string;
  total: number;
  filterSlot?: React.ReactNode;
  actionSlot?: React.ReactNode;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
}

export function TableToolbar({
  search,
  onSearchChange,
  totalLabel,
  total,
  filterSlot,
  actionSlot,
  hasActiveFilters,
  onClearFilters,
}: TableToolbarProps) {
  return (
    <div className="space-y-3 mb-4">
      {/* Row 1: Search + actions + count */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-zinc-950 border-zinc-800 text-white placeholder:text-zinc-500 focus-visible:ring-[#C8A96E]/50"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {actionSlot}
        <div className="ml-auto flex items-center gap-3">
          {hasActiveFilters && onClearFilters && (
            <button
              onClick={onClearFilters}
              className="text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Clear filters
            </button>
          )}
          <span className="text-sm text-zinc-400">
            {total} {totalLabel}
          </span>
        </div>
      </div>
      {/* Row 2: Filters */}
      {filterSlot && (
        <div className="flex items-center gap-2">{filterSlot}</div>
      )}
    </div>
  );
}
