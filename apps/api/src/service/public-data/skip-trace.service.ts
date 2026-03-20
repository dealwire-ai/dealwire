import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BOROUGH_NAMES } from './nyc-utils';
import {
  SkipTraceProvider,
  SkipTraceInput,
  SkipTraceResult,
  SKIP_TRACE_PROVIDER,
} from './skip-trace-provider.interface';

/** Pending item in the single-BBL debounce queue */
interface QueuedRequest {
  bbl: string;
  force: boolean;
  resolve: (result: { queued: string[]; skipped: number }) => void;
  reject: (err: Error) => void;
}

@Injectable()
export class SkipTraceService {
  private readonly logger = new Logger(SkipTraceService.name);
  private readonly monthlyCreditCap = parseInt(
    process.env.TRACERFY_MONTHLY_CREDIT_CAP ?? '500',
  );

  /** Buffer for single-BBL requests — flushed as one batch after FLUSH_DELAY_MS */
  private pendingQueue: QueuedRequest[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly FLUSH_DELAY_MS = 5_000;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(SKIP_TRACE_PROVIDER)
    private readonly provider: SkipTraceProvider,
  ) {}

  /**
   * Queue a single BBL for skip tracing. Buffers requests for 5 seconds,
   * then flushes all queued BBLs as one batch to avoid rate limits.
   */
  enqueue(
    bbl: string,
    force = false,
  ): Promise<{ queued: string[]; skipped: number }> {
    return new Promise((resolve, reject) => {
      this.pendingQueue.push({ bbl, force, resolve, reject });

      this.logger.log(
        `Enqueued BBL ${bbl} for batched skip trace (${this.pendingQueue.length} pending)`,
      );

      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(() => {
        void this.flushQueue();
      }, this.FLUSH_DELAY_MS);
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
  ): Promise<{ queued: string[]; skipped: number }> {
    this.logger.log(
      `submitBatch called: ${bbls.length} BBLs [${bbls.join(', ')}], force=${force}`,
    );

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
        skipTracedAt: true,
        skipTraceStatus: true,
      },
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

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

    // Mark all as pending
    await this.prisma.parcel.updateMany({
      where: { bbl: { in: toQueue.map((p) => p.bbl) } },
      data: { skipTraceStatus: 'pending' },
    });

    // Build provider inputs
    const inputs: SkipTraceInput[] = toQueue.map((parcel) => {
      const nameParts = (parcel.ownerName || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      return {
        bbl: parcel.bbl,
        firstName,
        lastName,
        address: parcel.address || '',
        city: BOROUGH_NAMES[parcel.borough] || 'New York',
        state: 'NY',
        zip: parcel.zipCode || '',
      };
    });

    let results: SkipTraceResult[];
    try {
      results = await this.provider.trace(inputs);
    } catch (err) {
      // Unmark pending since provider failed
      await this.prisma.parcel.updateMany({
        where: { bbl: { in: toQueue.map((p) => p.bbl) } },
        data: { skipTraceStatus: null },
      });
      throw err;
    }

    // Write results to DB
    await this.writeResults(results);

    this.logger.log(
      `Skip trace complete (${this.provider.name}): ${results.filter((r) => r.found).length}/${results.length} found`,
    );

    return { queued: toQueue.map((p) => p.bbl), skipped };
  }

  async getCreditBalance(): Promise<number | null> {
    if (!this.provider.checkBalance) return null;
    return this.provider.checkBalance();
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

  private async writeResults(results: SkipTraceResult[]): Promise<void> {
    const now = new Date();

    for (const result of results) {
      await this.prisma.parcel.updateMany({
        where: { bbl: result.bbl },
        data: {
          ...(result.phones.length > 0 && {
            ownerPhones: result.phones as unknown as object[],
          }),
          ...(result.emails.length > 0 && { ownerEmails: result.emails }),
          skipTraceStatus: result.found ? 'found' : 'not_found',
          skipTracedAt: now,
          skipTraceQueueId: null,
        },
      });
    }
  }
}
