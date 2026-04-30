"use client";

import { Fragment, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Download,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatRelativeDate } from "@/lib/date-utils";
import { useApi } from "@/hooks/use-api";
import type { UnderwritingRun } from "@/types/api";

interface UnitMixEntry {
  beds: number;
  baths: number;
  unitCount: number;
  avgMonthlyRent?: number | null;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value == null) return "-";
  return `${(value * 100).toFixed(1)}%`;
}

function StatusBadge({ status }: { status: UnderwritingRun["status"] }) {
  const styles = {
    COMPLETED: "bg-green-900/30 text-green-400 border-green-900/50",
    RUNNING: "bg-blue-900/30 text-blue-400 border-blue-900/50",
    FAILED: "bg-red-900/30 text-red-400 border-red-900/50",
  };
  return <Badge className={styles[status]}>{status}</Badge>;
}

/** Extract key metrics from analysisData */
function getMetrics(run: UnderwritingRun) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = run.analysisData as Record<string, any> | null;
  if (!d) return {};

  return {
    propertyName: d.propertyName,
    propertyAddress: d.propertyAddress
      ? [d.propertyAddress, d.city, d.state].filter(Boolean).join(", ")
      : null,
    askingPrice: d.askingPrice,
    noi: d.noi,
    capRate: d.capRate,
    totalUnits: d.totalUnits,
    occupancyRate: d.occupancyRate,
    analystNotes: d.analystNotes,
    unitMix: d.unitMix,
    missingDocs: d.missingDocs,
  };
}

function DownloadButton({ runId }: { runId: string }) {
  const { apiCall } = useApi();
  const [loading, setLoading] = useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const { url } = await apiCall(`/underwriting/runs/${runId}/proforma-url`);
      window.open(url, "_blank");
    } catch {
      // Silently fail — button is only shown when proforma exists
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors disabled:opacity-50"
    >
      <Download className="w-3 h-3" />
      {loading ? "..." : "Proforma"}
    </button>
  );
}

function DeleteButton({
  runId,
  onDeleted,
}: {
  runId: string;
  onDeleted?: (id: string) => void;
}) {
  const { apiCall } = useApi();
  const [loading, setLoading] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !confirm(
        "Delete this underwriting run? Any re-runs created from it will also be deleted.",
      )
    )
      return;
    setLoading(true);
    try {
      await apiCall(`/underwriting/runs/${runId}`, { method: "DELETE" });
      onDeleted?.(runId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      title="Delete run"
      className="inline-flex items-center gap-1 text-xs px-2 py-1 bg-zinc-800 hover:bg-red-900/50 rounded text-zinc-400 hover:text-red-400 transition-colors disabled:opacity-50"
    >
      <Trash2 className="w-3 h-3" />
      {loading ? "..." : "Delete"}
    </button>
  );
}

interface UnderwritingRunsTableProps {
  runs: UnderwritingRun[];
  emptyMessage?: string;
  onRunDeleted?: (id: string) => void;
}

export function UnderwritingRunsTable({
  runs,
  emptyMessage,
  onRunDeleted,
}: UnderwritingRunsTableProps) {
  const { apiCall } = useApi();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [detailCache, setDetailCache] = useState<
    Record<string, UnderwritingRun>
  >({});

  const toggleRow = async (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

    // Lazy-load full detail (including analysisData) on first expand
    if (!detailCache[id]) {
      try {
        const detail = await apiCall(`/underwriting/runs/${id}`);
        setDetailCache((prev) => ({ ...prev, [id]: detail }));
      } catch {
        // Detail fetch failed — expanded row will show without metrics
      }
    }
  };

  if (runs.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-400">
        <p>{emptyMessage || "No underwriting runs yet."}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10"></TableHead>
          <TableHead>Subject / Sender</TableHead>
          <TableHead>Property</TableHead>
          <TableHead>Key Metrics</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="w-44"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => {
          const isExpanded = expandedRows.has(run.id);
          const detail = detailCache[run.id];
          const m = getMetrics(detail ?? run);

          return (
            <Fragment key={run.id}>
              <TableRow
                className="cursor-pointer hover:bg-zinc-900/70"
                onClick={() => toggleRow(run.id)}
              >
                <TableCell>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  )}
                </TableCell>
                <TableCell>
                  <div className="max-w-[250px]">
                    <div className="font-medium text-white truncate">
                      {run.emailSubject || "No Subject"}
                    </div>
                    <div className="text-xs text-zinc-500 truncate">
                      {run.senderEmail}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="max-w-[200px]">
                    {m.propertyName ? (
                      <>
                        <div className="text-white truncate">
                          {m.propertyName}
                        </div>
                        {m.propertyAddress && (
                          <div className="text-xs text-zinc-500 truncate">
                            {m.propertyAddress}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="text-zinc-500">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-xs space-y-0.5">
                    {m.noi != null && (
                      <div>
                        <span className="text-zinc-500">NOI </span>
                        <span className="text-zinc-300">
                          {formatCurrency(m.noi)}
                        </span>
                      </div>
                    )}
                    {m.capRate != null && (
                      <div>
                        <span className="text-zinc-500">Cap </span>
                        <span className="text-zinc-300">
                          {formatPercent(m.capRate)}
                        </span>
                      </div>
                    )}
                    {m.totalUnits != null && (
                      <div>
                        <span className="text-zinc-500">Units </span>
                        <span className="text-zinc-300">{m.totalUnits}</span>
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <StatusBadge status={run.status} />
                    {run.humanReviewFlags.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-yellow-500">
                        <AlertTriangle className="w-3 h-3" />
                        {run.humanReviewFlags.length} flag
                        {run.humanReviewFlags.length !== 1 ? "s" : ""}
                      </div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {run.completedAt
                      ? formatRelativeDate(run.completedAt)
                      : formatRelativeDate(run.startedAt)}
                  </div>
                  {run.durationMs != null && (
                    <div className="text-xs text-zinc-500">
                      {(run.durationMs / 1000).toFixed(0)}s
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1.5">
                    {run.filledProformaModelS3Key && (
                      <DownloadButton runId={run.id} />
                    )}
                    <DeleteButton runId={run.id} onDeleted={onRunDeleted} />
                  </div>
                </TableCell>
              </TableRow>

              {/* Expanded detail row */}
              {isExpanded && (
                <TableRow>
                  <TableCell colSpan={7} className="bg-zinc-950/50 p-0">
                    <div className="border-l-2 border-[#C8A96E] pl-4 py-4 pr-4">
                      <ExpandedRunDetail
                        run={detail ?? run}
                        metrics={m}
                        loading={!detail}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ExpandedRunDetail({
  run,
  metrics: m,
  loading,
}: {
  run: UnderwritingRun;
  metrics: ReturnType<typeof getMetrics>;
  loading?: boolean;
}) {
  if (loading) {
    return <div className="text-zinc-400 text-sm py-2">Loading details...</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-6 text-sm">
      {/* Left: Financials */}
      <div>
        <div className="text-zinc-400 mb-2 font-medium">Financials</div>
        <div className="space-y-1.5">
          <MetricRow
            label="Asking Price"
            value={formatCurrency(m.askingPrice)}
          />
          <MetricRow label="NOI" value={formatCurrency(m.noi)} />
          <MetricRow label="Cap Rate" value={formatPercent(m.capRate)} />
          <MetricRow
            label="Total Units"
            value={m.totalUnits != null ? String(m.totalUnits) : "-"}
          />
          <MetricRow label="Occupancy" value={formatPercent(m.occupancyRate)} />
          {run.confidence != null && (
            <MetricRow
              label="Confidence"
              value={formatPercent(run.confidence)}
            />
          )}
        </div>

        {m.unitMix && Array.isArray(m.unitMix) && m.unitMix.length > 0 && (
          <div className="mt-4">
            <div className="text-zinc-400 mb-1 text-xs font-medium">
              Unit Mix
            </div>
            <div className="space-y-0.5 text-xs">
              {(m.unitMix as UnitMixEntry[]).map((u, i) => (
                <div key={i} className="text-zinc-300">
                  {u.beds}BR/{u.baths}BA — {u.unitCount} units
                  {u.avgMonthlyRent != null &&
                    ` @ ${formatCurrency(u.avgMonthlyRent)}/mo`}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: Notes & Flags */}
      <div>
        {m.analystNotes && (
          <div className="mb-4">
            <div className="text-zinc-400 mb-1 font-medium">Analyst Notes</div>
            <p className="text-zinc-300 text-sm leading-relaxed">
              {m.analystNotes}
            </p>
          </div>
        )}

        {run.humanReviewFlags.length > 0 && (
          <div className="mb-4">
            <div className="text-yellow-500 mb-1 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" /> Flags
            </div>
            <ul className="space-y-1">
              {run.humanReviewFlags.map((flag, i) => (
                <li key={i} className="text-zinc-300 text-xs">
                  &bull; {flag}
                </li>
              ))}
            </ul>
          </div>
        )}

        {m.missingDocs &&
          Array.isArray(m.missingDocs) &&
          m.missingDocs.length > 0 && (
            <div className="mb-4">
              <div className="text-zinc-400 mb-1 font-medium">
                Missing Documents
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(m.missingDocs as string[]).map((doc) => (
                  <Badge
                    key={doc}
                    className="bg-zinc-800 text-zinc-400 border-zinc-700"
                  >
                    {doc}
                  </Badge>
                ))}
              </div>
            </div>
          )}

        {run.error && (
          <div>
            <div className="text-red-400 mb-1 font-medium">Error</div>
            <p className="text-zinc-300 text-xs">{run.error}</p>
          </div>
        )}

        <div className="mt-4 text-xs text-zinc-500 space-y-0.5">
          <div>Job ID: {run.jobId}</div>
          {run.durationMs != null && (
            <div>Duration: {(run.durationMs / 1000).toFixed(1)}s</div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-zinc-500">{label}: </span>
      <span className="text-zinc-300">{value}</span>
    </div>
  );
}
