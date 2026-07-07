/**
 * Stage A: fetch the parcel universe — statewide NJ class-1 vacant land,
 * 5–100 CALC_ACRE, with geometry — into data/raw/parcels.ndjson.
 * Expected universe ≈ 13,980 (live count, Jul 2026). Dedupes PAMS_PIN
 * keeping the largest CALC_ACRE and reports the dupe rate.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { queryAllPages, type EsriFeature } from "./lib/arcgis.js";
import { PARCELS_LAYER, PARCEL_OUT_FIELDS, PARCEL_WHERE } from "./layers.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RAW_DIR = path.join(ROOT, "data", "raw");
const OUT_FILE = path.join(RAW_DIR, "parcels.ndjson");

async function main() {
  fs.mkdirSync(RAW_DIR, { recursive: true });

  const byPin = new Map<string, EsriFeature>();
  let fetched = 0;
  let dupes = 0;

  for await (const page of queryAllPages(PARCELS_LAYER, {
    where: PARCEL_WHERE,
    outFields: PARCEL_OUT_FIELDS.join(","),
    returnGeometry: "true",
    outSR: "4326",
    geometryPrecision: "6",
  })) {
    for (const f of page) {
      fetched++;
      const pin = String(f.attributes.PAMS_PIN ?? "").trim();
      if (!pin) continue;
      const existing = byPin.get(pin);
      if (existing) {
        dupes++;
        const keep =
          Number(f.attributes.CALC_ACRE ?? 0) >
          Number(existing.attributes.CALC_ACRE ?? 0)
            ? f
            : existing;
        byPin.set(pin, keep);
      } else {
        byPin.set(pin, f);
      }
    }
    process.stdout.write(`\rfetched ${fetched} features…`);
  }
  console.log();

  const out = fs.createWriteStream(OUT_FILE);
  const countyHist = new Map<string, number>();
  for (const f of byPin.values()) {
    out.write(JSON.stringify(f) + "\n");
    const county = String(f.attributes.COUNTY ?? "UNKNOWN");
    countyHist.set(county, (countyHist.get(county) ?? 0) + 1);
  }
  await new Promise((resolve, reject) =>
    out.end((err: unknown) => (err ? reject(err) : resolve(null))),
  );

  const dupePct = ((dupes / Math.max(fetched, 1)) * 100).toFixed(2);
  console.log(`\n== Stage A report ==`);
  console.log(`features fetched:   ${fetched}`);
  console.log(`unique PAMS_PIN:    ${byPin.size}`);
  console.log(`duplicate rows:     ${dupes} (${dupePct}%)`);
  console.log(`counties:           ${countyHist.size}`);
  console.log(`\nper-county histogram:`);
  for (const [county, n] of [...countyHist.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${county.padEnd(14)} ${n}`);
  }
  if (dupes / Math.max(fetched, 1) > 0.01) {
    console.warn(`\nWARNING: dupe rate exceeds 1% — inspect before Stage B.`);
  }
  console.log(`\nwrote ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
