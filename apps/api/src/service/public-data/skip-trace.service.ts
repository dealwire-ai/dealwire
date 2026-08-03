import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BOROUGH_NAMES } from './nyc-utils';

/** Hard timeout for outbound Skip Sherpa requests so a slow provider can't hang a trace. */
const SKIP_SHERPA_TIMEOUT_MS = 30_000;

/**
 * How long a parcel may sit in 'pending' before the reaper flips it to
 * 'error'. Worst-case legitimate in-flight time is ~90s (chunked lookups at
 * 30s each), so 10 minutes has wide margin.
 */
const STALE_PENDING_MS = 10 * 60_000;

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

@Injectable()
export class SkipTraceService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SkipTraceService.name);

  /** Global monthly skip trace cap across all orgs (1 credit = one trace) */
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

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The Skip Sherpa lookup runs as an in-process promise after rows are
   * marked 'pending', so a restart mid-lookup strands them. Sweep on boot;
   * PublicDataSchedulerService repeats the sweep on a cron.
   */
  async onApplicationBootstrap(): Promise<void> {
    try {
      await this.reapStalePendingTraces();
    } catch (err) {
      // Never block boot — e.g. migrations may not have run yet
      this.logger.warn(
        `Skip trace startup sweep skipped: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Flip 'pending' rows older than STALE_PENDING_MS to 'error' so the UI
   * stops showing "Queued" and offers Retry. Rows with no queuedAt timestamp
   * predate the column and can only be strays — reap those too.
   */
  async reapStalePendingTraces(): Promise<number> {
    const cutoff = new Date(Date.now() - STALE_PENDING_MS);
    const { count } = await this.prisma.parcel.updateMany({
      where: {
        skipTraceStatus: 'pending',
        OR: [
          { skipTraceQueuedAt: { lt: cutoff } },
          { skipTraceQueuedAt: null },
        ],
      },
      data: {
        skipTraceStatus: 'error',
        skipTraceQueuedAt: null,
      },
    });
    if (count > 0) {
      this.logger.warn(
        `Reaped ${count} stale pending skip trace(s) to 'error'`,
      );
    }
    return count;
  }

  async submitBatch(
    bbls: string[],
    organizationId: string,
    force = false,
  ): Promise<{ queueId: string; queued: string[]; skipped: number }> {
    this.logger.log(
      `submitBatch called: ${bbls.length} BBLs [${bbls.join(', ')}], org=${organizationId}, force=${force}`,
    );

    if (!this.skipSherpaApiKey) {
      throw new Error('SKIPSHERPA_API_KEY is not configured');
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

    // Mark all as pending
    await this.prisma.parcel.updateMany({
      where: { bbl: { in: toQueue.map((p) => p.bbl) } },
      data: { skipTraceStatus: 'pending', skipTraceQueuedAt: new Date() },
    });

    // Grant org access
    await this.grantOrgAccess(
      toQueue.map((p) => p.id),
      organizationId,
    );

    const queuedBbls = toQueue.map((p) => p.bbl);

    this.logger.log(
      `Submitting ${queuedBbls.length} records to Skip Sherpa, skipped=${skipped}`,
    );

    // Fire-and-forget: run Skip Sherpa in the background so the API responds immediately
    this.skipSherpaFallback(queuedBbls).catch((err) => {
      this.logger.error(
        `Skip Sherpa batch failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    });

    return { queueId: 'skipsherpa', queued: queuedBbls, skipped };
  }

  /**
   * Run the Skip Sherpa lookup for a set of queued BBLs.
   * Processes in batches of 25 (Skip Sherpa's max per request).
   */
  private async skipSherpaFallback(bbls: string[]): Promise<void> {
    try {
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
    } catch (err) {
      // The fallback threw before per-chunk handling could write results back
      // (e.g. a DB error loading parcels). Reset any rows still marked pending
      // to 'error' so the frontend stops polling instead of spinning until its
      // 5-minute timeout, and so the user can retry.
      this.logger.error(
        `Skip Sherpa fallback aborted for ${bbls.length} BBLs: ${(err as Error).message}`,
      );
      await this.prisma.parcel.updateMany({
        where: { bbl: { in: bbls }, skipTraceStatus: 'pending' },
        data: {
          skipTraceStatus: 'error',
          skipTraceQueuedAt: null,
        },
      });
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
        signal: AbortSignal.timeout(SKIP_SHERPA_TIMEOUT_MS),
      });

      const text = await response.text();

      // Skip Sherpa returns a non-2xx HTTP status (e.g. 404
      // "contact_info_not_found") even when the body is a valid per-property
      // result payload — that status reflects the lookup outcome, not a
      // request failure. Parse the body regardless of HTTP status and route on
      // each property's own status_code below. Only treat the call as a hard
      // failure when there's no usable property_results array to work from
      // (genuine auth/rate-limit/5xx or an unparseable body).
      let data: { property_results?: SkipSherpaPropertyResult[] } | null = null;
      try {
        data = JSON.parse(text) as {
          property_results?: SkipSherpaPropertyResult[];
        };
      } catch {
        data = null;
      }

      if (!data?.property_results) {
        this.logger.error(
          `Skip Sherpa request failed: ${response.status} ${text.slice(0, 500)}`,
        );
        // Mark as 'error' (not 'not_found') — the lookup never completed, so
        // it stays distinguishable from a genuine miss and remains retryable.
        await this.prisma.parcel.updateMany({
          where: { bbl: { in: parcels.map((p) => p.bbl) } },
          data: {
            skipTraceStatus: 'error',
            skipTraceQueuedAt: null,
          },
        });
        return;
      }

      const results = data.property_results;

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
              skipTraceQueuedAt: null,
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
            skipTraceQueuedAt: null,
          },
        });

        if (hasContact) fallbackFound++;
      }

      this.logger.log(
        `Skip Sherpa fallback: ${fallbackFound}/${parcels.length} found`,
      );
    } catch (err) {
      // Network error or request timeout — the lookup never completed, so mark
      // 'error' (retryable) rather than 'not_found' (a real miss).
      this.logger.error(
        `Skip Sherpa fallback error: ${(err as Error).message}`,
      );
      await this.prisma.parcel.updateMany({
        where: { bbl: { in: parcels.map((p) => p.bbl) } },
        data: { skipTraceStatus: 'error', skipTraceQueuedAt: null },
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

  /**
   * Return the skip trace status for a list of BBLs (used by frontend
   * polling). Parcels the org has no OrgSkipTrace grant for are reported as
   * untraced, matching the visibility rules of the parcel list endpoint.
   */
  async getStatusForBbls(
    bbls: string[],
    organizationId: string,
  ): Promise<
    Record<string, { status: string | null; phones: unknown; emails: unknown }>
  > {
    const parcels = await this.prisma.parcel.findMany({
      where: { bbl: { in: bbls } },
      select: {
        bbl: true,
        skipTraceStatus: true,
        ownerPhones: true,
        ownerEmails: true,
        orgSkipTraces: {
          where: { organizationId },
          select: { id: true },
        },
      },
    });

    const result: Record<
      string,
      { status: string | null; phones: unknown; emails: unknown }
    > = {};
    for (const p of parcels) {
      const visible = p.orgSkipTraces.length > 0;
      result[p.bbl] = {
        status: visible ? p.skipTraceStatus : null,
        phones: visible ? p.ownerPhones : null,
        emails: visible ? p.ownerEmails : null,
      };
    }
    return result;
  }
}
