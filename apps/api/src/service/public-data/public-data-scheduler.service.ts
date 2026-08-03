import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NycIngestionService } from './nyc-ingestion.service';
import { SkipTraceService } from './skip-trace.service';
import { publicDataConfig } from '../../config/public-data.config';

@Injectable()
export class PublicDataSchedulerService {
  private readonly logger = new Logger(PublicDataSchedulerService.name);
  private readonly config = publicDataConfig();

  constructor(
    private readonly ingestion: NycIngestionService,
    private readonly skipTrace: SkipTraceService,
  ) {}

  @Cron(publicDataConfig().refreshCron)
  async handleScheduledRefresh(): Promise<void> {
    if (!this.config.autoRefreshEnabled) {
      this.logger.debug('Auto-refresh disabled, skipping');
      return;
    }

    if (this.ingestion.isRunning) {
      this.logger.warn('Ingestion already running, skipping scheduled refresh');
      return;
    }

    this.logger.log('Starting scheduled data refresh');
    try {
      await this.ingestion.ingestAll(['1', '3', '4'], 'scheduled');
      this.logger.log('Scheduled data refresh complete');
    } catch (err) {
      this.logger.error(
        `Scheduled data refresh failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async reapStaleSkipTraces(): Promise<void> {
    try {
      await this.skipTrace.reapStalePendingTraces();
    } catch (err) {
      this.logger.error(`Skip trace reaper failed: ${(err as Error).message}`);
    }
  }
}
