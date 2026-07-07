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
}

export async function loadParcels(): Promise<NjParcel[]> {
  const res = await fetch("/demos-data/denholtz-nj-parcels.json");
  if (!res.ok) throw new Error(`failed to load parcel data (${res.status})`);
  return (await res.json()) as NjParcel[];
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
