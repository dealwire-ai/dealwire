"use client";

import { Fragment } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp } from "lucide-react";
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
  distressScore: number | null;
  outstandingTaxBill: number | null;
  lienChargeAmount: number | null;
  totalOutstandingBalance: number | null;
  // Skip tracing
  ownerPhones: OwnerPhone[] | null;
  ownerEmails: string[] | null;
  skipTracedAt: string | null;
  skipTraceStatus: "pending" | "found" | "not_found" | "error" | null;
}

const SORTABLE_COLUMNS: { label: string; field: string; align?: "right" }[] = [
  { label: "Score", field: "distressScore" },
  { label: "Address", field: "address" },
  { label: "Borough", field: "borough" },
  { label: "Class", field: "buildingClass" },
  { label: "Units", field: "unitsTotal", align: "right" },
  { label: "Sqft", field: "buildingArea", align: "right" },
  { label: "Est. Value", field: "estimatedMarketValue", align: "right" },
  { label: "Year", field: "yearBuilt", align: "right" },
  { label: "Open Viol.", field: "violationsOpen", align: "right" },
  { label: "V/Unit", field: "violationsPerUnit", align: "right" },
  { label: "Class C", field: "violationsClassC", align: "right" },
  { label: "Lien", field: "hasActiveLien" },
  { label: "Tax Bill", field: "outstandingTaxBill", align: "right" },
  { label: "Lien Amt", field: "lienChargeAmount", align: "right" },
  { label: "Total Owed", field: "totalOutstandingBalance", align: "right" },
  { label: "Phone", field: "ownerPhones" },
];

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
}: ParcelTableProps) {
  const allSelected =
    parcels.length > 0 && parcels.every((p) => selectedBbls?.has(p.bbl));
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
          {SORTABLE_COLUMNS.map(({ label, field, align }) => {
            const isActive = sort === field;
            return (
              <TableHead
                key={field}
                className={
                  align === "right"
                    ? "text-right cursor-pointer hover:text-white select-none"
                    : "cursor-pointer hover:text-white select-none"
                }
                onClick={() => onSortChange?.(field)}
              >
                <span className="inline-flex items-center gap-1">
                  {label}
                  {isActive &&
                    (order === "desc" ? (
                      <ArrowDown className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowUp className="h-3.5 w-3.5" />
                    ))}
                </span>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {parcels.map((parcel) => {
          const isExpanded = expandedRows.has(parcel.id);
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
                <TableCell>
                  <ScoreBadge score={parcel.distressScore} />
                </TableCell>
                <TableCell className="font-medium max-w-[200px] truncate">
                  {parcel.address || parcel.bbl}
                </TableCell>
                <TableCell>
                  {BOROUGH_NAMES[parcel.borough] || parcel.borough}
                </TableCell>
                <TableCell>
                  {formatBuildingClass(parcel.buildingClass)}
                </TableCell>
                <TableCell className="text-right">
                  {parcel.unitsTotal ?? "-"}
                </TableCell>
                <TableCell className="text-right">
                  {parcel.buildingArea
                    ? formatNumber(parcel.buildingArea)
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(parcel.estimatedMarketValue)}
                </TableCell>
                <TableCell className="text-right">
                  {parcel.yearBuilt ?? "-"}
                </TableCell>
                <TableCell className="text-right">
                  {parcel.violationsOpen > 0 ? (
                    <span className="text-red-400">
                      {parcel.violationsOpen}
                    </span>
                  ) : (
                    "0"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {parcel.violationsPerUnit !== null
                    ? parcel.violationsPerUnit.toFixed(1)
                    : "-"}
                </TableCell>
                <TableCell className="text-right">
                  {parcel.violationsClassC > 0 ? (
                    <span className="text-red-400">
                      {parcel.violationsClassC}
                    </span>
                  ) : (
                    "0"
                  )}
                </TableCell>
                <TableCell>
                  {parcel.hasActiveLien ? (
                    <Badge className="bg-orange-900/30 text-orange-400 border-orange-900/50 hover:bg-orange-900/40">
                      Lien
                    </Badge>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(parcel.outstandingTaxBill)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(parcel.lienChargeAmount)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(parcel.totalOutstandingBalance)}
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <PhoneCell parcel={parcel} />
                </TableCell>
              </TableRow>
              {isExpanded && (
                <TableRow>
                  <TableCell
                    colSpan={18}
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
                              label="Lien Charge Amount"
                              value={formatCurrency(parcel.lienChargeAmount)}
                              highlight={(parcel.lienChargeAmount ?? 0) > 0}
                            />
                            <DetailRow
                              label="Total Outstanding"
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

  return <span className="text-zinc-600 text-xs">—</span>;
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
