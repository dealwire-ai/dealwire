"use client";

import { X, ExternalLink } from "lucide-react";
import { isPinelandsRestrictive, type NjParcel } from "./data";
import { scoreColor } from "./nj-map";

/**
 * Slide-over detail panel for one parcel: full MOD-IV attributes, blocker
 * flags with plain-language labels, the score arithmetic line by line, and —
 * when a CoStar listing matched this parcel — a market section with asking
 * price, broker, and ownership.
 */

const LISTING_AMBER = "#f59e0b";

// Status colors (reserved scale — never reused for series), always paired
// with a text label so state never rides on color alone.
const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  critical: "#d03b3b",
};

function money(v: number | null): string {
  return v === null ? "—" : `$${v.toLocaleString()}`;
}

function FlagRow({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string;
  tone: "good" | "warning" | "critical" | "muted";
  detail?: string;
}) {
  const color = tone === "muted" ? "#71717a" : STATUS[tone];
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-zinc-800/40 last:border-0">
      <span className="text-[11px] text-zinc-500">{label}</span>
      <span className="text-right">
        <span className="text-[11px] font-medium" style={{ color }}>
          {value}
        </span>
        {detail && <p className="text-[10px] text-zinc-600">{detail}</p>}
      </span>
    </div>
  );
}

export function ParcelDetailSheet({
  parcel,
  onClose,
}: {
  parcel: NjParcel;
  onClose: () => void;
}) {
  const wetlandsTone =
    parcel.wetlandsPct === null || parcel.wetlandsPct > 50
      ? "critical"
      : parcel.wetlandsPct > 0
        ? "warning"
        : "good";

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[380px] overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-5 shadow-2xl">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">
            {parcel.address || "(no situs address)"}
          </h2>
          <p className="text-[11px] text-zinc-500 font-mono">{parcel.pin}</p>
          <p className="text-[11px] text-zinc-600">
            {parcel.muni}, {parcel.county} County
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Score hero */}
      <div className="mb-4 rounded-md border border-zinc-800/60 bg-zinc-900/40 px-4 py-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            developability
          </span>
          <span
            className="text-3xl font-semibold font-mono"
            style={{ color: scoreColor(parcel.score) }}
          >
            {parcel.score}
          </span>
        </div>
        <div className="mt-2 space-y-0.5">
          {parcel.scoreNotes.split("; ").map((note, i) => (
            <p key={i} className="text-[10px] text-zinc-500 font-mono">
              {note}
            </p>
          ))}
        </div>
      </div>

      {/* CoStar market layer (matched listings only) */}
      {parcel.listing && (
        <>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            market · costar
          </p>
          <div
            className="mb-4 rounded-md border px-3 py-2.5"
            style={{ borderColor: `${LISTING_AMBER}4d` }}
          >
            <div className="flex items-baseline justify-between">
              <span
                className="text-[10px] font-mono font-medium uppercase tracking-wider"
                style={{ color: LISTING_AMBER }}
              >
                {parcel.listing.status === "active"
                  ? "● active listing"
                  : "○ recently off-market"}
              </span>
              {parcel.listing.dom !== null && (
                <span className="text-[10px] text-zinc-500 font-mono">
                  {Math.round(parcel.listing.dom).toLocaleString()} days on
                  market
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl font-semibold font-mono text-zinc-200">
                {parcel.listing.price === null
                  ? "price on request"
                  : `$${parcel.listing.price.toLocaleString()}`}
              </span>
              {parcel.listing.price !== null && (
                <span className="text-[10px] text-zinc-500 font-mono">
                  $
                  {Math.round(
                    parcel.listing.price / parcel.acres,
                  ).toLocaleString()}
                  /ac
                </span>
              )}
            </div>
            {parcel.listing.price !== null &&
              parcel.netVal !== null &&
              parcel.netVal > 0 && (
                <p className="mt-0.5 text-[10px] text-zinc-500 font-mono">
                  asking ={" "}
                  <span style={{ color: LISTING_AMBER }}>
                    {(parcel.listing.price / parcel.netVal).toFixed(1)}×
                  </span>{" "}
                  assessed value
                </p>
              )}
            <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-zinc-800/40 pt-2">
              {(
                [
                  ["Broker", parcel.listing.broker],
                  ["Broker contact", parcel.listing.brokerContact],
                  ["Broker phone", parcel.listing.brokerPhone],
                  ["Owner (CoStar)", parcel.listing.owner],
                  ["Owner phone", parcel.listing.ownerPhone],
                  ["Zoning", parcel.listing.zoning],
                  ["Proposed use", parcel.listing.use],
                  [
                    "Last sale (CoStar)",
                    parcel.listing.lastSalePrice !== null
                      ? `${money(parcel.listing.lastSalePrice)}${parcel.listing.lastSaleDate ? ` · ${parcel.listing.lastSaleDate}` : ""}`
                      : null,
                  ],
                ] as [string, string | null][]
              )
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[10px] text-zinc-600">{k}</dt>
                    <dd className="text-[11px] text-zinc-300 font-mono">{v}</dd>
                  </div>
                ))}
            </dl>
            {parcel.listing.multiParcel && (
              <p className="mt-2 text-[9px] text-zinc-600">
                Listing spans multiple parcels — price covers the full
                assemblage.
              </p>
            )}
            <p className="mt-2 text-[9px] text-zinc-700">
              CoStar export · Jul 24 2026 · via Denholtz license
            </p>
          </div>
        </>
      )}

      {/* Blocker flags */}
      <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
        screening flags
      </p>
      <div className="mb-4 rounded-md border border-zinc-800/60 px-3 py-1">
        <FlagRow
          label="Wetlands (NJDEP 2020)"
          value={
            parcel.wetlandsPct === null
              ? "touches — pct unknown"
              : parcel.wetlandsPct === 0
                ? "none mapped"
                : `${parcel.wetlandsPct}% covered`
          }
          tone={wetlandsTone}
        />
        <FlagRow
          label="FEMA flood"
          value={
            parcel.floodSfha === "yes"
              ? `SFHA · zone ${parcel.floodZone}`
              : parcel.floodSfha === "no-data"
                ? "unmapped"
                : parcel.floodZone === "X-shaded"
                  ? "0.2% annual chance"
                  : "clear"
          }
          tone={
            parcel.floodSfha === "yes"
              ? "critical"
              : parcel.floodSfha === "no-data"
                ? "warning"
                : parcel.floodZone === "X-shaded"
                  ? "warning"
                  : "good"
          }
          detail={
            parcel.floodSfha === "no-data"
              ? "no digital FIRM — not “clear”"
              : undefined
          }
        />
        <FlagRow
          label="Highlands"
          value={
            parcel.highlands === "none"
              ? "outside region"
              : parcel.highlands === "preservation"
                ? "Preservation Area"
                : "Planning Area"
          }
          tone={
            parcel.highlands === "preservation"
              ? "critical"
              : parcel.highlands === "planning"
                ? "warning"
                : "good"
          }
          detail={
            parcel.highlands === "preservation"
              ? "development effectively blocked"
              : undefined
          }
        />
        <FlagRow
          label="Pinelands"
          value={
            parcel.pinelands === "none" ? "outside region" : parcel.pinelands
          }
          tone={
            parcel.pinelands === "none"
              ? "good"
              : isPinelandsRestrictive(parcel.pinelands)
                ? "critical"
                : parcel.pinelands.toLowerCase().includes("rural")
                  ? "warning"
                  : "good"
          }
        />
        <FlagRow
          label="Sewer service area"
          value={parcel.sewer ? "inside SSA" : "outside — septic"}
          tone={parcel.sewer ? "good" : "warning"}
        />
        {(parcel.preservedPct === null || parcel.preservedPct >= 5) && (
          <FlagRow
            label="Preserved-land overlap"
            value={
              parcel.preservedPct === null
                ? "touches — pct unknown"
                : `${parcel.preservedPct}%`
            }
            tone="warning"
          />
        )}
      </div>

      {/* Assessment */}
      <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
        assessment & deed
      </p>
      <div className="mb-4 rounded-md border border-zinc-800/60 px-3 py-2">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {(
            [
              ["Acreage", `${parcel.acres.toLocaleString()} ac`],
              [
                "Land / acre",
                parcel.landVal
                  ? `$${Math.round(parcel.landVal / parcel.acres).toLocaleString()}`
                  : "—",
              ],
              ["Assessed land", money(parcel.landVal)],
              ["Improvements", money(parcel.imprvtVal)],
              ["Net assessed", money(parcel.netVal)],
              ["Prior-yr tax", money(parcel.taxPrior)],
              [
                "Deed",
                parcel.deedBook ? `${parcel.deedBook}/${parcel.deedPage}` : "—",
              ],
              ["Deed date", parcel.deedDate || "—"],
              ["Last sale", money(parcel.salePrice)],
              ["Class", "1 (vacant)"],
            ] as [string, string][]
          ).map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] text-zinc-600">{k}</dt>
              <dd className="text-[11px] text-zinc-300 font-mono">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      <a
        href={`https://www.google.com/maps/@${parcel.lat},${parcel.lng},1200m/data=!3m1!1e3`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-1.5 rounded border border-zinc-700 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-800 transition-colors"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        satellite view
      </a>

      <p className="mt-4 text-[9px] leading-relaxed text-zinc-700">
        Screening-grade flags from public mapping — not field delineations or
        regulatory determinations. Verify before acting.
      </p>
    </div>
  );
}
