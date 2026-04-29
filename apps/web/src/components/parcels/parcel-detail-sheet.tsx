"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useApi } from "@/hooks/use-api";
import { ScoreBadge } from "./score-badge";
import { SkipTraceButton } from "./skip-trace-button";
import { ValuationButton } from "./valuation-button";
import { ListAssignPopover } from "./list-assign-popover";
import { AssignPopover, type OrgMember } from "./assign-popover";
import { ActivityPanel } from "./activity-panel";
import { StreetViewImage } from "./street-view-image";
import { BblDisplay } from "./bbl-display";
import {
  buildAcrisUrl,
  buildDobBisUrl,
  getDobNowSearchUrl,
} from "@/lib/nyc-external-links";
import type { Parcel } from "./parcel-table";

interface ParcelDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Either pass a fully-loaded Parcel (parcels page already has it) OR a bbl
  // (pipeline board has only a projection — sheet will fetch on open).
  parcel?: Parcel | null;
  bbl?: string | null;
  members?: OrgMember[];
  onParcelUpdated?: (bbl: string, updates: Partial<Parcel>) => void;
}

export function ParcelDetailSheet({
  open,
  onOpenChange,
  parcel,
  bbl,
  members = [],
  onParcelUpdated,
}: ParcelDetailSheetProps) {
  const { apiCall } = useApi();
  const [fetched, setFetched] = useState<Parcel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Effective parcel: prefer the prop (live state on /parcels) over the fetched
  // copy (one-shot read on /pipeline). Re-fetches whenever the bbl changes
  // while the sheet is open and no parcel prop is provided.
  const effective = parcel ?? fetched;
  const effectiveBbl = parcel?.bbl ?? bbl ?? null;

  useEffect(() => {
    if (!open || parcel || !bbl) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setFetched(null);
    apiCall(`/public-data/parcels/${bbl}`)
      .then((res: Parcel) => {
        if (!cancelled) setFetched(res);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load parcel",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bbl, parcel]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:max-w-3xl"
      >
        <SheetHeader className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950 px-6 py-4 pr-16">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate">
                {effective?.address ||
                  (effectiveBbl ? `BBL ${effectiveBbl}` : "Parcel")}
              </SheetTitle>
              {effective && (
                <p className="mt-0.5 text-xs text-zinc-500">
                  {[
                    boroughName(effective.borough),
                    effective.zipCode,
                    effective.buildingClass
                      ? `Class ${effective.buildingClass}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            {effective && <ScoreBadge score={effective.distressScore} />}
          </div>
        </SheetHeader>

        <div className="px-6 py-4">
          {loading && (
            <div className="py-12 text-center text-sm text-zinc-500">
              Loading parcel…
            </div>
          )}
          {error && (
            <div className="rounded border border-red-900/50 bg-red-950/30 p-3 text-sm text-red-400">
              {error}
            </div>
          )}
          {effective && (
            <ParcelDetailContent
              parcel={effective}
              members={members}
              onParcelUpdated={onParcelUpdated}
            />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ParcelDetailContent({
  parcel,
  members,
  onParcelUpdated,
}: {
  parcel: Parcel;
  members: OrgMember[];
  onParcelUpdated?: (bbl: string, updates: Partial<Parcel>) => void;
}) {
  return (
    <div className="space-y-6 text-sm">
      {/* Hero street view spans full width so the rest of the panel doesn't sit
          next to a narrow square with empty space below it. */}
      <div className="overflow-hidden rounded-md border border-zinc-800">
        <StreetViewImage
          address={parcel.address ?? ""}
          borough={parcel.borough}
          zipCode={parcel.zipCode}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <SectionHeader>Property Details</SectionHeader>
          <div className="space-y-1">
            <div>
              <span className="text-zinc-500">BBL: </span>
              <BblDisplay bbl={parcel.bbl} className="text-zinc-300" />
            </div>
            <DetailRow label="Address" value={parcel.address} />
            <DetailRow label="Zip" value={parcel.zipCode} />
            <DetailRow label="Owner" value={parcel.ownerName} />
            <div>
              <span className="text-zinc-500">List: </span>
              <span className="inline-block">
                <ListAssignPopover
                  bbl={parcel.bbl}
                  currentList={parcel._listType ?? null}
                  onAssigned={(listType) =>
                    onParcelUpdated?.(parcel.bbl, { _listType: listType })
                  }
                />
              </span>
            </div>
            <div>
              <span className="text-zinc-500">Assigned: </span>
              <span className="inline-block">
                <AssignPopover
                  bbl={parcel.bbl}
                  members={members}
                  currentAssignee={parcel._assignee ?? null}
                  onAssigned={(member) =>
                    onParcelUpdated?.(parcel.bbl, { _assignee: member })
                  }
                />
              </span>
            </div>
            {parcel._verifiedPhone && (
              <DetailRow
                label="Verified Phone"
                value={parcel._verifiedPhone}
                highlight
              />
            )}
            <div className="mt-2">
              <SkipTraceButton
                parcel={parcel}
                onUpdated={(updates) => onParcelUpdated?.(parcel.bbl, updates)}
              />
            </div>
            <div className="mt-2">
              <ValuationButton
                parcel={parcel}
                onUpdated={(updates) => onParcelUpdated?.(parcel.bbl, updates)}
              />
            </div>
            <DetailRow label="Zoning" value={parcel.zoneDist1} />
            <DetailRow label="Tax Class" value={parcel.taxClass} />
            <DetailRow
              label="Lot"
              value={formatDimensions(
                parcel.lotFront,
                parcel.lotDepth,
                parcel.lotArea,
              )}
            />
            <DetailRow
              label="Building"
              value={formatDimensions(
                parcel.bldgFront,
                parcel.bldgDepth,
                parcel.buildingArea,
              )}
            />
            <DetailRow label="Floors" value={parcel.numFloors?.toString()} />
            <DetailRow
              label="Year Built"
              value={parcel.yearBuilt?.toString()}
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
            <DobLinks borough={parcel.borough} address={parcel.address} />
            <AcrisLink bbl={parcel.bbl} />
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <SectionHeader>HPD Violations</SectionHeader>
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

          <div>
            <SectionHeader>Tax Lien & Financials</SectionHeader>
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
                value={formatCurrency(parcel.totalOutstandingBalance)}
                highlight={(parcel.totalOutstandingBalance ?? 0) > 0}
              />
              <DetailRow
                label="Distress Score"
                value={parcel.distressScore?.toString()}
              />
              {parcel.lienSaleAmount != null && (
                <>
                  <div className="mb-1 mt-3 inline-flex items-center gap-2 text-xs font-medium text-zinc-400">
                    NYCTL Lien Sale
                    {parcel.lienMatchConfidence === "group_small" && (
                      <Badge className="border-yellow-900/50 bg-yellow-900/30 px-1 py-0 text-[10px] leading-tight text-yellow-400">
                        ~Est (group)
                      </Badge>
                    )}
                    {(parcel.lienMatchConfidence === "group_large" ||
                      parcel.lienMatchConfidence === "estimated") && (
                      <Badge className="border-orange-900/50 bg-orange-900/30 px-1 py-0 text-[10px] leading-tight text-orange-400">
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
                    value={formatCurrency(parcel.lienRedemptiveValue)}
                  />
                  <DetailRow label="Servicer" value={parcel.lienServicer} />
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
                  <DetailRow label="Sale Date" value={parcel.lienSaleDate} />
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

      <div>
        <ActivityPanel bbl={parcel.bbl} />
      </div>
    </div>
  );
}

// --- helpers (moved from parcel-table.tsx where they only served the inline expansion) ---

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 font-medium text-zinc-400">{children}</div>;
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

function AcrisLink({ bbl }: { bbl: string }) {
  const acrisUrl = buildAcrisUrl(bbl);
  return (
    <div className="pt-1">
      <span className="text-zinc-500">ACRIS: </span>
      {acrisUrl ? (
        <a
          href={acrisUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#C8A96E] hover:underline"
          title="ACRIS — deeds, mortgages, transfers, satisfactions for this BBL"
        >
          Document history
        </a>
      ) : (
        <span className="text-zinc-600" title="Valid BBL required">
          Document history
        </span>
      )}
    </div>
  );
}

function DobLinks({
  borough,
  address,
}: {
  borough: string;
  address: string | null;
}) {
  const bisUrl = buildDobBisUrl(borough, address);
  const dobNowUrl = getDobNowSearchUrl();
  return (
    <div className="pt-1">
      <span className="text-zinc-500">NYC DOB: </span>
      {bisUrl ? (
        <a
          href={bisUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#C8A96E] hover:underline"
          title="Old BIS — pre-2022 permits, violations, complaints"
        >
          BIS
        </a>
      ) : (
        <span className="text-zinc-600" title="Address required for BIS lookup">
          BIS
        </span>
      )}
      <span className="text-zinc-600"> · </span>
      <a
        href={dobNowUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#C8A96E] hover:underline"
        title="DOB NOW — current permits (search by BBL or address)"
      >
        DOB NOW
      </a>
    </div>
  );
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

function formatDimensions(
  front: number | null,
  depth: number | null,
  area: number | null,
): string | null {
  const hasDims = front && depth;
  const dimStr = hasDims
    ? `${Math.round(front!)}' × ${Math.round(depth!)}'`
    : null;
  const areaStr = area ? `${formatNumber(area)} sqft` : null;
  if (dimStr && areaStr) return `${dimStr} (${areaStr})`;
  return dimStr || areaStr;
}

const BOROUGH_NAMES: Record<string, string> = {
  "1": "Manhattan",
  "2": "Bronx",
  "3": "Brooklyn",
  "4": "Queens",
  "5": "Staten Island",
};

function boroughName(borough: string): string {
  return BOROUGH_NAMES[borough] ?? borough;
}
