/**
 * Stage B: screen every parcel against the 7 blocker layers with server-side
 * intersect queries. Resumable — one NDJSON line is appended per completed
 * parcel to data/checkpoints/blockers.ndjson and already-screened PINs are
 * skipped on restart. Concurrency 6; running hit-rates logged every 500
 * parcels so a broken layer URL surfaces in minutes, not hours.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import pLimit from "p-limit";
import { arcgisToGeoJSON, geojsonToArcGIS } from "@terraformer/arcgis";
import area from "@turf/area";
import { intersect } from "@turf/intersect";
import booleanIntersects from "@turf/boolean-intersects";
import simplify from "@turf/simplify";
import bbox from "@turf/bbox";
import { featureCollection, feature as toFeature } from "@turf/helpers";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import { queryLayer, type EsriFeature } from "./lib/arcgis.js";
import { BLOCKER_LAYERS, type BlockerLayer } from "./layers.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PARCELS_FILE = path.join(ROOT, "data", "raw", "parcels.ndjson");
const CHECKPOINT_DIR = path.join(ROOT, "data", "checkpoints");
const CHECKPOINT_FILE = path.join(CHECKPOINT_DIR, "blockers.ndjson");
const CONCURRENCY = 6;

type ParcelPoly = Feature<Polygon | MultiPolygon>;

export interface BlockerResult {
  pams_pin: string;
  wetlands_pct: number | null;
  flood_zone: string;
  flood_sfha: "yes" | "no" | "no-data";
  highlands: "preservation" | "planning" | "none";
  pinelands: string;
  in_sewer_service_area: boolean;
  openspace_pct: number | null;
  sadc_pct: number | null;
  geometry_degraded: boolean;
}

/** SFHA = 1%-annual-chance zones. NFHL FLD_ZONE values that count: A, AE, AH, AO, A99, V, VE. */
function isSfhaZone(zone: string): boolean {
  const z = zone.toUpperCase().trim();
  return (
    z === "A" ||
    z.startsWith("AE") ||
    z.startsWith("AH") ||
    z.startsWith("AO") ||
    z.startsWith("A9") ||
    z === "V" ||
    z.startsWith("VE")
  );
}

/** Zones that carry no mapping information. */
function isNoDataZone(zone: string): boolean {
  const z = zone.toUpperCase().trim();
  return z === "D" || z.includes("NOT INCLUDED");
}

const PINELANDS_SEVERITY = [
  "Preservation Area District",
  "Forest Area",
  "Special Agricultural Production Area",
  "Agricultural Production Area",
  "Rural Development Area",
  "Military and Federal Installation Area",
  "Pinelands Village",
  "Pinelands Town",
  "Regional Growth Area",
];

function worstPinelands(names: string[]): string {
  let best = "";
  let bestIdx = Number.POSITIVE_INFINITY;
  for (const raw of names) {
    const name = raw.trim();
    const idx = PINELANDS_SEVERITY.findIndex((s) =>
      name.toLowerCase().includes(s.toLowerCase()),
    );
    const rank = idx === -1 ? PINELANDS_SEVERITY.length : idx;
    if (rank < bestIdx) {
      bestIdx = rank;
      best = name;
    }
  }
  return best || "none";
}

const FLOOD_SEVERITY = ["VE", "V", "AO", "AH", "AE", "A99", "A", "X"];

function worstFloodZone(zones: string[]): string {
  let best = "";
  let bestIdx = Number.POSITIVE_INFINITY;
  for (const raw of zones) {
    const z = raw.toUpperCase().trim();
    const idx = FLOOD_SEVERITY.findIndex((s) => z === s || z.startsWith(s));
    const rank = idx === -1 ? FLOOD_SEVERITY.length : idx;
    if (rank < bestIdx) {
      bestIdx = rank;
      best = z;
    }
  }
  return best || "none";
}

interface GeometryVariant {
  esri: unknown;
  geojson: ParcelPoly;
  degraded: boolean;
}

/** Build query geometry variants: original → simplified → envelope. */
function geometryVariants(esriGeometry: unknown): GeometryVariant[] {
  const geojsonGeom = arcgisToGeoJSON(esriGeometry as never) as unknown as
    | Polygon
    | MultiPolygon;
  const parcel = toFeature(geojsonGeom) as ParcelPoly;
  const variants: GeometryVariant[] = [
    { esri: esriGeometry, geojson: parcel, degraded: false },
  ];
  try {
    const simplified = simplify(parcel, {
      tolerance: 0.0001,
      highQuality: false,
    });
    variants.push({
      esri: geojsonToArcGIS(simplified.geometry as never),
      geojson: simplified as ParcelPoly,
      degraded: true,
    });
  } catch {
    // fall through to envelope
  }
  const [minX, minY, maxX, maxY] = bbox(parcel);
  const envelope: Polygon = {
    type: "Polygon",
    coordinates: [
      [
        [minX, minY],
        [maxX, minY],
        [maxX, maxY],
        [minX, maxY],
        [minX, minY],
      ],
    ],
  };
  variants.push({
    esri: geojsonToArcGIS(envelope as never),
    geojson: toFeature(envelope) as ParcelPoly,
    degraded: true,
  });
  return variants;
}

async function intersectQuery(
  layer: BlockerLayer,
  variant: GeometryVariant,
  wantGeometry: boolean,
): Promise<EsriFeature[]> {
  const params: Record<string, string> = {
    where: "1=1",
    geometry: JSON.stringify(variant.esri),
    geometryType: "esriGeometryPolygon",
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: layer.outFields.join(","),
    returnGeometry: wantGeometry ? "true" : "false",
    ...(wantGeometry ? { outSR: "4326", geometryPrecision: "6" } : {}),
  };
  const urls = [layer.url, ...(layer.fallbackUrl ? [layer.fallbackUrl] : [])];
  let lastErr: unknown;
  for (const url of urls) {
    try {
      const res = await queryLayer(url, params);
      return res.features;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

/** % of the parcel covered by the layer's features; null = touches but pct unknown. */
function coveragePct(
  parcel: ParcelPoly,
  features: EsriFeature[],
): number | null {
  if (features.length === 0) return 0;
  const parcelArea = area(parcel);
  if (parcelArea <= 0) return null;
  let covered = 0;
  let anyFailure = false;
  for (const f of features) {
    if (!f.geometry) {
      anyFailure = true;
      continue;
    }
    try {
      const geom = arcgisToGeoJSON(f.geometry as never) as unknown as
        | Polygon
        | MultiPolygon;
      const other = toFeature(geom) as ParcelPoly;
      const overlap = intersect(featureCollection([parcel, other] as never));
      if (overlap) covered += area(overlap);
      else if (booleanIntersects(parcel, other)) anyFailure = true;
    } catch {
      anyFailure = true;
    }
  }
  if (covered === 0 && anyFailure) return null; // touches, pct unknown — never a silent 0
  return Math.min(100, Math.round((covered / parcelArea) * 100));
}

async function screenParcel(parcel: EsriFeature): Promise<BlockerResult> {
  const pin = String(parcel.attributes.PAMS_PIN);
  const variants = geometryVariants(parcel.geometry);

  let lastErr: unknown;
  for (const variant of variants) {
    try {
      const result: BlockerResult = {
        pams_pin: pin,
        wetlands_pct: 0,
        flood_zone: "none",
        flood_sfha: "no-data",
        highlands: "none",
        pinelands: "none",
        in_sewer_service_area: false,
        openspace_pct: 0,
        sadc_pct: 0,
        geometry_degraded: variant.degraded,
      };
      for (const layer of BLOCKER_LAYERS) {
        const features = await intersectQuery(
          layer,
          variant,
          layer.mode === "area",
        );
        switch (layer.key) {
          case "wetlands":
            result.wetlands_pct = coveragePct(variant.geojson, features);
            break;
          case "openspace":
            result.openspace_pct = coveragePct(variant.geojson, features);
            break;
          case "sadc":
            result.sadc_pct = coveragePct(variant.geojson, features);
            break;
          case "flood": {
            const zones = features.map((f) =>
              String(f.attributes.FLD_ZONE ?? ""),
            );
            const informative = zones.filter((z) => z && !isNoDataZone(z));
            if (informative.length === 0) {
              result.flood_sfha = "no-data";
              result.flood_zone = "no-data";
            } else {
              result.flood_sfha = informative.some(isSfhaZone) ? "yes" : "no";
              result.flood_zone = worstFloodZone(informative);
              const shadedX = features.some((f) =>
                String(f.attributes.ZONE_SUBTY ?? "")
                  .toUpperCase()
                  .includes("0.2 PCT"),
              );
              if (result.flood_sfha === "no" && shadedX)
                result.flood_zone = "X-shaded";
            }
            break;
          }
          case "highlands": {
            const regions = features.map((f) =>
              String(f.attributes.REGION ?? "").toLowerCase(),
            );
            result.highlands = regions.some((r) => r.includes("preservation"))
              ? "preservation"
              : regions.some((r) => r.includes("planning"))
                ? "planning"
                : "none";
            break;
          }
          case "pinelands":
            result.pinelands =
              features.length === 0
                ? "none"
                : worstPinelands(
                    features.map((f) => String(f.attributes.MGT_NAME ?? "")),
                  );
            break;
          case "sewer":
            result.in_sewer_service_area = features.length > 0;
            break;
        }
      }
      return result;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(`all geometry variants failed for ${pin}`);
}

async function readNdjson(file: string): Promise<EsriFeature[]> {
  const rows: EsriFeature[] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(file),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (line.trim()) rows.push(JSON.parse(line));
  }
  return rows;
}

async function main() {
  fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
  const parcels = await readNdjson(PARCELS_FILE);

  const done = new Set<string>();
  if (fs.existsSync(CHECKPOINT_FILE)) {
    for (const row of await readNdjson(CHECKPOINT_FILE)) {
      done.add(String((row as unknown as BlockerResult).pams_pin));
    }
  }
  let todo = parcels.filter((p) => !done.has(String(p.attributes.PAMS_PIN)));
  const limit_ = Number(process.env.LIMIT ?? 0);
  if (limit_ > 0) todo = todo.slice(0, limit_); // smoke-test mode
  console.log(
    `parcels: ${parcels.length} total, ${done.size} checkpointed, ${todo.length} to screen`,
  );

  const out = fs.createWriteStream(CHECKPOINT_FILE, { flags: "a" });
  const limit = pLimit(CONCURRENCY);
  const stats = {
    completed: 0,
    failed: 0,
    wetlands: 0,
    sfha: 0,
    highlands: 0,
    pinelands: 0,
    sewer: 0,
    preserved: 0,
  };
  const startedAt = Date.now();

  const logProgress = () => {
    const n = stats.completed;
    const rate = (k: number) => `${((k / Math.max(n, 1)) * 100).toFixed(1)}%`;
    const elapsed = ((Date.now() - startedAt) / 60000).toFixed(1);
    console.log(
      `[${elapsed}m] ${n}/${todo.length} screened (${stats.failed} failed) | ` +
        `wetlands>0 ${rate(stats.wetlands)} | SFHA ${rate(stats.sfha)} | ` +
        `highlands ${rate(stats.highlands)} | pinelands ${rate(stats.pinelands)} | ` +
        `sewer ${rate(stats.sewer)} | preserved>0 ${rate(stats.preserved)}`,
    );
  };

  await Promise.all(
    todo.map((parcel) =>
      limit(async () => {
        try {
          const result = await screenParcel(parcel);
          out.write(JSON.stringify(result) + "\n");
          stats.completed++;
          if ((result.wetlands_pct ?? 1) > 0) stats.wetlands++;
          if (result.flood_sfha === "yes") stats.sfha++;
          if (result.highlands !== "none") stats.highlands++;
          if (result.pinelands !== "none") stats.pinelands++;
          if (result.in_sewer_service_area) stats.sewer++;
          if ((result.openspace_pct ?? 1) > 0 || (result.sadc_pct ?? 1) > 0)
            stats.preserved++;
          if (stats.completed % 500 === 0) logProgress();
        } catch (err) {
          stats.failed++;
          console.error(
            `FAILED ${String(parcel.attributes.PAMS_PIN)}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }),
    ),
  );

  await new Promise((resolve, reject) =>
    out.end((err: unknown) => (err ? reject(err) : resolve(null))),
  );
  logProgress();
  console.log(
    `\ndone: ${stats.completed} screened, ${stats.failed} failed` +
      (stats.failed > 0
        ? " — re-run to retry failures (checkpoint skips completed)"
        : ""),
  );
  if (stats.failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
