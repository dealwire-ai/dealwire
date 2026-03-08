import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BOROUGH_NAMES } from './nyc-utils';

interface OwnerPhone {
  number: string;
  type: string;
  rank: number;
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

/** An item from the GET /queues/ list endpoint */
interface TracerfyQueueItem {
  id: number | string;
  status: string;
  [key: string]: unknown;
}

/** Pending item in the single-BBL queue */
interface QueuedRequest {
  bbl: string;
  force: boolean;
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
    force = false,
  ): Promise<{ queueId: string; queued: string[]; skipped: number }> {
    return new Promise((resolve, reject) => {
      this.pendingQueue.push({ bbl, force, resolve, reject });

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

  /** Flush all pending single-BBL requests as one submitBatch call */
  private async flushQueue(): Promise<void> {
    this.flushTimer = null;
    const items = this.pendingQueue.splice(0);
    if (items.length === 0) return;

    const bbls = items.map((i) => i.bbl);
    const force = items.some((i) => i.force);

    this.logger.log(
      `Flushing ${items.length} queued skip trace requests as one batch: [${bbls.join(', ')}]`,
    );

    try {
      const result = await this.submitBatch(bbls, force);
      // Start polling for results
      this.pollAndStore(result.queueId, result.queued);
      // Resolve all waiting callers with the shared result
      for (const item of items) {
        item.resolve(result);
      }
    } catch (err) {
      for (const item of items) {
        item.reject(err as Error);
      }
    }
  }

  async submitBatch(
    bbls: string[],
    force = false,
  ): Promise<{ queueId: string; queued: string[]; skipped: number }> {
    this.logger.log(
      `submitBatch called: ${bbls.length} BBLs [${bbls.join(', ')}], force=${force}`,
    );

    if (!this.apiKey) {
      throw new Error('TRACERFY_API_KEY is not configured');
    }

    // Check monthly usage cap
    const currentUsage = await this.checkMonthlyUsage();
    if (currentUsage + bbls.length > this.monthlyCreditCap) {
      const remaining = Math.max(0, this.monthlyCreditCap - currentUsage);
      throw new Error(
        `Monthly credit cap exceeded. Used: ${currentUsage}/${this.monthlyCreditCap}. ` +
          `${remaining} credits remaining. Requested: ${bbls.length}.`,
      );
    }

    // Load parcels from DB
    const parcels = await this.prisma.parcel.findMany({
      where: { bbl: { in: bbls } },
      select: {
        bbl: true,
        ownerName: true,
        address: true,
        zipCode: true,
        borough: true,
        city: true,
        state: true,
        skipTracedAt: true,
        skipTraceStatus: true,
      },
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Determine which BBLs to skip (already traced within 30 days with 'found')
    const toQueue: typeof parcels = [];
    let skipped = 0;

    for (const parcel of parcels) {
      const alreadyTraced =
        parcel.skipTraceStatus === 'found' &&
        parcel.skipTracedAt !== null &&
        parcel.skipTracedAt > thirtyDaysAgo;

      if (alreadyTraced && !force) {
        skipped++;
      } else {
        toQueue.push(parcel);
      }
    }

    if (toQueue.length === 0) {
      throw new Error(
        `All ${skipped} parcels were already traced recently. Use force=true to re-trace.`,
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
      const city = parcel.city || BOROUGH_NAMES[parcel.borough] || '';
      const state = parcel.state || 'NY';
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

    const data = (await response.json()) as { queue_id: string };
    const queueId = data.queue_id;

    // Store queue_id on each parcel so we can correlate results
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
   * Check queue status via GET /queues/ list endpoint.
   * Returns 'complete', 'pending', or 'failed'.
   */
  private async isQueueComplete(
    queueId: string,
  ): Promise<'complete' | 'pending' | 'failed'> {
    const response = await fetch(`${this.baseUrl}/queues/`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
    });

    if (!response.ok) {
      this.logger.warn(
        `GET /queues/ failed: ${response.status} ${response.statusText}`,
      );
      return 'pending'; // Treat as pending on fetch failure
    }

    const queues = (await response.json()) as TracerfyQueueItem[];
    const queue = queues.find((q) => String(q.id) === String(queueId));

    if (!queue) {
      this.logger.warn(`Queue ${queueId} not found in /queues/ list`);
      return 'pending';
    }

    const status = (queue.status || '').toLowerCase();
    if (status === 'complete' || status === 'completed') return 'complete';
    if (status === 'failed' || status === 'error') return 'failed';
    return 'pending';
  }

  /**
   * Fire-and-forget polling loop. Checks queue status via /queues/,
   * then fetches results from /queue/:id when complete.
   * Polls every 15s up to 20 attempts (~5 min).
   */
  pollAndStore(queueId: string, bbls: string[]): void {
    const maxAttempts = 20;
    const intervalMs = 15_000;

    const poll = async (attempt: number): Promise<void> => {
      try {
        const status = await this.isQueueComplete(queueId);

        if (status === 'complete') {
          // Fetch actual results from GET /queue/:id
          const response = await fetch(`${this.baseUrl}/queue/${queueId}`, {
            headers: { Authorization: `Bearer ${this.apiKey}` },
          });

          if (!response.ok) {
            this.logger.error(
              `GET /queue/${queueId} failed: ${response.status}`,
            );
            await this.prisma.parcel.updateMany({
              where: { bbl: { in: bbls } },
              data: { skipTraceStatus: 'error', skipTraceQueueId: null },
            });
            return;
          }

          const results = (await response.json()) as TracerfyResultRecord[];
          await this.writeResults(queueId, bbls, results);
          return;
        }

        if (status === 'failed') {
          this.logger.error(`Tracerfy queue ${queueId} failed`);
          await this.prisma.parcel.updateMany({
            where: { bbl: { in: bbls } },
            data: { skipTraceStatus: 'error', skipTraceQueueId: null },
          });
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
   * Parse flat Tracerfy result records into OwnerPhone[] and string[] emails,
   * then update Parcel records.
   */
  private async writeResults(
    queueId: string,
    bbls: string[],
    results: TracerfyResultRecord[],
  ): Promise<void> {
    const now = new Date();

    for (let i = 0; i < bbls.length; i++) {
      const bbl = bbls[i];
      const result = results[i];

      if (!result) {
        await this.prisma.parcel.updateMany({
          where: { bbl },
          data: {
            skipTraceStatus: 'not_found',
            skipTracedAt: now,
            skipTraceQueueId: null,
          },
        });
        continue;
      }

      const phones = this.parsePhones(result);
      const emails = this.parseEmails(result);
      const hasContact = phones.length > 0 || emails.length > 0;

      await this.prisma.parcel.updateMany({
        where: { bbl },
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
    }

    const foundCount = bbls.filter((_, i) => {
      const r = results[i];
      if (!r) return false;
      return this.parsePhones(r).length > 0 || this.parseEmails(r).length > 0;
    }).length;

    this.logger.log(
      `Queue ${queueId} complete: ${foundCount}/${bbls.length} records with contact data`,
    );
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
      phones.push({ number, type, rank });
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
