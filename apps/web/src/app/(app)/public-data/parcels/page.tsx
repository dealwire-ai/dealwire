"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  ParcelTable,
  type Parcel,
  DEFAULT_VISIBLE_COLUMNS,
} from "@/components/parcels/parcel-table";
import { ParcelFilters } from "@/components/parcels/parcel-filters";
import { ExportButton } from "@/components/parcels/export-button";
import { ColumnToggle } from "@/components/parcels/column-toggle";
import { BatchSkipTraceButton } from "@/components/parcels/batch-skip-trace-button";

import { TableToolbar } from "@/components/table-toolbar";
import { TablePagination } from "@/components/table-pagination";
import { TableSkeleton } from "@/components/table-skeleton";
import { useApi } from "@/hooks/use-api";
import { useTableState } from "@/hooks/use-table-state";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { Chatbot } from "@/components/chat/chatbot";

export default function ParcelsPage() {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();
  const { apiCall } = useApi();
  const { flags, loading: flagsLoading } = useFeatureFlags();

  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedBbls, setSelectedBbls] = useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return DEFAULT_VISIBLE_COLUMNS;
    try {
      const stored = localStorage.getItem("parcels-visible-columns");
      if (stored) return new Set(JSON.parse(stored) as string[]);
    } catch {
      // ignore
    }
    return DEFAULT_VISIBLE_COLUMNS;
  });

  const table = useTableState({
    defaultLimit: 50,
    defaultFilters: { borough: "3,4" },
    defaultSort: "distressScore",
    defaultOrder: "desc",
  });

  const fetchParcels = useCallback(async () => {
    if (!isLoaded || !userId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await apiCall(
        `/public-data/parcels?${table.queryString}`,
      );
      setParcels(response.data || []);
      if (response.pagination) table.setMeta(response.pagination);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load parcels");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, userId, table.queryString]);

  // Redirect if feature flag is off
  useEffect(() => {
    if (!flagsLoading && !flags.parcels) {
      router.push("/dashboard");
    }
  }, [flagsLoading, flags.parcels, router]);

  useEffect(() => {
    fetchParcels();
  }, [fetchParcels]);

  useEffect(() => {
    setExpandedRows(new Set());
    setSelectedBbls(new Set());
  }, [table.page, table.sort, table.order]);

  if (!isLoaded) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">NYC Parcels</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Distressed property analysis from public data
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ColumnToggle
              visibleColumns={visibleColumns}
              onToggle={(key) => {
                setVisibleColumns((prev) => {
                  const next = new Set(prev);
                  if (next.has(key)) {
                    next.delete(key);
                  } else {
                    next.add(key);
                  }
                  localStorage.setItem(
                    "parcels-visible-columns",
                    JSON.stringify([...next]),
                  );
                  return next;
                });
              }}
            />
            <ExportButton queryString={table.queryString} />
          </div>
        </div>

        {/* Main content */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <TableToolbar
            search={table.search}
            onSearchChange={table.setSearch}
            totalLabel="parcels"
            total={table.meta.total}
            hasActiveFilters={table.hasActiveFilters}
            onClearFilters={table.clearFilters}
            filterSlot={
              <ParcelFilters
                filters={table.filters}
                onSetFilter={table.setFilter}
              />
            }
            actionSlot={
              selectedBbls.size > 0 ? (
                <BatchSkipTraceButton
                  selectedBbls={selectedBbls}
                  onQueued={() => {
                    // Mark selected parcels as pending locally
                    setParcels((prev) =>
                      prev.map((p) =>
                        selectedBbls.has(p.bbl)
                          ? { ...p, skipTraceStatus: "pending" }
                          : p,
                      ),
                    );
                    setSelectedBbls(new Set());
                  }}
                />
              ) : null
            }
          />

          {error && (
            <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <TableSkeleton columns={visibleColumns.size + 3} />
          ) : (
            <ParcelTable
              parcels={parcels}
              expandedRows={expandedRows}
              visibleColumns={visibleColumns}
              onToggleRow={(id) => {
                const newExpanded = new Set(expandedRows);
                if (newExpanded.has(id)) {
                  newExpanded.delete(id);
                } else {
                  newExpanded.add(id);
                }
                setExpandedRows(newExpanded);
              }}
              selectedBbls={selectedBbls}
              onToggleSelect={(bbl) => {
                const next = new Set(selectedBbls);
                if (next.has(bbl)) {
                  next.delete(bbl);
                } else {
                  next.add(bbl);
                }
                setSelectedBbls(next);
              }}
              onSelectAll={(bbls) => {
                if (bbls.length === 0) {
                  setSelectedBbls(new Set());
                } else {
                  setSelectedBbls(new Set(bbls));
                }
              }}
              hasActiveFilters={table.hasActiveFilters}
              onClearFilters={table.clearFilters}
              sort={table.sort}
              order={table.order}
              onSortChange={table.setSort}
              onParcelUpdated={(bbl, updates) => {
                setParcels((prev) =>
                  prev.map((p) => (p.bbl === bbl ? { ...p, ...updates } : p)),
                );
              }}
            />
          )}

          <TablePagination
            page={table.page}
            totalPages={table.meta.totalPages}
            total={table.meta.total}
            limit={table.limit}
            onPageChange={table.setPage}
          />
        </div>
      </div>

      <Chatbot />
    </div>
  );
}
