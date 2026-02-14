import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MicrosoftGraphService } from '../microsoft/microsoft-graph.service';
import {
  MicrosoftGraphListService,
  GraphMessageSummary,
} from '../microsoft/microsoft-graph-list.service';
import { DealDetectionService } from '../deal/deal-detection.service';
import { EmailProcessorService } from '../email/email-processor.service';
import {
  ScreeningPreferencesService,
  ScreeningPreferences,
} from '../preferences/screening-preferences.service';
import { S3Service } from '../s3/s3.service';
import { IngestionStatus } from '@prisma/client';

/** Real estate keywords for local pre-filtering (case-insensitive) */
const DEAL_KEYWORDS = [
  'om',
  'offering memorandum',
  'just listed',
  'teaser',
  'broker blast',
  'for sale',
  'acquisition',
  'cap rate',
  'noi',
  'offering',
  'property',
  'portfolio',
  'multifamily',
  'industrial',
  'office',
  'retail',
  'hospitality',
  'net lease',
  'triple net',
  'nnn',
];

@Injectable()
export class HistoricalIngestionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(HistoricalIngestionService.name);

  /** Track running jobs to prevent double-starts */
  private readonly runningJobs = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly graphService: MicrosoftGraphService,
    private readonly graphListService: MicrosoftGraphListService,
    private readonly dealDetectionService: DealDetectionService,
    private readonly emailProcessorService: EmailProcessorService,
    private readonly screeningPreferencesService: ScreeningPreferencesService,
    private readonly s3Service: S3Service,
  ) {}

  /**
   * On startup, mark any stale RUNNING ingestions as PAUSED.
   * Handles Railway container restarts during a running job.
   */
  async onApplicationBootstrap(): Promise<void> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const stale = await this.prisma.historicalIngestion.updateMany({
      where: {
        status: IngestionStatus.RUNNING,
        startedAt: { lt: tenMinutesAgo },
      },
      data: {
        status: IngestionStatus.PAUSED,
        lastError: 'Paused: application restarted while job was running',
      },
    });

    if (stale.count > 0) {
      this.logger.warn(`Marked ${stale.count} stale ingestion(s) as PAUSED on startup`);
    }
  }

  /**
   * Start a new ingestion job. Returns the job record immediately.
   * The actual processing runs in the background.
   */
  async startIngestion(params: {
    organizationId: string;
    triggeredByUserId: string;
    startDate?: Date;
    endDate?: Date;
    folderName?: string;
  }): Promise<{ id: string; status: IngestionStatus }> {
    // Concurrency guard: one job per org
    const existing = await this.prisma.historicalIngestion.findFirst({
      where: {
        organizationId: params.organizationId,
        status: { in: [IngestionStatus.PENDING, IngestionStatus.RUNNING] },
      },
    });

    if (existing) {
      throw new Error(
        `An ingestion job is already ${existing.status.toLowerCase()} for this organization (id: ${existing.id})`,
      );
    }

    // Default startDate to 12 months ago
    const startDate =
      params.startDate || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

    const job = await this.prisma.historicalIngestion.create({
      data: {
        organizationId: params.organizationId,
        triggeredByUserId: params.triggeredByUserId,
        startDate,
        endDate: params.endDate || undefined,
        folderName: params.folderName || 'Inbox',
        status: IngestionStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    // Fire and forget
    this.runIngestion(job.id).catch((err) => {
      this.logger.error(`Ingestion ${job.id} failed unexpectedly: ${err.message}`);
    });

    return { id: job.id, status: job.status };
  }

  /**
   * Resume a paused or failed ingestion.
   */
  async resumeIngestion(ingestionId: string): Promise<{ id: string; status: IngestionStatus }> {
    const job = await this.prisma.historicalIngestion.findUnique({
      where: { id: ingestionId },
    });

    if (!job) {
      throw new Error('Ingestion job not found');
    }

    if (job.status !== IngestionStatus.PAUSED && job.status !== IngestionStatus.FAILED) {
      throw new Error(`Cannot resume ingestion with status: ${job.status}`);
    }

    await this.prisma.historicalIngestion.update({
      where: { id: ingestionId },
      data: { status: IngestionStatus.RUNNING, lastError: null },
    });

    this.runIngestion(ingestionId).catch((err) => {
      this.logger.error(`Ingestion ${ingestionId} resume failed: ${err.message}`);
    });

    return { id: ingestionId, status: IngestionStatus.RUNNING };
  }

  /**
   * Pause a running ingestion.
   */
  async pauseIngestion(ingestionId: string): Promise<void> {
    const job = await this.prisma.historicalIngestion.findUnique({
      where: { id: ingestionId },
    });

    if (!job || job.status !== IngestionStatus.RUNNING) {
      throw new Error('Can only pause a running ingestion');
    }

    // The running loop checks for PAUSED status and will stop
    await this.prisma.historicalIngestion.update({
      where: { id: ingestionId },
      data: { status: IngestionStatus.PAUSED },
    });
  }

  /**
   * Main processing loop. Runs in the background.
   */
  async runIngestion(ingestionId: string): Promise<void> {
    if (this.runningJobs.has(ingestionId)) {
      this.logger.warn(`Ingestion ${ingestionId} is already running in this process`);
      return;
    }

    this.runningJobs.add(ingestionId);

    try {
      const job = await this.prisma.historicalIngestion.findUnique({
        where: { id: ingestionId },
      });

      if (!job) {
        this.logger.error(`Ingestion ${ingestionId} not found`);
        return;
      }

      // Find a user in this org with a Microsoft subscription
      const user = await this.findUserWithMicrosoft(job.organizationId);
      if (!user) {
        await this.failJob(ingestionId, 'No user with Microsoft connection found in organization');
        return;
      }

      // Get initial access token
      let accessToken = await this.graphService.getMicrosoftOAuthTokenFromClerk(user.id);
      if (!accessToken) {
        await this.failJob(ingestionId, 'Failed to get Microsoft OAuth token');
        return;
      }

      // Load screening preferences
      const prefs = await this.screeningPreferencesService.getPreferences(job.organizationId);

      let nextLink = job.nextLink || undefined;
      let messagesProcessedSinceTokenRefresh = 0;
      let pagesProcessed = 0;

      this.logger.log(
        `Starting ingestion ${ingestionId}: folder=${job.folderName}, startDate=${job.startDate?.toISOString()}, endDate=${job.endDate?.toISOString()}${nextLink ? ' (resuming)' : ''}`,
      );

      // Page loop
      while (true) {
        // Check if job was paused
        const currentStatus = await this.getJobStatus(ingestionId);
        if (currentStatus !== IngestionStatus.RUNNING) {
          this.logger.log(`Ingestion ${ingestionId} is no longer RUNNING (status: ${currentStatus}), stopping`);
          break;
        }

        // Fetch page of messages
        const result = await this.graphListService.listMessages(accessToken, {
          folderId: job.folderName,
          startDate: job.startDate || undefined,
          endDate: job.endDate || undefined,
          nextLink: nextLink,
        });

        if (result.messages.length === 0 && !result.nextLink) {
          // No more messages
          break;
        }

        // Process each message in the page
        for (const message of result.messages) {
          // Check pause status every message
          const status = await this.getJobStatus(ingestionId);
          if (status !== IngestionStatus.RUNNING) {
            break;
          }

          try {
            const outcome = await this.processMessage(
              message,
              accessToken,
              user,
              job.organizationId,
              prefs,
            );

            // Update counters
            await this.incrementCounters(ingestionId, outcome);
            messagesProcessedSinceTokenRefresh++;
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.error(`Error processing message ${message.id}: ${msg}`);
            await this.incrementCounters(ingestionId, 'error');
          }
        }

        // Save pagination cursor
        nextLink = result.nextLink || undefined;
        await this.prisma.historicalIngestion.update({
          where: { id: ingestionId },
          data: {
            nextLink: nextLink || null,
            lastProcessedMessageId:
              result.messages[result.messages.length - 1]?.id || undefined,
          },
        });

        if (!nextLink) {
          // No more pages
          break;
        }

        // Refresh token every 100 messages
        if (messagesProcessedSinceTokenRefresh >= 100) {
          const newToken = await this.graphService.getMicrosoftOAuthTokenFromClerk(user.id);
          if (newToken) {
            accessToken = newToken;
            messagesProcessedSinceTokenRefresh = 0;
          } else {
            this.logger.warn('Failed to refresh token, continuing with existing one');
          }
        }

        // Longer pause every 10 pages to avoid sustained load
        pagesProcessed++;
        if (pagesProcessed % 10 === 0) {
          await this.sleep(2000);
        }
      }

      // Check final status - if still RUNNING, mark as completed
      const finalStatus = await this.getJobStatus(ingestionId);
      if (finalStatus === IngestionStatus.RUNNING) {
        await this.prisma.historicalIngestion.update({
          where: { id: ingestionId },
          data: {
            status: IngestionStatus.COMPLETED,
            completedAt: new Date(),
            nextLink: null,
          },
        });
        this.logger.log(`Ingestion ${ingestionId} completed`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Ingestion ${ingestionId} failed: ${msg}`);
      await this.failJob(ingestionId, msg);
    } finally {
      this.runningJobs.delete(ingestionId);
    }
  }

  /**
   * Process a single message through the pipeline.
   * Returns 'processed', 'skipped', or 'error'.
   */
  private async processMessage(
    message: GraphMessageSummary,
    accessToken: string,
    user: { id: string; email: string },
    organizationId: string,
    prefs: ScreeningPreferences,
  ): Promise<'detected' | 'processed' | 'skipped' | 'error'> {
    // 1. Dedup: check if this message was already processed
    const existing = await this.prisma.deal.findUnique({
      where: { sourceMessageId: message.id },
      select: { id: true },
    });
    if (existing) {
      return 'skipped';
    }

    // 2. Local keyword pre-filter on subject
    if (!this.passesKeywordFilter(message.subject, message.hasAttachments)) {
      return 'skipped';
    }

    // 3. AI deal detection
    const detection = await this.dealDetectionService.isDealEmail(
      message.subject,
      message.bodyPreview || '',
      message.hasAttachments,
      user.id,
      organizationId,
    );

    if (!detection.isDeal) {
      return 'skipped';
    }

    // 4. It's a deal — fetch full message and process
    const emailEvent = await this.graphService.toNormalizedEvent(
      user.id,
      accessToken,
      message.id,
    );

    if (!emailEvent) {
      this.logger.warn(`Failed to fetch full message ${message.id}`);
      return 'error';
    }

    // 5. Generate dealId and upload attachments to S3
    const dealId = this.generateDealId();

    if (emailEvent.attachments.length > 0) {
      await this.uploadAttachmentsToS3(emailEvent, accessToken, dealId);
    }

    // 6. Process through existing pipeline with historical=true
    const result = await this.emailProcessorService.process({
      event: emailEvent,
      accessToken,
      inboxOwnerEmail: user.email,
      receivedByUserId: user.id,
      organizationId,
      dealId,
      detection,
      historical: true,
    });

    if (!result.processed) {
      return 'error';
    }

    // 7. Mark InitialScreening as already digested (exclude from digest emails)
    if (result.dealId) {
      await this.prisma.initialScreening.updateMany({
        where: { dealId: result.dealId },
        data: { digestSent: true, digestSentAt: new Date() },
      });
    }

    return 'processed';
  }

  /**
   * Check if subject contains any real estate keywords.
   * If no keywords match, only pass emails with attachments (likely OMs/PDFs).
   */
  private passesKeywordFilter(subject: string, hasAttachments: boolean): boolean {
    const lower = subject.toLowerCase();

    for (const keyword of DEAL_KEYWORDS) {
      if (lower.includes(keyword)) {
        return true;
      }
    }

    // No keyword match — still pass if it has attachments (could be an OM with generic subject)
    return hasAttachments;
  }

  private async findUserWithMicrosoft(
    organizationId: string,
  ): Promise<{ id: string; email: string } | null> {
    // Find user with an active Microsoft subscription
    const user = await this.prisma.user.findFirst({
      where: {
        organizationId,
        microsoftSubscription: { isNot: null },
      },
      select: { id: true, email: true },
    });

    return user || null;
  }

  private async getJobStatus(ingestionId: string): Promise<IngestionStatus> {
    const job = await this.prisma.historicalIngestion.findUnique({
      where: { id: ingestionId },
      select: { status: true },
    });
    return job?.status || IngestionStatus.FAILED;
  }

  private async incrementCounters(
    ingestionId: string,
    outcome: 'detected' | 'processed' | 'skipped' | 'error',
  ): Promise<void> {
    const data: Record<string, { increment: number }> = {
      scannedCount: { increment: 1 },
    };

    if (outcome === 'detected') {
      data.detectedCount = { increment: 1 };
    } else if (outcome === 'processed') {
      data.detectedCount = { increment: 1 };
      data.processedCount = { increment: 1 };
    } else if (outcome === 'skipped') {
      data.skippedCount = { increment: 1 };
    } else if (outcome === 'error') {
      data.errorCount = { increment: 1 };
    }

    await this.prisma.historicalIngestion.update({
      where: { id: ingestionId },
      data,
    });
  }

  private async failJob(ingestionId: string, error: string): Promise<void> {
    await this.prisma.historicalIngestion.update({
      where: { id: ingestionId },
      data: {
        status: IngestionStatus.FAILED,
        lastError: error,
      },
    });
  }

  private generateDealId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `deal_${timestamp}_${random}`;
  }

  /**
   * Download attachments from Microsoft Graph and upload to S3.
   * Mutates emailEvent.attachments to add s3Key.
   */
  private async uploadAttachmentsToS3(
    emailEvent: {
      messageId: string;
      attachments: Array<{
        contentId: string;
        filename: string;
        s3Key?: string;
      }>;
    },
    accessToken: string,
    dealId: string,
  ): Promise<void> {
    for (const att of emailEvent.attachments) {
      try {
        const content = await this.graphService.getAttachmentContent(
          accessToken,
          emailEvent.messageId,
          att.contentId,
        );

        if (!content) {
          this.logger.warn(`Failed to download attachment ${att.filename}, skipping S3 upload`);
          continue;
        }

        const s3Key = await this.s3Service.uploadDealAttachment(
          content,
          att.filename,
          dealId,
        );
        att.s3Key = s3Key;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to upload attachment ${att.filename} to S3: ${msg}`);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
