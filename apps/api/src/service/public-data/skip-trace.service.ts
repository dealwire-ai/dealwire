import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BOROUGH_NAMES } from './nyc-utils';

interface OwnerPhone {
  number: string;
  type: string;
  rank: number;
  source?: 'tracerfy' | 'skipsherpa';
  isDnc?: boolean;
}

/** Skip Sherpa property lookup request */
interface SkipSherpaLookup {
  property_address_lookup: {
    street: string;
    city: string;
    state: string;
    zip?: string;
  };
  owner_entity_lookup?: { name: string } | null;
}

/** Skip Sherpa phone number in response */
interface SkipSherpaPhone {
  e164_format?: string;
  local_format?: string;
  type?: string;
  carrier?: string;
  last_seen?: string;
  dnc_statuses?: Array<{ is_dnc?: boolean; is_registered?: boolean }>;
}

/** Skip Sherpa person/owner in response */
interface SkipSherpaPerson {
  name?: string;
  phone_numbers?: SkipSherpaPhone[];
  emails?: Array<{ email_address?: string }>;
}

/** Skip Sherpa property result */
interface SkipSherpaPropertyResult {
  status_code: number;
  issues?: Array<{ code_str?: string }>;
  property?: {
    owners?: Array<{
      person?: SkipSherpaPerson | null;
      business?: SkipSherpaPerson | null;
    }>;
  } | null;
}

/** A single result record from GET /queue/:id (flat phone/email fields) */
interface TracerfyResultRecord {
  first_name?: string;
  last_name?: string;
  address?: string;
  primary_phone?: string;
  mobile_1?: string;
  mobile_2?: string;
  mobile_3?: string;
  mobile_4?: string;
  mobile_5?: string;
  landline_1?: string;
  landline_2?: string;
  landline_3?: string;
  email_1?: string;
  email_2?: string;
  email_3?: string;
  email_4?: string;
  email_5?: string;
  [key: string]: string | undefined;
}

/** Response from GET /queue/:id — pending:false means complete */
interface TracerfyQueueResponse {
  id?: number | string;
  queue_id?: number | string;
  pending?: boolean;
  results?: unknown[];
  [key: string]: unknown;
}

/** Pending item in the single-BBL queue */
interface QueuedRequest {
  bbl: string;
  force: boolean;
  organizationId: string;
  resolve: (result: {
    queueId: string;
    queued: string[];
    skipped: number;
  }) => void;
  reject: (err: Error) => void;
}

@Injectable()
export class SkipTraceService {
  private readonly logger = new Logger(SkipTraceService.name);
  private readonly apiKey = process.env.TRACERFY_API_KEY;
  private readonly baseUrl = 'https://tracerfy.com/v1/api';
  private readonly monthlyCreditCap = parseInt(
    process.env.TRACERFY_MONTHLY_CREDIT_CAP ?? '500',
  );

  /** Per-org monthly skip trace limit */
  private readonly orgMonthlyLimit = parseInt(
    process.env.ORG_SKIP_TRACE_MONTHLY_LIMIT ?? '100',
  );

  /** Skip Sherpa fallback provider */
  private readonly skipSherpaApiKey = process.env.SKIPSHERPA_API_KEY;
  private readonly skipSherpaBaseUrl = 'https://skipsherpa.com/api/beta6';

  /** Buffer for single-BBL requests — flushed as one batch after FLUSH_DELAY_MS */
  private pendingQueue: QueuedRequest[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly FLUSH_DELAY_MS = 5_000;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Queue a single BBL for skip tracing. Buffers requests for 5 seconds,
   * then flushes all queued BBLs as one Tracerfy batch to avoid rate limits.
   * Returns a promise that resolves when the batch is submitted.
   */
  enqueue(
    bbl: string,
    organizationId: string,
    force = false,
  ): Promise<{ queueId: string; queued: string[]; skipped: number }> {
    return new Promise((resolve, reject) => {
      this.pendingQueue.push({ bbl, force, organizationId, resolve, reject });

      this.logger.log(
        `Enqueued BBL ${bbl} for batched skip trace (${this.pendingQueue.length} pending)`,
      );

      // Reset the flush timer on each new request (debounce)
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(
        () => this.flushQueue(),
        this.FLUSH_DELAY_MS,
      );
    });
  }

  /** Flush all pending single-BBL requests, grouped by org */
  private async flushQueue(): Promise<void> {
    this.flushTimer = null;
    const items = this.pendingQueue.splice(0);
    if (items.length === 0) return;

    // Group items by organizationId so each org gets its own batch
    const byOrg = new Map<string, QueuedRequest[]>();
    for (const item of items) {
      const existing = byOrg.get(item.organizationId) ?? [];
      existing.push(item);
      byOrg.set(item.organizationId, existing);
    }

    for (const [organizationId, orgItems] of byOrg) {
      const bbls = orgItems.map((i) => i.bbl);
      const force = orgItems.some((i) => i.force);

      this.logger.log(
        `Flushing ${orgItems.length} queued skip trace requests for org ${organizationId}: [${bbls.join(', ')}]`,
      );

      try {
        const result = await this.submitBatch(bbls, organizationId, force);
        // Only poll if there are actual API-queued items
        if (result.queued.length > 0 && result.queueId !== 'cache') {
          this.pollAndStore(result.queueId, result.queued);
        }
        for (const item of orgItems) {
          item.resolve(result);
        }
      } catch (err) {
        for (const item of orgItems) {
          item.reject(err as Error);
        }
      }
    }
  }

  async submitBatch(
    bbls: string[],
    organizationId: string,
    force = false,
  ): Promise<{ queueId: string; queued: string[]; skipped: number }> {
    this.logger.log(
      `submitBatch called: ${bbls.length} BBLs [${bbls.join(', ')}], org=${organizationId}, force=${force}`,
    );

    if (!this.apiKey) {
      throw new Error('TRACERFY_API_KEY is not configured');
    }

    // Load parcels from DB
    const parcels = await this.prisma.parcel.findMany({
      where: { bbl: { in: bbls } },
      select: {
        id: true,
        bbl: true,
        ownerName: true,
        address: true,
        zipCode: true,
        borough: true,
        skipTracedAt: true,
        skipTraceStatus: true,
        ownerPhones: true,
        ownerEmails: true,
      },
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Separate parcels into: already have data (cache hit) vs need API call
    const toQueue: typeof parcels = [];
    const cacheHits: typeof parcels = [];
    let skipped = 0;

    for (const parcel of parcels) {
      const alreadyTraced =
        parcel.skipTraceStatus === 'found' &&
        parcel.skipTracedAt !== null &&
        parcel.skipTracedAt > thirtyDaysAgo;

      if (alreadyTraced && !force) {
        cacheHits.push(parcel);
      } else {
        toQueue.push(parcel);
      }
    }

    // Grant org access for cache hits (no API cost, doesn't count against quota)
    if (cacheHits.length > 0) {
      await this.grantOrgAccess(
        cacheHits.map((p) => p.id),
        organizationId,
      );
      skipped = cacheHits.length;
    }

    if (toQueue.length === 0) {
      return { queueId: 'cache', queued: [], skipped };
    }

    // Check per-org monthly quota (only for new traces, not cache hits)
    const orgUsage = await this.getOrgMonthlyUsage(organizationId);
    if (orgUsage + toQueue.length > this.orgMonthlyLimit) {
      const remaining = Math.max(0, this.orgMonthlyLimit - orgUsage);
      throw new Error(
        `Monthly skip trace limit reached. Used: ${orgUsage}/${this.orgMonthlyLimit}. ` +
          `${remaining} traces remaining this month. Requested: ${toQueue.length}.`,
      );
    }

    // Check global usage cap (only for new traces)
    const currentUsage = await this.checkMonthlyUsage();
    if (currentUsage + toQueue.length > this.monthlyCreditCap) {
      const remaining = Math.max(0, this.monthlyCreditCap - currentUsage);
      throw new Error(
        `Monthly credit cap exceeded. Used: ${currentUsage}/${this.monthlyCreditCap}. ` +
          `${remaining} credits remaining. Requested: ${toQueue.length}.`,
      );
    }

    // Mark all as pending before sending to Tracerfy
    await this.prisma.parcel.updateMany({
      where: { bbl: { in: toQueue.map((p) => p.bbl) } },
      data: { skipTraceStatus: 'pending' },
    });

    // Build Tracerfy json_data payload with all required fields
    const jsonData = toQueue.map((parcel) => {
      const nameParts = (parcel.ownerName || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const city = BOROUGH_NAMES[parcel.borough] || 'New York';
      const state = 'NY';
      const address = parcel.address || '';
      const zip = parcel.zipCode || '';

      return {
        first_name: firstName,
        last_name: lastName,
        address,
        city,
        state,
        zip,
        // Mirror property address for mailing (no separate mailing data available)
        mail_address: address,
        mail_city: city,
        mail_state: state,
        mailing_zip: zip,
      };
    });

    // Submit to Tracerfy using multipart/form-data (required by their API)
    this.logger.log(
      `Submitting ${jsonData.length} records to Tracerfy POST /trace/`,
    );

    const formData = new FormData();
    formData.append('json_data', JSON.stringify(jsonData));
    formData.append('address_column', 'address');
    formData.append('city_column', 'city');
    formData.append('state_column', 'state');
    formData.append('zip_column', 'zip');
    formData.append('first_name_column', 'first_name');
    formData.append('last_name_column', 'last_name');
    formData.append('mail_address_column', 'mail_address');
    formData.append('mail_city_column', 'mail_city');
    formData.append('mail_state_column', 'mail_state');
    formData.append('mailing_zip_column', 'mailing_zip');
    formData.append('trace_type', 'normal');

    const response = await fetch(`${this.baseUrl}/trace/`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      // Do NOT set Content-Type — fetch sets multipart boundary automatically
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      this.logger.error(
        `Tracerfy POST /trace/ failed: status=${response.status}, body=${text}`,
      );
      // Unmark pending since we failed to submit
      await this.prisma.parcel.updateMany({
        where: { bbl: { in: toQueue.map((p) => p.bbl) } },
        data: { skipTraceStatus: null },
      });
      throw new Error(`Tracerfy API error ${response.status}: ${text}`);
    }

    const data = (await response.json()) as { queue_id: string | number };
    const queueId = String(data.queue_id);

    // API call succeeded — now grant org access and store queue_id
    await this.grantOrgAccess(
      toQueue.map((p) => p.id),
      organizationId,
    );

    await this.prisma.parcel.updateMany({
      where: { bbl: { in: toQueue.map((p) => p.bbl) } },
      data: { skipTraceQueueId: queueId },
    });

    this.logger.log(
      `Submitted skip trace batch: ${toQueue.length} records, queue_id=${queueId}, skipped=${skipped}`,
    );

    return { queueId, queued: toQueue.map((p) => p.bbl), skipped };
  }

  /**
   * Fire-and-forget polling loop. Polls GET /queue/:id directly and checks
   * pending:false to detect completion (per Tracerfy API docs).
   * Polls every 15s up to 20 attempts (~5 min).
   */
  pollAndStore(queueId: string, bbls: string[]): void {
    const maxAttempts = 20;
    const intervalMs = 15_000;

    const poll = async (attempt: number): Promise<void> => {
      try {
        const response = await fetch(`${this.baseUrl}/queue/${queueId}`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
        });

        if (!response.ok) {
          this.logger.warn(
            `GET /queue/${queueId} failed: ${response.status} ${response.statusText} (attempt ${attempt}/${maxAttempts})`,
          );
          if (attempt < maxAttempts) {
            setTimeout(() => poll(attempt + 1), intervalMs);
          } else {
            await this.prisma.parcel.updateMany({
              where: { bbl: { in: bbls } },
              data: { skipTraceStatus: 'error', skipTraceQueueId: null },
            });
          }
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw = (await response.json()) as any;

        // Tracerfy returns results array when complete, or { pending: false }
        if (Array.isArray(raw) && raw.length >= 0) {
          await this.writeResults(queueId, bbls, raw as TracerfyResultRecord[]);
          return;
        }

        const data = raw as TracerfyQueueResponse;
        if (data.pending === false) {
          // Results may be embedded in a field or the object itself
          const results: TracerfyResultRecord[] = Array.isArray(data.results)
            ? (data.results as TracerfyResultRecord[])
            : [];
          await this.writeResults(queueId, bbls, results);
          return;
        }

        this.logger.debug(
          `Queue ${queueId} still pending (attempt ${attempt}/${maxAttempts})`,
        );

        if (attempt < maxAttempts) {
          setTimeout(() => poll(attempt + 1), intervalMs);
        } else {
          this.logger.warn(
            `Queue ${queueId} timed out after ${maxAttempts} attempts`,
          );
          await this.prisma.parcel.updateMany({
            where: { bbl: { in: bbls } },
            data: { skipTraceStatus: 'error', skipTraceQueueId: null },
          });
        }
      } catch (err) {
        this.logger.error(
          `Poll error for queue ${queueId}: ${(err as Error).message}`,
        );
        if (attempt < maxAttempts) {
          setTimeout(() => poll(attempt + 1), intervalMs);
        }
      }
    };

    setTimeout(() => poll(1), intervalMs);
  }

  /**
   * Handle a Tracerfy webhook callback (POST from Tracerfy when a trace completes).
   * The webhook delivers the same payload as GET /queue/:id but pushed to us.
   * Configure the webhook URL in your Tracerfy account settings.
   */
  async handleWebhook(payload: TracerfyQueueResponse): Promise<void> {
    const queueId = String(payload.id ?? payload.queue_id ?? '');
    if (!queueId) {
      this.logger.warn('Tracerfy webhook received with no queue ID');
      return;
    }

    // Find BBLs that were queued under this queueId
    const parcels = await this.prisma.parcel.findMany({
      where: { skipTraceQueueId: queueId },
      select: { bbl: true },
    });

    if (parcels.length === 0) {
      this.logger.warn(
        `Tracerfy webhook for queue ${queueId}: no matching parcels found`,
      );
      return;
    }

    const bbls = parcels.map((p) => p.bbl);
    this.logger.log(
      `Tracerfy webhook received for queue ${queueId}: processing ${bbls.length} parcels`,
    );

    // Webhook delivers either results array directly, or object with results field
    const results: TracerfyResultRecord[] = Array.isArray(payload)
      ? (payload as unknown as TracerfyResultRecord[])
      : Array.isArray(payload.results)
        ? (payload.results as TracerfyResultRecord[])
        : [];
    await this.writeResults(queueId, bbls, results);
  }

  /**
   * Parse flat Tracerfy result records into OwnerPhone[] and string[] emails,
   * then update Parcel records.
   */
  private async writeResults(
    queueId: string,
    bbls: string[],
    results: TracerfyResultRecord[],
  ): Promise<void> {
    const now = new Date();
    const missedBbls: string[] = [];

    for (let i = 0; i < bbls.length; i++) {
      const bbl = bbls[i];
      const result = results[i];

      if (!result) {
        missedBbls.push(bbl);
        continue;
      }

      const phones = this.parsePhones(result);
      const emails = this.parseEmails(result);
      const hasContact = phones.length > 0 || emails.length > 0;

      if (!hasContact) {
        missedBbls.push(bbl);
        continue;
      }

      await this.prisma.parcel.updateMany({
        where: { bbl },
        data: {
          ...(phones.length > 0 && {
            ownerPhones: phones as unknown as object[],
          }),
          ...(emails.length > 0 && { ownerEmails: emails }),
          skipTraceStatus: 'found',
          skipTracedAt: now,
          skipTraceQueueId: null,
        },
      });
    }

    const foundCount = bbls.length - missedBbls.length;
    this.logger.log(
      `Queue ${queueId} Tracerfy: ${foundCount}/${bbls.length} found`,
    );

    // Run misses through Skip Sherpa fallback
    if (missedBbls.length > 0 && this.skipSherpaApiKey) {
      this.logger.log(
        `Running ${missedBbls.length} Tracerfy misses through Skip Sherpa fallback`,
      );
      await this.skipSherpaFallback(missedBbls);
    } else if (missedBbls.length > 0) {
      // No Skip Sherpa key — mark misses as not_found
      await this.prisma.parcel.updateMany({
        where: { bbl: { in: missedBbls } },
        data: {
          skipTraceStatus: 'not_found',
          skipTracedAt: now,
          skipTraceQueueId: null,
        },
      });
    }
  }

  /**
   * Extract phones from flat Tracerfy result fields into OwnerPhone[].
   * Deduplicates by phone number (primary_phone may duplicate a mobile/landline).
   */
  private parsePhones(result: TracerfyResultRecord): OwnerPhone[] {
    const seen = new Set<string>();
    const phones: OwnerPhone[] = [];

    const addPhone = (raw: string | undefined, type: string, rank: number) => {
      if (!raw || !raw.trim()) return;
      const number = raw.trim();
      if (seen.has(number)) return;
      seen.add(number);
      phones.push({ number, type, rank, source: 'tracerfy' });
    };

    // Primary phone gets rank 1
    addPhone(result.primary_phone, 'primary', 1);

    // Mobile phones
    for (let n = 1; n <= 5; n++) {
      addPhone(result[`mobile_${n}`], 'mobile', phones.length + 1);
    }

    // Landline phones
    for (let n = 1; n <= 3; n++) {
      addPhone(result[`landline_${n}`], 'landline', phones.length + 1);
    }

    return phones;
  }

  /** Extract emails from flat Tracerfy result fields. */
  private parseEmails(result: TracerfyResultRecord): string[] {
    const emails: string[] = [];
    for (let n = 1; n <= 5; n++) {
      const email = result[`email_${n}`]?.trim();
      if (email) emails.push(email);
    }
    return emails;
  }

  /**
   * Skip Sherpa fallback: look up parcels that Tracerfy missed.
   * Processes in batches of 25 (Skip Sherpa's max per request).
   */
  private async skipSherpaFallback(bbls: string[]): Promise<void> {
    const parcels = await this.prisma.parcel.findMany({
      where: { bbl: { in: bbls } },
      select: {
        bbl: true,
        address: true,
        zipCode: true,
        borough: true,
        ownerName: true,
      },
    });

    // Process in chunks of 25
    for (let i = 0; i < parcels.length; i += 25) {
      const chunk = parcels.slice(i, i + 25);
      await this.skipSherpaLookupBatch(chunk);
    }
  }

  private async skipSherpaLookupBatch(
    parcels: Array<{
      bbl: string;
      address: string | null;
      zipCode: string | null;
      borough: string;
      ownerName: string | null;
    }>,
  ): Promise<void> {
    const now = new Date();

    const lookups: SkipSherpaLookup[] = parcels.map((p) => ({
      property_address_lookup: {
        street: p.address || '',
        city: BOROUGH_NAMES[p.borough] || 'New York',
        state: 'NY',
        zip: p.zipCode || undefined,
      },
      owner_entity_lookup: p.ownerName ? { name: p.ownerName } : null,
    }));

    try {
      const response = await fetch(`${this.skipSherpaBaseUrl}/properties`, {
        method: 'PUT',
        headers: {
          'API-Key': this.skipSherpaApiKey!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ property_lookups: lookups }),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => response.statusText);
        this.logger.error(
          `Skip Sherpa fallback failed: ${response.status} ${text}`,
        );
        // Mark all as not_found
        await this.prisma.parcel.updateMany({
          where: { bbl: { in: parcels.map((p) => p.bbl) } },
          data: {
            skipTraceStatus: 'not_found',
            skipTracedAt: now,
            skipTraceQueueId: null,
          },
        });
        return;
      }

      const data = (await response.json()) as {
        property_results: SkipSherpaPropertyResult[];
      };
      const results = data.property_results || [];

      let fallbackFound = 0;
      for (let i = 0; i < parcels.length; i++) {
        const parcel = parcels[i];
        const result = results[i];

        if (!result || result.status_code !== 200 || !result.property) {
          await this.prisma.parcel.updateMany({
            where: { bbl: parcel.bbl },
            data: {
              skipTraceStatus: 'not_found',
              skipTracedAt: now,
              skipTraceQueueId: null,
            },
          });
          continue;
        }

        const { phones, emails } = this.parseSkipSherpaOwners(
          result.property.owners || [],
        );
        const hasContact = phones.length > 0 || emails.length > 0;

        await this.prisma.parcel.updateMany({
          where: { bbl: parcel.bbl },
          data: {
            ...(phones.length > 0 && {
              ownerPhones: phones as unknown as object[],
            }),
            ...(emails.length > 0 && { ownerEmails: emails }),
            skipTraceStatus: hasContact ? 'found' : 'not_found',
            skipTracedAt: now,
            skipTraceQueueId: null,
          },
        });

        if (hasContact) fallbackFound++;
      }

      this.logger.log(
        `Skip Sherpa fallback: ${fallbackFound}/${parcels.length} found`,
      );
    } catch (err) {
      this.logger.error(
        `Skip Sherpa fallback error: ${(err as Error).message}`,
      );
      await this.prisma.parcel.updateMany({
        where: { bbl: { in: parcels.map((p) => p.bbl) } },
        data: {
          skipTraceStatus: 'not_found',
          skipTracedAt: now,
          skipTraceQueueId: null,
        },
      });
    }
  }

  /** Parse Skip Sherpa owners into OwnerPhone[] and emails */
  private parseSkipSherpaOwners(
    owners: Array<{
      person?: SkipSherpaPerson | null;
      business?: SkipSherpaPerson | null;
    }>,
  ): { phones: OwnerPhone[]; emails: string[] } {
    const seen = new Set<string>();
    const phones: OwnerPhone[] = [];
    const emails: string[] = [];

    for (const owner of owners) {
      // Process both person and business entities (not just one)
      const entities = [owner.person, owner.business].filter(
        Boolean,
      ) as SkipSherpaPerson[];

      for (const entity of entities) {
        // Phones
        for (const ph of entity.phone_numbers || []) {
          const number = ph.local_format || ph.e164_format || '';
          if (!number || seen.has(number)) continue;
          seen.add(number);

          const isDnc = ph.dnc_statuses?.[0]?.is_dnc ?? undefined;

          phones.push({
            number,
            type: ph.type || 'unknown',
            rank: phones.length + 1,
            source: 'skipsherpa',
            isDnc,
          });
        }

        // Emails
        for (const em of entity.emails || []) {
          if (em.email_address && !emails.includes(em.email_address)) {
            emails.push(em.email_address);
          }
        }
      }
    }

    return { phones, emails };
  }

  async checkMonthlyUsage(): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return this.prisma.parcel.count({
      where: {
        skipTracedAt: { gte: startOfMonth },
        skipTraceStatus: { not: 'pending' },
      },
    });
  }

  /** Count how many skip traces an org has used this month */
  async getOrgMonthlyUsage(organizationId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return this.prisma.orgSkipTrace.count({
      where: {
        organizationId,
        tracedAt: { gte: startOfMonth },
      },
    });
  }

  /** Get org skip trace usage info for frontend display */
  async getOrgUsageInfo(organizationId: string): Promise<{
    used: number;
    limit: number;
    remaining: number;
  }> {
    const used = await this.getOrgMonthlyUsage(organizationId);
    return {
      used,
      limit: this.orgMonthlyLimit,
      remaining: Math.max(0, this.orgMonthlyLimit - used),
    };
  }

  /** Grant an org access to see a parcel's skip trace data */
  private async grantOrgAccess(
    parcelIds: string[],
    organizationId: string,
  ): Promise<void> {
    // Upsert each — skipOnDuplicates handles re-traces
    const data = parcelIds.map((parcelId) => ({
      id: `${parcelId}_${organizationId}`,
      parcelId,
      organizationId,
    }));

    await this.prisma.orgSkipTrace.createMany({
      data,
      skipDuplicates: true,
    });
  }

  async getCreditBalance(): Promise<number> {
    if (!this.apiKey) return 0;

    const response = await fetch(`${this.baseUrl}/analytics/`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      this.logger.warn(
        `Failed to fetch Tracerfy credit balance: ${response.status}`,
      );
      return 0;
    }

    const data = (await response.json()) as {
      credits?: number;
      balance?: number;
    };
    return data.credits ?? data.balance ?? 0;
  }
}
