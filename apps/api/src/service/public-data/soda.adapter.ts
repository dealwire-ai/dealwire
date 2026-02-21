import { Injectable, Logger } from '@nestjs/common';

/**
 * Configuration for a specific Socrata (SODA) dataset.
 */
export interface SodaSourceConfig {
  /** Base URL of the Socrata portal (e.g., "https://data.cityofnewyork.us") */
  baseUrl: string;
  /** Dataset identifier (e.g., "9rz4-mjek") */
  datasetId: string;
  /** Human-readable name for logging */
  name: string;
}

/**
 * Parameters for a SODA API query.
 * Uses SoQL (Socrata Query Language).
 */
export interface SodaQueryParams {
  $where?: string;
  $select?: string;
  $order?: string;
  $limit?: number;
  $offset?: number;
  $group?: string;
  [key: string]: string | number | undefined;
}

/**
 * Generic Socrata Open Data API (SODA) client.
 * Reusable for any city's Socrata portal.
 */
@Injectable()
export class SodaAdapter {
  private readonly logger = new Logger(SodaAdapter.name);
  private readonly appToken: string | undefined;

  constructor() {
    this.appToken = process.env.NYC_OPEN_DATA_APP_TOKEN;
  }

  /**
   * Fetch a single page of results from a SODA dataset.
   */
  async fetch<T = Record<string, unknown>>(
    config: SodaSourceConfig,
    params: SodaQueryParams = {},
  ): Promise<T[]> {
    const url = new URL(`/resource/${config.datasetId}.json`, config.baseUrl);

    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (this.appToken) {
      headers['X-App-Token'] = this.appToken;
    }

    this.logger.log(`SODA fetch: ${config.name} (${url.toString().substring(0, 120)}...)`);

    const response = await fetch(url.toString(), { headers });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `SODA API error ${response.status} for ${config.name}: ${body.substring(0, 200)}`,
      );
    }

    return response.json() as Promise<T[]>;
  }

  /**
   * Fetch all results from a SODA dataset using pagination.
   * Yields pages of results as an async generator.
   */
  async *fetchAll<T = Record<string, unknown>>(
    config: SodaSourceConfig,
    params: SodaQueryParams = {},
    pageSize = 50000,
  ): AsyncGenerator<T[]> {
    let offset = params.$offset ?? 0;
    let hasMore = true;

    while (hasMore) {
      const page = await this.fetch<T>(config, {
        ...params,
        $limit: pageSize,
        $offset: offset,
      });

      if (page.length > 0) {
        yield page;
      }

      hasMore = page.length === pageSize;
      offset += page.length;
    }

    this.logger.log(`SODA fetchAll complete: ${config.name}, total offset=${offset}`);
  }
}
