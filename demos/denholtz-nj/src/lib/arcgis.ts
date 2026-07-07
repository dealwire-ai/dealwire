/**
 * Minimal ArcGIS REST query client for the NJ land screen ETL.
 * POST-based (parcel polygons exceed GET URL limits), 3-retry exponential
 * backoff with jitter, 30s timeout. ArcGIS returns errors as HTTP 200 with
 * an `error` payload, so both paths are checked.
 */

export interface EsriFeature {
  attributes: Record<string, unknown>;
  geometry?: unknown;
}

export interface EsriQueryResponse {
  features: EsriFeature[];
  exceededTransferLimit?: boolean;
  error?: { code: number; message: string };
}

const TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function queryLayer(
  layerUrl: string,
  params: Record<string, string>,
): Promise<EsriQueryResponse> {
  const body = new URLSearchParams({ f: "json", ...params });
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const backoff = 1000 * 2 ** attempt + Math.random() * 1000;
      await sleep(backoff);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${layerUrl}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: controller.signal,
      });
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} from ${layerUrl}`);
        continue;
      }
      const json = (await res.json()) as EsriQueryResponse;
      if (json.error) {
        lastError = new Error(
          `ArcGIS error ${json.error.code} from ${layerUrl}: ${json.error.message}`,
        );
        continue;
      }
      return json;
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`query failed for ${layerUrl}: ${String(lastError)}`);
}

/**
 * Page through a layer with resultOffset pagination; falls back to
 * OBJECTID-window paging if the server stops honoring offsets.
 */
export async function* queryAllPages(
  layerUrl: string,
  params: Record<string, string>,
  pageSize = 1000,
): AsyncGenerator<EsriFeature[]> {
  let offset = 0;
  while (true) {
    const page = await queryLayer(layerUrl, {
      ...params,
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
      orderByFields: "OBJECTID",
    });
    if (page.features.length > 0) yield page.features;
    if (page.features.length < pageSize && !page.exceededTransferLimit) return;
    offset += page.features.length;
    if (page.features.length === 0) {
      // Pagination not honored — switch to OBJECTID windowing.
      yield* queryByObjectIdWindows(layerUrl, params, pageSize, offset);
      return;
    }
  }
}

async function* queryByObjectIdWindows(
  layerUrl: string,
  params: Record<string, string>,
  pageSize: number,
  alreadyFetched: number,
): AsyncGenerator<EsriFeature[]> {
  let lastOid = -1;
  let skipped = 0;
  while (true) {
    const where = `(${params.where}) AND OBJECTID > ${lastOid}`;
    const page = await queryLayer(layerUrl, {
      ...params,
      where,
      resultRecordCount: String(pageSize),
      orderByFields: "OBJECTID",
    });
    if (page.features.length === 0) return;
    const oids = page.features.map((f) => Number(f.attributes.OBJECTID));
    lastOid = Math.max(...oids);
    // Skip rows the offset-paging path already produced.
    if (skipped < alreadyFetched) {
      const remaining = alreadyFetched - skipped;
      skipped += Math.min(remaining, page.features.length);
      if (page.features.length <= remaining) continue;
      yield page.features.slice(remaining);
    } else {
      yield page.features;
    }
    if (page.features.length < pageSize && !page.exceededTransferLimit) return;
  }
}
