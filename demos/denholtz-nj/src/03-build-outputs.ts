/**
 * Stage C: join the parcel universe with blocker-screen results, score every
 * parcel, and emit the three final artifacts:
 *   1. apps/web demo dataset  — parcels.json (minified, full screened set)
 *   2. client CSV             — output/denholtz-nj-land-screen-<date>.csv
 *   3. caveats / email body   — output/DELIVERABLE_NOTES.md
 * Exits non-zero if the hard sanity thresholds fail (see printSanityReport).
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { stringify } from "csv-stringify/sync";
import { arcgisToGeoJSON } from "@terraformer/arcgis";
import centroid from "@turf/centroid";
import { feature as toFeature } from "@turf/helpers";
import type { Polygon, MultiPolygon } from "geojson";
import type { EsriFeature } from "./lib/arcgis.js";
import type { BlockerResult } from "./02-screen-blockers.js";
import { computeScore, isPinelandsRestrictive } from "./score.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PARCELS_FILE = path.join(ROOT, "data", "raw", "parcels.ndjson");
const CHECKPOINT_FILE = path.join(
  ROOT,
  "data",
  "checkpoints",
  "blockers.ndjson",
);
const OUTPUT_DIR = path.join(ROOT, "output");
const WEB_JSON = path.resolve(
  ROOT,
  "../../apps/web/public/demos-data/denholtz-nj-parcels.json",
);

const EXPECTED_UNIVERSE = 13_980;
const PINELANDS_COUNTIES = new Set([
  "ATLANTIC",
  "BURLINGTON",
  "OCEAN",
  "CAPE MAY",
  "CUMBERLAND",
]);
const HIGHLANDS_COUNTIES = new Set([
  "MORRIS",
  "PASSAIC",
  "SUSSEX",
  "WARREN",
  "HUNTERDON",
  "SOMERSET",
  "BERGEN",
]);

/** Row shape shared by the demo page (NjParcel in data.ts) and the CSV. */
interface OutputRow {
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
  wetlandsPct: number | null;
  floodZone: string;
  floodSfha: "yes" | "no" | "no-data";
  highlands: "preservation" | "planning" | "none";
  pinelands: string;
  sewer: boolean;
  preservedPct: number | null;
  score: number;
  scoreNotes: string;
}

async function readNdjson<T>(file: string): Promise<T[]> {
  const rows: T[] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.trim()) rows.push(JSON.parse(line));
  }
  return rows;
}

const num = (v: unknown): number | null =>
  v === null || v === undefined || v === "" || Number.isNaN(Number(v))
    ? null
    : Number(v);

const str = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v).trim();

/**
 * MOD-IV date fields arrive as epoch millis from ArcGIS. Values near epoch
 * zero are MOD-IV "no date" sentinels, not real 1970 deeds — treat anything
 * before 1930 as empty.
 */
const isoDate = (v: unknown): string => {
  const n = num(v);
  if (n === null || n <= 0) return "";
  const d = new Date(n);
  if (Number.isNaN(d.getTime()) || d.getUTCFullYear() <= 1970) return "";
  return d.toISOString().slice(0, 10);
};

function buildRow(
  parcel: EsriFeature,
  blockers: BlockerResult,
): OutputRow | null {
  const a = parcel.attributes;
  const openspace = blockers.openspace_pct;
  const sadc = blockers.sadc_pct;
  const preservedPct =
    openspace === null || sadc === null
      ? openspace === null && sadc === null
        ? null
        : Math.max(openspace ?? 0, sadc ?? 0) || null
      : Math.max(openspace, sadc);

  // Exclusion rule: majority-preserved parcels are not acquirable inventory.
  if (preservedPct !== null && preservedPct > 50) return null;

  let lat = 0;
  let lng = 0;
  try {
    const geom = arcgisToGeoJSON(parcel.geometry as never) as unknown as
      | Polygon
      | MultiPolygon;
    const c = centroid(toFeature(geom));
    [lng, lat] = c.geometry.coordinates;
  } catch {
    return null; // no usable geometry — cannot place or verify the parcel
  }

  const acres = num(a.CALC_ACRE) ?? 0;
  const landVal = num(a.LAND_VAL);
  const { score, notes } = computeScore({
    calcAcres: acres,
    landVal,
    wetlandsPct: blockers.wetlands_pct,
    floodSfha: blockers.flood_sfha,
    floodZone: blockers.flood_zone,
    highlands: blockers.highlands,
    pinelands: blockers.pinelands,
    inSewerServiceArea: blockers.in_sewer_service_area,
    preservedPct,
  });

  return {
    pin: str(a.PAMS_PIN),
    county: str(a.COUNTY),
    muni: str(a.MUN_NAME),
    address: str(a.PROP_LOC),
    acres: Math.round(acres * 100) / 100,
    landDesc: str(a.LAND_DESC),
    landVal,
    imprvtVal: num(a.IMPRVT_VAL),
    netVal: num(a.NET_VALUE),
    taxPrior: num(a.LAST_YR_TX),
    deedBook: str(a.DEED_BOOK),
    deedPage: str(a.DEED_PAGE),
    deedDate: isoDate(a.DEED_DATE),
    // MOD-IV uses 0/1 sentinel sale prices for "none recorded" — blank them.
    salePrice: (num(a.SALE_PRICE) ?? 0) > 1 ? num(a.SALE_PRICE) : null,
    saleNuCode: str(a.SALES_CODE),
    lat: Math.round(lat * 1e5) / 1e5,
    lng: Math.round(lng * 1e5) / 1e5,
    wetlandsPct: blockers.wetlands_pct,
    floodZone: blockers.flood_zone,
    floodSfha: blockers.flood_sfha,
    highlands: blockers.highlands,
    pinelands: blockers.pinelands,
    sewer: blockers.in_sewer_service_area,
    preservedPct,
    score,
    scoreNotes: notes,
  };
}

const CSV_HEADER = [
  "pams_pin",
  "county",
  "municipality",
  "property_location",
  "prop_class",
  "calc_acres",
  "land_desc",
  "assessed_land_value",
  "assessed_improvement_value",
  "assessed_net_value",
  "prior_year_tax_billed",
  "deed_book",
  "deed_page",
  "deed_date",
  "sale_price",
  "sale_nu_code",
  "centroid_lat",
  "centroid_lng",
  "wetlands_pct",
  "flood_zone",
  "flood_sfha",
  "highlands",
  "pinelands_mgt_area",
  "in_sewer_service_area",
  "preserved_pct",
  "developability_score",
  "score_notes",
];

const blank = (v: number | null): number | string => (v === null ? "" : v);

function toCsvRecord(r: OutputRow): (string | number)[] {
  return [
    r.pin,
    r.county,
    r.muni,
    r.address,
    "1",
    r.acres,
    r.landDesc,
    blank(r.landVal),
    blank(r.imprvtVal),
    blank(r.netVal),
    blank(r.taxPrior),
    r.deedBook,
    r.deedPage,
    r.deedDate,
    blank(r.salePrice),
    r.saleNuCode,
    r.lat,
    r.lng,
    r.wetlandsPct === null ? "unknown" : r.wetlandsPct,
    r.floodZone,
    r.floodSfha,
    r.highlands,
    r.pinelands,
    r.sewer ? "yes" : "no",
    r.preservedPct === null ? "unknown" : r.preservedPct,
    r.score,
    r.scoreNotes,
  ];
}

function printSanityReport(
  rows: OutputRow[],
  joined: number,
  universe: number,
): boolean {
  let ok = true;
  const fail = (msg: string) => {
    ok = false;
    console.error(`  FAIL  ${msg}`);
  };
  const pass = (msg: string) => console.log(`  ok    ${msg}`);

  console.log("\n== Stage C sanity report ==");

  const drift = Math.abs(universe - EXPECTED_UNIVERSE) / EXPECTED_UNIVERSE;
  drift <= 0.02
    ? pass(`universe ${universe} within ±2% of ${EXPECTED_UNIVERSE}`)
    : fail(`universe ${universe} drifted >2% from ${EXPECTED_UNIVERSE}`);
  joined === universe
    ? pass(`all ${universe} parcels joined to blocker results`)
    : fail(
        `${universe - joined} parcels missing blocker results — re-run Stage B`,
      );

  const counties = new Set(rows.map((r) => r.county));
  counties.size === 21
    ? pass(`all 21 counties present`)
    : fail(`only ${counties.size} counties present`);

  const pineHits = rows.filter((r) => r.pinelands !== "none");
  const pineInCore = pineHits.filter((r) =>
    PINELANDS_COUNTIES.has(r.county),
  ).length;
  const pineShare = pineHits.length ? pineInCore / pineHits.length : 0;
  pineShare >= 0.8
    ? pass(
        `pinelands hits ${pineHits.length}, ${(pineShare * 100).toFixed(0)}% in core S. Jersey counties`,
      )
    : fail(
        `pinelands hits only ${(pineShare * 100).toFixed(0)}% in core counties`,
      );
  const pineNorth = pineHits.filter(
    (r) => r.county === "BERGEN" || r.county === "HUDSON",
  ).length;
  pineNorth === 0
    ? pass(`zero pinelands hits in Bergen/Hudson`)
    : fail(
        `${pineNorth} pinelands hits in Bergen/Hudson — layer join is wrong`,
      );

  const highHits = rows.filter((r) => r.highlands !== "none");
  const highInCore = highHits.filter((r) =>
    HIGHLANDS_COUNTIES.has(r.county),
  ).length;
  const highShare = highHits.length ? highInCore / highHits.length : 0;
  highShare >= 0.95
    ? pass(
        `highlands hits ${highHits.length}, ${(highShare * 100).toFixed(0)}% in Highlands counties`,
      )
    : fail(
        `highlands hits only ${(highShare * 100).toFixed(0)}% in Highlands counties`,
      );

  const wetVals = rows
    .map((r) => r.wetlandsPct)
    .filter((v): v is number => v !== null);
  const wetMean =
    wetVals.reduce((s, v) => s + v, 0) / Math.max(wetVals.length, 1);
  const wetDistinct = new Set(wetVals).size;
  wetDistinct > 10 && wetMean > 1 && wetMean < 99
    ? pass(
        `wetlands_pct non-degenerate (mean ${wetMean.toFixed(1)}, ${wetDistinct} distinct values)`,
      )
    : fail(
        `wetlands_pct degenerate (mean ${wetMean.toFixed(1)}, ${wetDistinct} distinct values)`,
      );

  const sewerRate =
    rows.filter((r) => r.sewer).length / Math.max(rows.length, 1);
  sewerRate >= 0.2 && sewerRate <= 0.5
    ? pass(`sewer hit-rate ${(sewerRate * 100).toFixed(1)}%`)
    : fail(
        `sewer hit-rate ${(sewerRate * 100).toFixed(1)}% outside 20–50% band`,
      );

  const noData =
    rows.filter((r) => r.floodSfha === "no-data").length /
    Math.max(rows.length, 1);
  noData <= 0.15
    ? pass(`flood no-data share ${(noData * 100).toFixed(1)}%`)
    : fail(`flood no-data share ${(noData * 100).toFixed(1)}% exceeds 15%`);

  const notesMissing = rows.filter((r) => !r.scoreNotes).length;
  notesMissing === 0
    ? pass(`score_notes populated on every row`)
    : fail(`${notesMissing} rows missing score_notes`);

  return ok;
}

function deliverableNotes(rows: OutputRow[], vintageNote: string): string {
  const priority = rows.filter((r) => r.score >= 70).length;
  return `# New Jersey Land Screen — Notes on the Data

**What this is:** every New Jersey tax parcel classified as vacant land (property class 1)
between 5 and 100 acres, statewide — ${rows.length.toLocaleString()} parcels — screened
against the public development-blocker layers below. ${priority.toLocaleString()} parcels
score 70+ ("priority targets"). Built entirely from public records; no licensed data.

**How to read the score (0–99):** every parcel starts at 50. Sewer service adds 25.
Wetlands coverage subtracts up to 40 (0.4 × percent covered). FEMA flood zones subtract
15 (1%-annual-chance) or 5 (0.2%). Highlands Preservation Area and restrictive Pinelands
management areas cap the score at 15 — greenfield development in those regimes is
effectively off the table. Moderate adjustments for acreage sweet spot (10–40 ac) and
assessed land value per acre. The \`score_notes\` column shows the exact arithmetic for
each parcel.

**Caveats — please read before acting on any parcel:**

- **Screening-grade, not survey-grade.** Wetlands come from NJDEP's 2020 land-use/land-cover
  mapping (photo-interpreted, 0.25-acre minimum unit) — not a field delineation. A formal
  determination requires an NJDEP Letter of Interpretation. Treat the flags as "where to
  spend diligence dollars," not as regulatory conclusions.
- **Flood "no-data" is not "no risk."** FEMA's digital flood layer has coverage gaps in
  parts of NJ. Parcels marked \`no-data\` are unmapped, not clear.
- **Tax figure is prior-year billed tax** (MOD-IV \`LAST_YR_TX\`), with current assessed
  values. Delinquency and tax-sale status are only public per-municipality in NJ — no
  statewide feed exists; we can pull specific municipalities on request.
- **No owner information.** New Jersey redacts owner names from its published parcel data
  (Daniel's Law). Ownership for specific targets can be pulled from county deed records.
- **Preserved land excluded.** Parcels more than half covered by mapped open space or
  farmland-preservation easements were removed; partial overlaps (5–50%) are flagged in
  \`preserved_pct\`.
- **Farms excluded by class.** Farmland-assessed parcels (class 3B) are intentionally out
  of scope per our agreed criteria.
- **Vintage:** ${vintageNote} MOD-IV attributes can lag reality by up to a tax year.

**Column dictionary:** \`pams_pin\` is NJ's statewide parcel ID (county-municipality _
block _ lot). Assessed values are the municipal assessor's figures, not market value.
\`flood_zone\` is the most severe FEMA zone touching the parcel. \`pinelands_mgt_area\`
names the Pinelands management area; "Regional Growth Area" and Towns/Villages are the
developable ones. Blank cells mean the source had no value; "unknown" means the parcel
touches the layer but the overlap percentage could not be computed.
`;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const parcels = await readNdjson<EsriFeature>(PARCELS_FILE);
  const blockers = await readNdjson<BlockerResult>(CHECKPOINT_FILE);
  const blockersByPin = new Map(blockers.map((b) => [b.pams_pin, b]));

  const rows: OutputRow[] = [];
  let joined = 0;
  let droppedPreserved = 0;
  let droppedGeometry = 0;
  for (const parcel of parcels) {
    const b = blockersByPin.get(String(parcel.attributes.PAMS_PIN));
    if (!b) continue;
    joined++;
    const row = buildRow(parcel, b);
    if (row) rows.push(row);
    else if (
      b.openspace_pct === null ||
      (b.openspace_pct ?? 0) > 50 ||
      (b.sadc_pct ?? 0) > 50
    )
      droppedPreserved++;
    else droppedGeometry++;
  }
  rows.sort((a, b) => b.score - a.score || a.pin.localeCompare(b.pin));

  const date = new Date().toISOString().slice(0, 10);
  const vintageNote = `Parcel/MOD-IV composite pulled ${date} from NJ Office of GIS.`;

  fs.writeFileSync(WEB_JSON, JSON.stringify(rows));
  const csvPath = path.join(OUTPUT_DIR, `denholtz-nj-land-screen-${date}.csv`);
  fs.writeFileSync(csvPath, stringify([CSV_HEADER, ...rows.map(toCsvRecord)]));
  fs.writeFileSync(
    path.join(OUTPUT_DIR, "DELIVERABLE_NOTES.md"),
    deliverableNotes(rows, vintageNote),
  );

  console.log(`parcels in universe:      ${parcels.length}`);
  console.log(`joined blocker results:   ${joined}`);
  console.log(`dropped >50% preserved:   ${droppedPreserved}`);
  console.log(`dropped unusable geometry:${droppedGeometry}`);
  console.log(`final screened rows:      ${rows.length}`);
  console.log(
    `priority targets (70+):   ${rows.filter((r) => r.score >= 70).length}`,
  );
  console.log(
    `pinelands restrictive:    ${rows.filter((r) => r.pinelands !== "none" && isPinelandsRestrictive(r.pinelands)).length}`,
  );
  console.log(
    `\nwrote ${WEB_JSON} (${(fs.statSync(WEB_JSON).size / 1e6).toFixed(1)} MB)`,
  );
  console.log(`wrote ${csvPath}`);
  console.log(`wrote ${path.join(OUTPUT_DIR, "DELIVERABLE_NOTES.md")}`);

  const ok = printSanityReport(rows, joined, parcels.length);
  if (!ok) {
    console.error("\nSANITY REPORT FAILED — do not ship these outputs.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
