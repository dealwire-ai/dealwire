"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useApi } from "@/hooks/use-api";
import { useTableState } from "@/hooks/use-table-state";
import { DashboardPageShell } from "@/components/dashboard-page-shell";
import { UnderwritingRunsTable } from "@/components/underwriting-runs-table";
import { TableToolbar } from "@/components/table-toolbar";
import { TablePagination } from "@/components/table-pagination";
import type { UnderwritingRun } from "@/types/api";

export default function UnderwrittenDealsPage() {
  const { userId, isLoaded } = useAuth();
  const { apiCall } = useApi();
  const table = useTableState();
  const [runs, setRuns] = useState<UnderwritingRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !userId) return;
    setLoading(true);
    setError(null);
    apiCall(`/underwriting/runs?${table.queryString}`)
      .then((res) => {
        setRuns(res.data);
        table.setMeta(res.pagination);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load runs");
        setRuns([]);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, userId, table.queryString]);

  return (
    <DashboardPageShell title="Underwritten Deals">
      <div>
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          totalLabel="runs"
          total={table.meta.total}
          hasActiveFilters={table.hasActiveFilters}
          onClearFilters={table.clearFilters}
        />
        {error && (
          <div className="p-4 bg-red-900/20 border border-red-900/50 rounded-lg text-red-400 mb-4">
            {error}
          </div>
        )}
        {loading ? (
          <div className="text-zinc-400 py-8 text-center">Loading runs...</div>
        ) : (
          <UnderwritingRunsTable
            runs={runs}
            onRunDeleted={(id) =>
              setRuns((prev) => prev.filter((r) => r.id !== id))
            }
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
    </DashboardPageShell>
  );
}
