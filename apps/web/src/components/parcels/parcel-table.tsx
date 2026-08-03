"use client";

import { Fragment, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Circle,
  Phone,
  RefreshCw,
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScoreBadge } from "./score-badge";
import { ListAssignPopover, type ParcelListType } from "./list-assign-popover";
import { AssignPopover, type OrgMember } from "./assign-popover";
import { formatBuildingClass } from "@/lib/building-class-labels";
import { BblDisplay } from "./bbl-display";
import { useApi } from "@/hooks/use-api";
import { toast } from "sonner";

const BOROUGH_NAMES: Record<string, string> = {
  "1": "Manhattan",
  "2": "Bronx",
  "3": "Brooklyn",
  "4": "Queens",
  "5": "Staten Island",
};

export interface OwnerPhone {
  number: string;
  type: string;
  rank: number;
  source?: "tracerfy" | "skipsherpa";
  isDnc?: boolean;
}

export interface Parcel {
  id: string;
  bbl: string;
  borough: string;
  block: string;
  lot: string;
  address: string | null;
  zipCode: string | null;
  buildingClass: string | null;
  unitsTotal: number | null;
  unitsRes: number | null;
  buildingArea: number | null;
  lotArea: number | null;
  lotFront: number | null;
  lotDepth: number | null;
  bldgFront: number | null;
  bldgDepth: number | null;
  numFloors: number | null;
  yearBuilt: number | null;
  ownerName: string | null;
  zoneDist1: string | null;
  landUse: string | null;
  assessTotal: number | null;
  taxClass: string | null;
  estimatedMarketValue: number | null;
  isCoopExcluded: boolean;
  hasActiveLien: boolean;
  lienCycle: string | null;
  waterDebtOnly: boolean;
  violationsTotal: number;
  violationsOpen: number;
  violationsClassA: number;
  violationsClassB: number;
  violationsClassC: number;
  violationsPerUnit: number | null;
  violationsSyncedAt: string | null;
  distressScore: number | null;
  outstandingTaxBill: number | null;
  totalOutstandingBalance: number | null;
  // NYCTL lien sale data
  lienSaleAmount: number | null;
  lienRedemptiveValue: number | null;
  lienServicer: string | null;
  lienRedeemed: boolean | null;
  lienForeclosureStatus: string | null;
  lienSaleDate: string | null;
  lienTrustVintage: string | null;
  lienMatchConfidence: string | null;
  lienMatchGroupSize: number | null;
  // ATTOM valuation data
  avmValue: number | null;
  avmHigh: number | null;
  avmLow: number | null;
  avmConfidence: number | null;
  marketValue: number | null;
  assessedValue: number | null;
  lastSalePrice: number | null;
  lastSaleDate: string | null;
  taxAmount: number | null;
  taxYear: number | null;
  // Skip tracing
  ownerPhones: OwnerPhone[] | null;
  ownerEmails: string[] | null;
  skipTracedAt: string | null;
  skipTraceStatus: "pending" | "found" | "not_found" | "error" | null;
  // Transient: set client-side when a phone is marked GOOD via contact tracking
  _verifiedPhone?: string | null;
  // List assignment from API (flattened from listAssignments)
  _listType?: ParcelListType | null;
  // Current CRM assignee (merged client-side from /public-data/crm/deals)
  _assignee?: OrgMember | null;
}

export interface ColumnDef {
  key: string;
  label: string;
  field: string;
  align?: "right";
  defaultVisible: boolean;
  sortable: boolean;
}

export const COLUMNS: ColumnDef[] = [
  {
    key: "distressScore",
    label: "Score",
    field: "distressScore",
    defaultVisible: true,
    sortable: true,
  },
  {
    key: "address",
    label: "Address",
    field: "address",
    defaultVisible: true,
    sortable: true,
  },
  {
    key: "zipCode",
    label: "Zip",
    field: "zipCode",
    defaultVisible: true,
    sortable: true,
  },
  {
    key: "buildingClass",
    label: "Class",
    field: "buildingClass",
    defaultVisible: true,
    sortable: true,
  },
  {
    key: "unitsTotal",
    label: "Units",
    field: "unitsTotal",
    align: "right",
    defaultVisible: true,
    sortable: true,
  },
  {
    key: "violationsPerUnit",
    label: "V/Unit",
    field: "violationsPerUnit",
    align: "right",
    defaultVisible: true,
    sortable: true,
  },
  {
    key: "lienSaleAmount",
    label: "Lien Sale Amt",
    field: "lienSaleAmount",
    align: "right",
    defaultVisible: true,
    sortable: true,
  },
  {
    key: "lienSaleDate",
    label: "Sale Date",
    field: "lienSaleDate",
    defaultVisible: true,
    sortable: true,
  },
  {
    key: "totalOutstandingBalance",
    label: "Total Owed",
    field: "totalOutstandingBalance",
    align: "right",
    defaultVisible: true,
    sortable: true,
  },
  {
    key: "ownerPhones",
    label: "Phone",
    field: "ownerPhones",
    defaultVisible: true,
    sortable: true,
  },
  {
    key: "listType",
    label: "List",
    field: "listType",
    defaultVisible: true,
    sortable: false,
  },
  {
    key: "assignee",
    label: "Assigned",
    field: "assignee",
    defaultVisible: true,
    sortable: false,
  },
  // Hidden by default
  {
    key: "borough",
    label: "Borough",
    field: "borough",
    defaultVisible: false,
    sortable: true,
  },
  {
    key: "buildingArea",
    label: "Bldg Sqft",
    field: "buildingArea",
    align: "right",
    defaultVisible: true,
    sortable: true,
  },
  {
    key: "lotArea",
    label: "Lot Sqft",
    field: "lotArea",
    align: "right",
    defaultVisible: false,
    sortable: true,
  },
  {
    key: "estimatedMarketValue",
    label: "Est. Value",
    field: "estimatedMarketValue",
    align: "right",
    defaultVisible: false,
    sortable: true,
  },
  {
    key: "yearBuilt",
    label: "Year",
    field: "yearBuilt",
    align: "right",
    defaultVisible: false,
    sortable: true,
  },
  {
    key: "violationsOpen",
    label: "Open Viol.",
    field: "violationsOpen",
    align: "right",
    defaultVisible: false,
    sortable: true,
  },
  {
    key: "violationsClassC",
    label: "Class C",
    field: "violationsClassC",
    align: "right",
    defaultVisible: false,
    sortable: true,
  },
  {
    key: "hasActiveLien",
    label: "Lien",
    field: "hasActiveLien",
    defaultVisible: false,
    sortable: true,
  },
  {
    key: "outstandingTaxBill",
    label: "Tax Bill",
    field: "outstandingTaxBill",
    align: "right",
    defaultVisible: true,
    sortable: true,
  },
];

export const DEFAULT_VISIBLE_COLUMNS = new Set(
  COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key),
);

function getDataQuality(parcel: Parcel): "green" | "yellow" | "gray" {
  let signals = 0;
  if (parcel.skipTraceStatus === "found") signals++;
  if (parcel.lienSaleAmount != null) signals++;
  if (parcel.violationsSyncedAt != null) signals++;
  if (signals === 3) return "green";
  if (signals >= 1) return "yellow";
  return "gray";
}

const DATA_DOT_COLORS = {
  green: "text-emerald-400",
  yellow: "text-yellow-400",
  gray: "text-zinc-600",
} as const;

const DATA_DOT_LABELS = {
  green:
    "High data quality — all 3 signals present (skip trace, HPD violations, lien sale)",
  yellow: "Partial data quality — 1-2 of 3 signals present",
  gray: "Low data quality — no signals present",
} as const;

interface ParcelTableProps {
  parcels: Parcel[];
  onRowClick: (parcel: Parcel) => void;
  selectedBbls?: Set<string>;
  onToggleSelect?: (bbl: string) => void;
  onSelectAll?: (bbls: string[]) => void;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  sort?: string;
  order?: "asc" | "desc";
  onSortChange?: (field: string) => void;
  onParcelUpdated?: (bbl: string, updates: Partial<Parcel>) => void;
  visibleColumns: Set<string>;
  members?: OrgMember[];
}

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatSaleDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function renderCell(
  key: string,
  parcel: Parcel,
  onParcelUpdated?: (bbl: string, updates: Partial<Parcel>) => void,
  members: OrgMember[] = [],
) {
  switch (key) {
    case "distressScore":
      return <ScoreBadge score={parcel.distressScore} />;
    case "address":
      return parcel.address ? (
        <span className="font-medium max-w-[200px] truncate block">
          {parcel.address}
        </span>
      ) : (
        <BblDisplay bbl={parcel.bbl} className="font-medium" />
      );
    case "borough":
      return BOROUGH_NAMES[parcel.borough] || parcel.borough;
    case "zipCode":
      return parcel.zipCode ?? "-";
    case "buildingClass":
      return formatBuildingClass(parcel.buildingClass);
    case "unitsTotal":
      return parcel.unitsTotal ?? "-";
    case "buildingArea":
      return parcel.buildingArea ? formatNumber(parcel.buildingArea) : "-";
    case "lotArea":
      return parcel.lotArea ? formatNumber(parcel.lotArea) : "-";
    case "estimatedMarketValue":
      return formatCurrency(parcel.estimatedMarketValue);
    case "yearBuilt":
      return parcel.yearBuilt ?? "-";
    case "violationsOpen":
      return parcel.violationsOpen > 0 ? (
        <span className="text-red-400">{parcel.violationsOpen}</span>
      ) : (
        "0"
      );
    case "violationsPerUnit":
      return parcel.violationsPerUnit !== null
        ? parcel.violationsPerUnit.toFixed(1)
        : "-";
    case "violationsClassC":
      return parcel.violationsClassC > 0 ? (
        <span className="text-red-400">{parcel.violationsClassC}</span>
      ) : (
        "0"
      );
    case "hasActiveLien":
      return parcel.hasActiveLien ? (
        <Badge className="bg-orange-900/30 text-orange-400 border-orange-900/50 hover:bg-orange-900/40">
          Lien
        </Badge>
      ) : (
        "-"
      );
    case "lienSaleAmount":
      return parcel.lienSaleAmount != null ? (
        <span className="inline-flex items-center gap-1 justify-end">
          {formatCurrency(parcel.lienSaleAmount)}
          {parcel.lienMatchConfidence === "group_small" && (
            <Badge className="bg-yellow-900/30 text-yellow-400 border-yellow-900/50 text-[10px] px-1 py-0 leading-tight">
              ~Est
            </Badge>
          )}
          {(parcel.lienMatchConfidence === "group_large" ||
            parcel.lienMatchConfidence === "estimated") && (
            <Badge className="bg-orange-900/30 text-orange-400 border-orange-900/50 text-[10px] px-1 py-0 leading-tight">
              ~Est
            </Badge>
          )}
        </span>
      ) : (
        "-"
      );
    case "lienSaleDate":
      return parcel.lienSaleDate ? formatSaleDate(parcel.lienSaleDate) : "-";
    case "outstandingTaxBill":
      return formatCurrency(parcel.outstandingTaxBill);
    case "totalOutstandingBalance":
      return (
        <span className="font-medium">
          {formatCurrency(parcel.totalOutstandingBalance)}
        </span>
      );
    case "ownerPhones":
      return (
        <PhoneCell
          parcel={parcel}
          onUpdated={
            onParcelUpdated
              ? (updates) => onParcelUpdated(parcel.bbl, updates)
              : undefined
          }
        />
      );
    case "listType":
      return (
        <ListAssignPopover
          bbl={parcel.bbl}
          currentList={parcel._listType ?? null}
          onAssigned={(listType) =>
            onParcelUpdated?.(parcel.bbl, { _listType: listType })
          }
        />
      );
    case "assignee":
      return (
        <AssignPopover
          bbl={parcel.bbl}
          members={members}
          currentAssignee={parcel._assignee ?? null}
          onAssigned={(member) =>
            onParcelUpdated?.(parcel.bbl, { _assignee: member })
          }
        />
      );
    default:
      return "-";
  }
}

export function ParcelTable({
  parcels,
  onRowClick,
  selectedBbls,
  onToggleSelect,
  onSelectAll,
  hasActiveFilters,
  onClearFilters,
  sort,
  order,
  onSortChange,
  onParcelUpdated,
  visibleColumns,
  members = [],
}: ParcelTableProps) {
  const allSelected =
    parcels.length > 0 && parcels.every((p) => selectedBbls?.has(p.bbl));

  const activeColumns = COLUMNS.filter((c) => visibleColumns.has(c.key));

  if (parcels.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-400">
        <p>
          {hasActiveFilters
            ? "No parcels match your filters."
            : "No parcels found. Run an ingestion first."}
        </p>
        {hasActiveFilters && onClearFilters && (
          <button
            onClick={onClearFilters}
            className="mt-2 text-sm text-[#C8A96E] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => {
                if (checked) {
                  onSelectAll?.(parcels.map((p) => p.bbl));
                } else {
                  onSelectAll?.([]);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="cursor-pointer"
            />
          </TableHead>
          {activeColumns.map((col, i) => {
            const isActive = sort === col.field;
            // Insert data quality dot header after Score column (index 0)
            const showDataDotBefore =
              i === 1 && activeColumns[0]?.key === "distressScore";
            return (
              <Fragment key={col.key}>
                {showDataDotBefore && (
                  <TableHead
                    className="w-16 px-1 text-center"
                    title="Data quality based on three signals: skip trace (phone numbers), HPD violation sync, and NYCTL lien sale match. Green = all three present. Yellow = 1-2 present. Gray = none."
                  >
                    Data Quality
                  </TableHead>
                )}
                <TableHead
                  className={[
                    col.align === "right" ? "text-right" : "",
                    col.sortable
                      ? "group cursor-pointer hover:text-white select-none"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => col.sortable && onSortChange?.(col.field)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable &&
                      (isActive ? (
                        order === "desc" ? (
                          <ArrowDown className="h-3.5 w-3.5 text-[#C8A96E]" />
                        ) : (
                          <ArrowUp className="h-3.5 w-3.5 text-[#C8A96E]" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3.5 w-3.5 opacity-30 group-hover:opacity-60" />
                      ))}
                  </span>
                </TableHead>
              </Fragment>
            );
          })}
          {/* If Score is not first column or not visible, still show data dot header at start */}
          {(activeColumns.length === 0 ||
            activeColumns[0]?.key !== "distressScore") && (
            <TableHead
              className="w-16 px-1 text-center"
              title="Data quality based on three signals: skip trace (phone numbers), HPD violation sync, and NYCTL lien sale match. Green = all three present. Yellow = 1-2 present. Gray = none."
            >
              Data Quality
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {parcels.map((parcel) => {
          const quality = getDataQuality(parcel);
          return (
            <Fragment key={parcel.id}>
              <TableRow
                className="cursor-pointer hover:bg-zinc-900/70"
                onClick={() => onRowClick(parcel)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedBbls?.has(parcel.bbl) ?? false}
                    onCheckedChange={() => onToggleSelect?.(parcel.bbl)}
                    className="cursor-pointer"
                  />
                </TableCell>
                {activeColumns.map((col, i) => {
                  const showDataDotBefore =
                    i === 1 && activeColumns[0]?.key === "distressScore";
                  const cellContent = renderCell(
                    col.key,
                    parcel,
                    onParcelUpdated,
                    members,
                  );
                  const needsStopPropagation =
                    col.key === "ownerPhones" ||
                    col.key === "listType" ||
                    col.key === "assignee";
                  return (
                    <Fragment key={col.key}>
                      {showDataDotBefore && (
                        <TableCell
                          className="w-8 px-1 text-center"
                          title={DATA_DOT_LABELS[quality]}
                        >
                          <Circle
                            className={`h-2.5 w-2.5 fill-current mx-auto ${DATA_DOT_COLORS[quality]}`}
                          />
                        </TableCell>
                      )}
                      <TableCell
                        className={
                          col.align === "right" ? "text-right" : undefined
                        }
                        onClick={
                          needsStopPropagation
                            ? (e) => e.stopPropagation()
                            : undefined
                        }
                      >
                        {cellContent}
                      </TableCell>
                    </Fragment>
                  );
                })}
                {(activeColumns.length === 0 ||
                  activeColumns[0]?.key !== "distressScore") && (
                  <TableCell
                    className="w-8 px-1 text-center"
                    title={DATA_DOT_LABELS[quality]}
                  >
                    <Circle
                      className={`h-2.5 w-2.5 fill-current mx-auto ${DATA_DOT_COLORS[quality]}`}
                    />
                  </TableCell>
                )}
              </TableRow>
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

function PhoneCell({
  parcel,
  onUpdated,
}: {
  parcel: Parcel;
  onUpdated?: (updates: Partial<Parcel>) => void;
}) {
  const status = parcel.skipTraceStatus;

  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C8A96E] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C8A96E]" />
        </span>
        Queued...
      </span>
    );
  }

  if (
    status === "found" &&
    parcel.ownerPhones &&
    parcel.ownerPhones.length > 0
  ) {
    const verified = parcel._verifiedPhone;
    const primary = verified
      ? (parcel.ownerPhones.find((p) => p.number === verified) ??
        parcel.ownerPhones[0])
      : parcel.ownerPhones[0];
    return (
      <span className="inline-flex items-center gap-1">
        <a
          href={`tel:${primary.number}`}
          className="text-xs text-[#C8A96E] hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {primary.number}
        </a>
        {verified && (
          <span
            className="h-2 w-2 rounded-full bg-green-500 inline-block"
            title="Verified number"
          />
        )}
      </span>
    );
  }

  if (status === "not_found") {
    return <span className="text-zinc-500 text-xs">No phone</span>;
  }

  if (status === "error") {
    return <span className="text-red-400/70 text-xs">Error</span>;
  }

  // Not traced yet (null status) — show inline trace button
  return <InlineSkipTraceButton bbl={parcel.bbl} onUpdated={onUpdated} />;
}

function InlineSkipTraceButton({
  bbl,
  onUpdated,
}: {
  bbl: string;
  onUpdated?: (updates: Partial<Parcel>) => void;
}) {
  const { apiCall } = useApi();
  const [loading, setLoading] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    try {
      await apiCall(`/public-data/parcels/${bbl}/skip-trace`, {
        method: "POST",
        body: JSON.stringify({ force: false }),
      });
      onUpdated?.({ skipTraceStatus: "pending" });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Skip trace request failed",
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
        <RefreshCw className="w-3 h-3 animate-spin" />
        Submitting...
      </span>
    );
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-[#C8A96E] transition-colors cursor-pointer"
      title="Skip trace this parcel"
    >
      <Phone className="w-3 h-3" />
      <span>Trace</span>
    </button>
  );
}
