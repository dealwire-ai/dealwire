/**
 * One row per screened parcel. Produced by the real ETL in
 * demos/denholtz-nj (not synthetic): statewide NJ class-1 vacant land,
 * 5–100 CALC_ACRE, screened against NJDEP wetlands, FEMA NFHL, Highlands,
 * Pinelands, sewer service areas, and preserved-land layers.
 *
 * The dataset (~13.7k rows, ~7.7MB raw) is served from
 * public/demos-data/denholtz-nj-parcels.json and fetched at runtime rather
 * than bundled — regenerate with
 * `pnpm --filter @dealwire/denholtz-nj-etl build-outputs`.
 *
 * A one-shot CoStar snapshot (exported Jul 24 2026 under Denholtz's license,
 * joined by demos/denholtz-nj/scripts/join-costar.py) attaches a `listing`
 * to ~231 matched parcels and provides the full 1,139-listing market layer
 * in denholtz-nj-listings.json.
 */
export interface NjParcel {
  pin: string;
  county: string;
  muni: string;
  address: string;
  acres: number;
  landDesc: string;
  landVal: number | null;
  imprvtVal: number | null;
  netVal: number | null;
  taxPrior: number | null;
  deedBook: string;
  deedPage: string;
  deedDate: string;
  salePrice: number | null;
  saleNuCode: string;
  lat: number;
  lng: number;
  /** % of parcel covered by NJDEP 2020 wetlands mapping; null = touches, pct unknown */
  wetlandsPct: number | null;
  floodZone: string;
  /** tri-state: "no-data" means FEMA has no digital mapping there — NOT "no risk" */
  floodSfha: "yes" | "no" | "no-data";
  highlands: "preservation" | "planning" | "none";
  pinelands: string;
  sewer: boolean;
  preservedPct: number | null;
  score: number;
  scoreNotes: string;
  /** CoStar listing joined onto this parcel (Jul 24 2026 export, Denholtz license) */
  listing?: ParcelListing;
}

/**
 * A CoStar listing matched to a screened parcel. `join` records how the
 * match was made: exact parcel-number ("pin"), listing point inside the
 * parcel polygon ("geo"), or nearest centroid within ~400m ("near").
 */
export interface ParcelListing {
  id: number;
  status: "active" | "off-market";
  price: number | null;
  dom: number | null;
  acres: number | null;
  broker: string | null;
  brokerContact: string | null;
  brokerPhone: string | null;
  owner: string | null;
  ownerPhone: string | null;
  zoning: string | null;
  use: string | null;
  lastSaleDate: string | null;
  lastSalePrice: number | null;
  join: "pin" | "geo" | "near";
  /** listing spans multiple parcels (CoStar assemblage) */
  multiParcel?: boolean;
}

/**
 * One row per CoStar listing — the full 1,139-listing export including
 * sub-5-acre tiers and parcels outside the class-1 screen. `pin`/`score`
 * are set when the listing matched a screened parcel.
 */
export interface MarketListing {
  id: number;
  tier: "0.25-1" | "1-5" | "5-100";
  status: "active" | "off-market";
  price: number | null;
  dom: number | null;
  acres: number | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  city: string | null;
  county: string | null;
  secondaryType: string | null;
  use: string | null;
  zoning: string | null;
  broker: string | null;
  brokerContact: string | null;
  brokerPhone: string | null;
  lastSaleDate: string | null;
  lastSalePrice: number | null;
  pin: string | null;
  join: "pin" | "geo" | "near" | null;
  score: number | null;
}

export async function loadParcels(): Promise<NjParcel[]> {
  const res = await fetch("/demos-data/denholtz-nj-parcels.json");
  if (!res.ok) throw new Error(`failed to load parcel data (${res.status})`);
  return (await res.json()) as NjParcel[];
}

export async function loadListings(): Promise<MarketListing[]> {
  const res = await fetch("/demos-data/denholtz-nj-listings.json");
  if (!res.ok) throw new Error(`failed to load listing data (${res.status})`);
  return (await res.json()) as MarketListing[];
}

/** Compact money for table cells: $1.2M / $850k / $900. */
export function moneyCompact(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(v >= 10e6 ? 0 : 1)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}k`;
  return `$${Math.round(v)}`;
}

const RESTRICTIVE_PINELANDS = [
  "preservation area district",
  "forest area",
  "agricultural production area",
  "special agricultural production area",
];

export function isPinelandsRestrictive(mgtArea: string): boolean {
  const m = mgtArea.toLowerCase();
  return RESTRICTIVE_PINELANDS.some((r) => m.includes(r));
}
