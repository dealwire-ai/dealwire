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
import { formatRelativeDate } from "@/lib/date-utils";

interface Stats {
  total: number;
  withPlutoData: number;
  withViolations: number;
  withTaxBills: number;
  withNyctlData: number;
  withSkipTrace: number;
}

interface SkipTraceUsage {
  used: number;
  limit: number;
  remaining: number;
}

interface IngestionRun {
  id: string;
  trigger: string;
  status: string;
  completedAt: string | null;
  startedAt: string;
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
  const [skipTraceUsage, setSkipTraceUsage] = useState<SkipTraceUsage | null>(
    null,
  );
  const [lastRun, setLastRun] = useState<IngestionRun | null>(null);
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

  const fetchSkipTraceUsage = useCallback(async () => {
    if (!isLoaded || !userId) return;
    try {
      const response = await apiCall("/public-data/parcels/skip-trace/usage");
      setSkipTraceUsage(response);
    } catch {
      // Non-critical
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, userId]);

  const fetchLastRun = useCallback(async () => {
    if (!isLoaded || !userId) return;
    try {
      const runs: IngestionRun[] = await apiCall("/public-data/ingestion-runs");
      const completed = runs.find((r) => r.status === "success");
      if (completed) setLastRun(completed);
    } catch {
      // Non-critical
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, userId]);

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
    fetchSkipTraceUsage();
  }, [fetchSkipTraceUsage]);

  useEffect(() => {
    fetchLastRun();
  }, [fetchLastRun]);

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
                <div className="flex items-center gap-3">
                  <span>Data Coverage</span>
                  {lastRun?.completedAt && (
                    <span className="text-zinc-500">
                      Last refreshed: {formatRelativeDate(lastRun.completedAt)}{" "}
                      ({lastRun.trigger})
                    </span>
                  )}
                </div>
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
                  {skipTraceUsage && (
                    <div className="mt-3 pt-3 border-t border-zinc-800">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-400 w-44 shrink-0">
                          Monthly Skip Tracing Quota
                        </span>
                        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, Math.round((skipTraceUsage.used / skipTraceUsage.limit) * 100))}%`,
                              backgroundColor:
                                skipTraceUsage.used / skipTraceUsage.limit > 0.9
                                  ? "#ef4444"
                                  : skipTraceUsage.used / skipTraceUsage.limit >
                                      0.7
                                    ? "#f59e0b"
                                    : "#C8A96E",
                            }}
                          />
                        </div>
                        <span className="text-xs text-zinc-300 w-28 text-right shrink-0 tabular-nums">
                          {skipTraceUsage.used} / {skipTraceUsage.limit}
                        </span>
                        <span className="text-xs text-zinc-500 w-10 text-right shrink-0 tabular-nums">
                          {Math.round(
                            (skipTraceUsage.used / skipTraceUsage.limit) * 100,
                          )}
                          %
                        </span>
                      </div>
                    </div>
                  )}
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
                    quotaRemaining={skipTraceUsage?.remaining}
                    quotaLimit={skipTraceUsage?.limit}
                    onQueued={() => {
                      setParcels((prev) =>
                        prev.map((p) =>
                          selectedBbls.has(p.bbl)
                            ? { ...p, skipTraceStatus: "pending" }
                            : p,
                        ),
                      );
                      setSelectedBbls(new Set());
                      fetchSkipTraceUsage();
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
