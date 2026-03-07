"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { ParcelTable, type Parcel } from "@/components/parcels/parcel-table";
import { ParcelFilters } from "@/components/parcels/parcel-filters";
import { ExportButton } from "@/components/parcels/export-button";
import { BatchSkipTraceButton } from "@/components/parcels/batch-skip-trace-button";
import { TableToolbar } from "@/components/table-toolbar";
import { TablePagination } from "@/components/table-pagination";
import { TableSkeleton } from "@/components/table-skeleton";
import { useApi } from "@/hooks/use-api";
import { useTableState } from "@/hooks/use-table-state";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { Chatbot } from "@/components/chat/chatbot";

interface Stats {
  total: number;
  withActiveLiens: number;
  avgDistressScore: number;
  byBorough: Array<{
    borough: string;
    count: number;
    avgScore: number;
  }>;
}

const BOROUGH_NAMES: Record<string, string> = {
  "1": "Manhattan",
  "2": "Bronx",
  "3": "Brooklyn",
  "4": "Queens",
  "5": "Staten Island",
};

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

  const table = useTableState({
    defaultLimit: 50,
    defaultFilters: { excludeCoops: "true", borough: "3,4" },
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
      const excludeCoops = table.filters.excludeCoops;
      const params = new URLSearchParams();
      if (borough) params.set("borough", borough);
      if (excludeCoops) params.set("excludeCoops", excludeCoops);
      const response = await apiCall(`/public-data/stats?${params.toString()}`);
      setStats(response);
    } catch {
      // Stats are non-critical
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, userId, table.filters.borough, table.filters.excludeCoops]);

  useEffect(() => {
    if (isLoaded && !userId) {
      router.push("/sign-in");
    }
  }, [isLoaded, userId, router]);

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
      <div className="min-h-screen bg-black text-white p-8">
        <div className="text-center py-12 text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-[1600px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">NYC Parcels</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Distressed property analysis from public data
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ExportButton queryString={table.queryString} />
            <a
              href="/dashboard"
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
            >
              Dashboard
            </a>
          </div>
        </div>

        {/* Stats bar */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <StatCard
              label="Total Parcels"
              value={stats.total.toLocaleString()}
            />
            <StatCard
              label="Active Liens"
              value={stats.withActiveLiens.toLocaleString()}
            />
            <StatCard
              label="Avg Distress Score"
              value={stats.avgDistressScore.toString()}
            />
            <StatCard
              label="Proportions per Borough"
              value={stats.byBorough
                .map(
                  (b) => `${BOROUGH_NAMES[b.borough] || b.borough}: ${b.count}`,
                )
                .join(", ")}
              small
            />
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
            <TableSkeleton columns={13} />
          ) : (
            <ParcelTable
              parcels={parcels}
              expandedRows={expandedRows}
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

function StatCard({
  label,
  value,
  small,
}: {
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <div className="text-xs text-zinc-400 mb-1">{label}</div>
      <div
        className={`font-semibold ${small ? "text-sm text-zinc-300" : "text-xl text-white"}`}
      >
        {value}
      </div>
    </div>
  );
}
