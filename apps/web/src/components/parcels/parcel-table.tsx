"use client";

import { Fragment } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Circle,
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
import { SkipTraceButton } from "./skip-trace-button";
import { formatBuildingClass } from "@/lib/building-class-labels";

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
  // Skip tracing
  ownerPhones: OwnerPhone[] | null;
  ownerEmails: string[] | null;
  skipTracedAt: string | null;
  skipTraceStatus: "pending" | "found" | "not_found" | "error" | null;
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
    label: "Sqft",
    field: "buildingArea",
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
    defaultVisible: false,
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

interface ParcelTableProps {
  parcels: Parcel[];
  expandedRows: Set<string>;
  onToggleRow: (id: string) => void;
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

function renderCell(key: string, parcel: Parcel) {
  switch (key) {
    case "distressScore":
      return <ScoreBadge score={parcel.distressScore} />;
    case "address":
      return (
        <span className="font-medium max-w-[200px] truncate block">
          {parcel.address || parcel.bbl}
        </span>
      );
    case "borough":
      return BOROUGH_NAMES[parcel.borough] || parcel.borough;
    case "buildingClass":
      return formatBuildingClass(parcel.buildingClass);
    case "unitsTotal":
      return parcel.unitsTotal ?? "-";
    case "buildingArea":
      return parcel.buildingArea ? formatNumber(parcel.buildingArea) : "-";
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
    case "outstandingTaxBill":
      return formatCurrency(parcel.outstandingTaxBill);
    case "totalOutstandingBalance":
      return (
        <span className="font-medium">
          {formatCurrency(parcel.totalOutstandingBalance)}
        </span>
      );
    case "ownerPhones":
      return <PhoneCell parcel={parcel} />;
    default:
      return "-";
  }
}

export function ParcelTable({
  parcels,
  expandedRows,
  onToggleRow,
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
}: ParcelTableProps) {
  const allSelected =
    parcels.length > 0 && parcels.every((p) => selectedBbls?.has(p.bbl));

  const activeColumns = COLUMNS.filter((c) => visibleColumns.has(c.key));
  // +2 for checkbox, +1 for expand chevron, +1 for data quality dot
  const totalColSpan = activeColumns.length + 3;

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
            />
          </TableHead>
          <TableHead className="w-10"></TableHead>
          {activeColumns.map((col, i) => {
            const isActive = sort === col.field;
            // Insert data quality dot header after Score column (index 0)
            const showDataDotBefore =
              i === 1 && activeColumns[0]?.key === "distressScore";
            return (
              <Fragment key={col.key}>
                {showDataDotBefore && (
                  <TableHead className="w-8 px-1">
                    <Circle className="h-3 w-3 text-zinc-500 mx-auto" />
                  </TableHead>
                )}
                <TableHead
                  className={
                    col.align === "right"
                      ? "text-right cursor-pointer hover:text-white select-none"
                      : "cursor-pointer hover:text-white select-none"
                  }
                  onClick={() => col.sortable && onSortChange?.(col.field)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {isActive &&
                      (order === "desc" ? (
                        <ArrowDown className="h-3.5 w-3.5" />
                      ) : (
                        <ArrowUp className="h-3.5 w-3.5" />
                      ))}
                  </span>
                </TableHead>
              </Fragment>
            );
          })}
          {/* If Score is not first column or not visible, still show data dot header at start */}
          {(activeColumns.length === 0 ||
            activeColumns[0]?.key !== "distressScore") && (
            <TableHead className="w-8 px-1">
              <Circle className="h-3 w-3 text-zinc-500 mx-auto" />
            </TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {parcels.map((parcel) => {
          const isExpanded = expandedRows.has(parcel.id);
          const quality = getDataQuality(parcel);
          return (
            <Fragment key={parcel.id}>
              <TableRow
                className="cursor-pointer hover:bg-zinc-900/70"
                onClick={() => onToggleRow(parcel.id)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedBbls?.has(parcel.bbl) ?? false}
                    onCheckedChange={() => onToggleSelect?.(parcel.bbl)}
                  />
                </TableCell>
                <TableCell>
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                  )}
                </TableCell>
                {activeColumns.map((col, i) => {
                  const showDataDotBefore =
                    i === 1 && activeColumns[0]?.key === "distressScore";
                  const cellContent = renderCell(col.key, parcel);
                  const needsStopPropagation = col.key === "ownerPhones";
                  return (
                    <Fragment key={col.key}>
                      {showDataDotBefore && (
                        <TableCell className="w-8 px-1 text-center">
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
                  <TableCell className="w-8 px-1 text-center">
                    <Circle
                      className={`h-2.5 w-2.5 fill-current mx-auto ${DATA_DOT_COLORS[quality]}`}
                    />
                  </TableCell>
                )}
              </TableRow>
              {isExpanded && (
                <TableRow>
                  <TableCell
                    colSpan={totalColSpan + 1}
                    className="bg-zinc-950/50 p-0 transition-all duration-200"
                  >
                    <div className="border-l-2 border-[#C8A96E] pl-4 py-4 pr-4">
                      <div className="grid grid-cols-3 gap-6 text-sm">
                        {/* Property Details */}
                        <div>
                          <div className="text-zinc-400 mb-2 font-medium">
                            Property Details
                          </div>
                          <div className="space-y-1">
                            <DetailRow label="BBL" value={parcel.bbl} />
                            <DetailRow label="Address" value={parcel.address} />
                            <DetailRow label="Zip" value={parcel.zipCode} />
                            <DetailRow label="Owner" value={parcel.ownerName} />
                            <div className="mt-2">
                              <SkipTraceButton
                                parcel={parcel}
                                onUpdated={(updates) =>
                                  onParcelUpdated?.(parcel.bbl, updates)
                                }
                              />
                            </div>
                            <DetailRow
                              label="Zoning"
                              value={parcel.zoneDist1}
                            />
                            <DetailRow
                              label="Tax Class"
                              value={parcel.taxClass}
                            />
                            <DetailRow
                              label="Lot Area"
                              value={
                                parcel.lotArea
                                  ? `${formatNumber(parcel.lotArea)} sqft`
                                  : null
                              }
                            />
                            <DetailRow
                              label="Floors"
                              value={parcel.numFloors?.toString()}
                            />
                            <DetailRow
                              label="Residential Units"
                              value={parcel.unitsRes?.toString()}
                            />
                            <DetailRow
                              label="Assessed Value"
                              value={formatCurrency(parcel.assessTotal)}
                            />
                            <DetailRow
                              label="Is Coop"
                              value={parcel.isCoopExcluded ? "Yes" : "No"}
                            />
                          </div>
                        </div>

                        {/* Violations */}
                        <div>
                          <div className="text-zinc-400 mb-2 font-medium">
                            HPD Violations
                          </div>
                          <div className="space-y-1">
                            <DetailRow
                              label="Total"
                              value={parcel.violationsTotal.toString()}
                            />
                            <DetailRow
                              label="Open"
                              value={parcel.violationsOpen.toString()}
                              highlight={parcel.violationsOpen > 0}
                            />
                            <DetailRow
                              label="Class A (non-hazardous)"
                              value={parcel.violationsClassA.toString()}
                            />
                            <DetailRow
                              label="Class B (hazardous)"
                              value={parcel.violationsClassB.toString()}
                              highlight={parcel.violationsClassB > 0}
                            />
                            <DetailRow
                              label="Class C (immediately hazardous)"
                              value={parcel.violationsClassC.toString()}
                              highlight={parcel.violationsClassC > 0}
                            />
                            <DetailRow
                              label="Violations/Unit"
                              value={parcel.violationsPerUnit?.toFixed(2)}
                            />
                          </div>
                        </div>

                        {/* Lien Status & Financials */}
                        <div>
                          <div className="text-zinc-400 mb-2 font-medium">
                            Tax Lien & Financials
                          </div>
                          <div className="space-y-1">
                            <DetailRow
                              label="Active Lien"
                              value={parcel.hasActiveLien ? "Yes" : "No"}
                              highlight={parcel.hasActiveLien}
                            />
                            <DetailRow label="Cycle" value={parcel.lienCycle} />
                            <DetailRow
                              label="Water Debt Only"
                              value={parcel.waterDebtOnly ? "Yes" : "No"}
                            />
                            <DetailRow
                              label="Outstanding Tax Bill"
                              value={formatCurrency(parcel.outstandingTaxBill)}
                              highlight={(parcel.outstandingTaxBill ?? 0) > 0}
                            />
                            <DetailRow
                              label="Total Owed to DOF"
                              value={formatCurrency(
                                parcel.totalOutstandingBalance,
                              )}
                              highlight={
                                (parcel.totalOutstandingBalance ?? 0) > 0
                              }
                            />
                            <DetailRow
                              label="Distress Score"
                              value={parcel.distressScore?.toString()}
                            />
                            {parcel.lienSaleAmount != null && (
                              <>
                                <div className="mt-3 mb-1 text-zinc-400 font-medium text-xs inline-flex items-center gap-2">
                                  NYCTL Lien Sale
                                  {parcel.lienMatchConfidence ===
                                    "group_small" && (
                                    <Badge className="bg-yellow-900/30 text-yellow-400 border-yellow-900/50 text-[10px] px-1 py-0 leading-tight">
                                      ~Est (group)
                                    </Badge>
                                  )}
                                  {(parcel.lienMatchConfidence ===
                                    "group_large" ||
                                    parcel.lienMatchConfidence ===
                                      "estimated") && (
                                    <Badge className="bg-orange-900/30 text-orange-400 border-orange-900/50 text-[10px] px-1 py-0 leading-tight">
                                      ~Est (group)
                                    </Badge>
                                  )}
                                </div>
                                <DetailRow
                                  label="Sale Amount"
                                  value={formatCurrency(parcel.lienSaleAmount)}
                                  highlight={(parcel.lienSaleAmount ?? 0) > 0}
                                />
                                <DetailRow
                                  label="Redemptive Value"
                                  value={formatCurrency(
                                    parcel.lienRedemptiveValue,
                                  )}
                                />
                                <DetailRow
                                  label="Servicer"
                                  value={parcel.lienServicer}
                                />
                                <DetailRow
                                  label="Redeemed"
                                  value={
                                    parcel.lienRedeemed === null
                                      ? "Unknown"
                                      : parcel.lienRedeemed
                                        ? "Yes"
                                        : "No"
                                  }
                                />
                                <DetailRow
                                  label="Foreclosure"
                                  value={parcel.lienForeclosureStatus}
                                />
                                <DetailRow
                                  label="Trust Vintage"
                                  value={parcel.lienTrustVintage}
                                />
                                <DetailRow
                                  label="Sale Date"
                                  value={parcel.lienSaleDate}
                                />
                                {parcel.lienMatchGroupSize != null &&
                                  parcel.lienMatchGroupSize > 1 && (
                                    <DetailRow
                                      label="Group Size"
                                      value={`${parcel.lienMatchGroupSize} BBLs`}
                                    />
                                  )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
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

function PhoneCell({ parcel }: { parcel: Parcel }) {
  const status = parcel.skipTraceStatus;

  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
        <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
        Looking up...
      </span>
    );
  }

  if (
    status === "found" &&
    parcel.ownerPhones &&
    parcel.ownerPhones.length > 0
  ) {
    const primary = parcel.ownerPhones[0];
    return (
      <a
        href={`tel:${primary.number}`}
        className="text-xs text-[#C8A96E] hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {primary.number}
      </a>
    );
  }

  return <span className="text-zinc-600 text-xs">&mdash;</span>;
}

function DetailRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | null | undefined;
  highlight?: boolean;
}) {
  return (
    <div>
      <span className="text-zinc-500">{label}: </span>
      <span className={highlight ? "text-red-400" : "text-zinc-300"}>
        {value || "-"}
      </span>
    </div>
  );
}
