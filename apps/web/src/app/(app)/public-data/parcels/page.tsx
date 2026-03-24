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
import { BatchListAssignButton } from "@/components/parcels/batch-list-assign-button";
import type { ParcelListType } from "@/components/parcels/list-assign-popover";
import { DataCoverageBar } from "@/components/parcels/data-coverage-bar";
import { TableToolbar } from "@/components/table-toolbar";
import { TablePagination } from "@/components/table-pagination";
import { TableSkeleton } from "@/components/table-skeleton";
import { useApi } from "@/hooks/use-api";
import { useTableState } from "@/hooks/use-table-state";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
// import { Chatbot } from "@/components/chat/chatbot";

interface Stats {
  total: number;
  withPlutoData: number;
  withViolations: number;
  withTaxBills: number;
  withNyctlData: number;
  withSkipTrace: number;
}

export default function ParcelsPage() {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();
  const { apiCall } = useApi();
  const { flags, loading: flagsLoading } = useFeatureFlags();

  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedBbls, setSelectedBbls] = useState<Set<string>>(new Set());
  const [showCoverage, setShowCoverage] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("parcels-show-coverage") !== "false";
  });
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

  const fetchStats = useCallback(async () => {
    if (!isLoaded || !userId) return;
    try {
      const borough = table.filters.borough;
      const params = new URLSearchParams();
      if (borough) params.set("borough", borough);
      const response = await apiCall(`/public-data/stats?${params.toString()}`);
      setStats(response);
    } catch {
      // Stats are non-critical
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, userId, table.filters.borough]);

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
    fetchStats();
  }, [fetchStats]);

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

        {/* Data Coverage Dashboard */}
        {stats && (
          <div className="mb-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg">
              <button
                onClick={() => {
                  const next = !showCoverage;
                  setShowCoverage(next);
                  localStorage.setItem("parcels-show-coverage", String(next));
                }}
                className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-zinc-400 hover:text-zinc-300 transition-colors"
              >
                <span>Data Coverage</span>
                <span>{showCoverage ? "Hide" : "Show"}</span>
              </button>
              {showCoverage && (
                <div className="px-4 pb-4 space-y-2.5">
                  <DataCoverageBar
                    label="PLUTO Property Data"
                    count={stats.withPlutoData}
                    total={stats.total}
                  />
                  <DataCoverageBar
                    label="HPD Violations"
                    count={stats.withViolations}
                    total={stats.total}
                  />
                  <DataCoverageBar
                    label="Outstanding Tax Bills"
                    count={stats.withTaxBills}
                    total={stats.total}
                  />
                  <DataCoverageBar
                    label="NYCTL Lien Sale Data"
                    count={stats.withNyctlData}
                    total={stats.total}
                  />
                  <DataCoverageBar
                    label="Skip Traced (Phones)"
                    count={stats.withSkipTrace}
                    total={stats.total}
                  />
                </div>
              )}
            </div>
          </div>
        )}

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
                <div className="flex items-center gap-2">
                  <BatchListAssignButton
                    selectedBbls={selectedBbls}
                    onAssigned={(listType: ParcelListType | null) => {
                      setParcels((prev) =>
                        prev.map((p) =>
                          selectedBbls.has(p.bbl)
                            ? { ...p, _listType: listType }
                            : p,
                        ),
                      );
                      setSelectedBbls(new Set());
                    }}
                  />
                  <BatchSkipTraceButton
                    selectedBbls={selectedBbls}
                    onQueued={() => {
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
                </div>
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

      {/* <Chatbot /> */}
    </div>
  );
}
