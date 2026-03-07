import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface TracerfyPhone {
  number: string;
  type: string;
  rank: number;
}

interface TracerfyResult {
  first_name?: string;
  last_name?: string;
  phones?: { phone_number: string; phone_type?: string; rank?: number }[];
  emails?: string[];
}

interface TracerfyQueueResponse {
  status: 'pending' | 'complete' | 'failed';
  results?: TracerfyResult[];
}

@Injectable()
export class SkipTraceService {
  private readonly logger = new Logger(SkipTraceService.name);
  private readonly apiKey = process.env.TRACERFY_API_KEY;
  private readonly baseUrl = 'https://tracerfy.com/v1/api';
  private readonly monthlyCreditCap = parseInt(
    process.env.TRACERFY_MONTHLY_CREDIT_CAP ?? '500',
  );

  constructor(private readonly prisma: PrismaService) {}

  async submitBatch(
    bbls: string[],
    force = false,
  ): Promise<{ queueId: string; queued: string[]; skipped: number }> {
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

    // Build Tracerfy payload
    const payload = toQueue.map((parcel) => {
      const nameParts = (parcel.ownerName || '').trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return {
        first_name: firstName,
        last_name: lastName,
        address: parcel.address || '',
        zip: parcel.zipCode || '',
      };
    });

    // Submit to Tracerfy
    const response = await fetch(`${this.baseUrl}/trace/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ records: payload, trace_type: 'normal' }),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
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
   * Fire-and-forget polling loop. Polls Tracerfy every 15s up to 20 attempts (~5 min).
   * Updates Parcel records with contact data when complete.
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
            `Poll attempt ${attempt}/${maxAttempts} failed: ${response.status}`,
          );
        } else {
          const data = (await response.json()) as TracerfyQueueResponse;

          if (data.status === 'complete' && data.results) {
            await this.writeResults(queueId, bbls, data.results);
            return;
          }

          if (data.status === 'failed') {
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
        }

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

  private async writeResults(
    queueId: string,
    bbls: string[],
    results: TracerfyResult[],
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

      const phones: TracerfyPhone[] = (result.phones || []).map((p, idx) => ({
        number: p.phone_number,
        type: p.phone_type || 'unknown',
        rank: p.rank ?? idx + 1,
      }));

      const emails: string[] = result.emails || [];
      const hasContact = phones.length > 0 || emails.length > 0;

      await this.prisma.parcel.updateMany({
        where: { bbl },
        data: {
          // Cast to Prisma's InputJsonValue — phones/emails are plain JSON-serializable objects
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

    const foundCount = results.filter(
      (r) => (r?.phones?.length ?? 0) > 0 || (r?.emails?.length ?? 0) > 0,
    ).length;

    this.logger.log(
      `Queue ${queueId} complete: ${foundCount}/${bbls.length} records with contact data`,
    );
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
