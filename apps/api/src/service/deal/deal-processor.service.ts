import { Injectable, Logger } from '@nestjs/common';
import { EmailProcessingService } from '../email/email-processing.service';
import { EmailTemplateService } from '../email/email-template.service';
import { MicrosoftGraphService } from '../microsoft/microsoft-graph.service';
import {
  ClientPreferencesService,
  DEFAULT_PASSED_FOLDER,
} from '../preferences/client-preferences.service';
import { DealSummaryService } from '../deal/deal-summary.service';
import { DealDecisionService } from '../deal/deal-decision.service';
import { DealDetectionService } from '../deal/deal-detection.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { MetricsService } from '../metrics/metrics.service';
import { aiConfig } from '../../config/ai.config';
import { NormalizedEmailEvent } from '../../dto/normalized-email-event.dto';

export interface ProcessDealContext {
  event: NormalizedEmailEvent;
  accessToken?: string;
  inboxOwnerEmail: string;
  receivedByUserId?: string;
  organizationId?: string;
}

export interface ProcessDealResult {
  processed: boolean;
  dealId?: string;
  decision?: 'yes' | 'no';
  reason?: string;
  skippedReason?: string;
}

@Injectable()
export class EmailProcessorService {
  private readonly logger = new Logger(EmailProcessorService.name);
  private readonly aiConfig = aiConfig();

  constructor(
    private readonly emailProcessingService: EmailProcessingService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly microsoftGraphService: MicrosoftGraphService,
    private readonly clientPreferencesService: ClientPreferencesService,
    private readonly dealSummaryService: DealSummaryService,
    private readonly dealDecisionService: DealDecisionService,
    private readonly dealDetectionService: DealDetectionService,
    private readonly prismaService: PrismaService,
    private readonly s3Service: S3Service,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Process an incoming email from any source (Microsoft, Resend, etc.)
   */
  async process(ctx: ProcessDealContext): Promise<ProcessDealResult> {
    const { event, accessToken, inboxOwnerEmail, receivedByUserId, organizationId } = ctx;

    try {
      // Step 1: Quick deal detection
      const bodyText = event.bodyText || this.htmlToText(event.bodyHtml || '');
      const detection = await this.dealDetectionService.isDealEmail(
        event.subject,
        bodyText,
        event.attachments.length > 0,
        receivedByUserId,
        organizationId,
      );

      if (!detection.isDeal) {
        this.logger.log(
          `Skipping non-deal email: ${event.messageId} - "${event.subject}" (${detection.reason})`,
        );
        this.metricsService.recordDealSkipped(detection.reason || 'unknown');
        return { processed: false, skippedReason: detection.reason };
      }

      // Step 2: Extract text from email and attachments
      const extractedTexts = await this.extractAllText(event, accessToken);
      if (extractedTexts.length === 0) {
        this.logger.log(`No text extracted from email ${event.messageId}`);
        this.metricsService.recordDealSkipped('No text extracted');
        return { processed: false, skippedReason: 'No text extracted' };
      }

      const combinedText = extractedTexts.join('\n\n');

      // Step 3: Get client preferences
      const clientPrefs = await this.clientPreferencesService.getPreferences(organizationId);

      // Step 4: Generate AI summary
      const summary = await this.dealSummaryService.summarizeDeal(
        combinedText,
        clientPrefs.dealCriteria,
      );
      this.logger.log(`Generated summary for ${event.messageId} (${summary.length} chars)`);

      // Step 5: Make AI decision
      const decision = await this.dealDecisionService.makeDecision(
        summary,
        clientPrefs.dealCriteria,
      );
      this.logger.log(`Decision for ${event.messageId}: ${decision.decision} - ${decision.reason}`);

      // Step 6: Save deal to database and upload attachments
      let dealId: string | undefined;
      if (organizationId) {
        dealId = await this.saveDeal(ctx, summary, decision.decision as 'yes' | 'no', accessToken);
      } else {
        this.logger.warn(`User ${receivedByUserId} has no organization - deal will not be saved`);
      }

      // Step 7: Send reply
      const htmlEmail = this.emailTemplateService.formatSummaryAsHtml(
        summary,
        decision,
        clientPrefs.logoUrl,
        clientPrefs.companyName,
        clientPrefs.brandColor,
      );

      if (event.source === 'microsoft' && accessToken) {
        await this.microsoftGraphService.replyToSelf(
          accessToken,
          event.messageId,
          inboxOwnerEmail,
          htmlEmail,
        );
        this.logger.log(`Reply-to-self sent via Graph for ${event.messageId}`);

        // Step 8: Move passed deals to folder
        if (decision.decision === 'no') {
          const folderName = clientPrefs.passedFolderName || DEFAULT_PASSED_FOLDER;
          await this.microsoftGraphService.moveMessageToPassedFolder(
            accessToken,
            event.messageId,
            folderName,
          );
        }
      }

      this.metricsService.recordDealProcessed(decision.decision as 'yes' | 'no', event.source);

      return {
        processed: true,
        dealId,
        decision: decision.decision as 'yes' | 'no',
        reason: decision.reason,
      };
    } catch (error: unknown) {
      const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
      this.metricsService.recordProcessingError(errorType, 'processing');
      throw error;
    }
  }

  private async extractAllText(
    event: NormalizedEmailEvent,
    accessToken?: string,
  ): Promise<string[]> {
    const texts: string[] = [];

    // Email body
    const bodyText = event.bodyText || this.htmlToText(event.bodyHtml || '');
    if (bodyText) {
      texts.push(`--- Email Body ---\n${bodyText}`);
    }

    // PDF attachments (Microsoft source only for now)
    if (event.source === 'microsoft' && accessToken && event.attachments.length > 0) {
      for (const att of event.attachments) {
        if (att.contentType === 'application/pdf' || att.filename.toLowerCase().endsWith('.pdf')) {
          const content = await this.microsoftGraphService.getAttachmentContent(
            accessToken,
            event.messageId,
            att.contentId,
          );
          if (content) {
            const text = await this.emailProcessingService.processPdfBuffer(content);
            if (text) {
              texts.push(`--- ${att.filename} ---\n${text}`);
            }
          }
        }
      }
    }

    return texts;
  }

  private async saveDeal(
    ctx: ProcessDealContext,
    summary: string,
    decision: 'yes' | 'no',
    accessToken?: string,
  ): Promise<string | undefined> {
    const { event, organizationId, receivedByUserId } = ctx;

    try {
      // Step 1: Create deal first (to get dealId)
      const savedDeal = await this.prismaService.deal.create({
        data: {
          organizationId: organizationId!,
          receivedByUserId,
          sourceMessageId: event.messageId,
          sourceFrom: event.from,
          sourceSubject: event.subject,
          sourceReceivedAt: event.receivedAt,
          initialScreeningDecision: decision.toUpperCase() as 'YES' | 'NO',
          initialScreeningSummary: summary,
          initialScreeningAt: new Date(),
        },
        select: { id: true },
      });
      this.logger.log(`Deal saved: ${savedDeal.id}`);

      // Step 2: Upload attachments to S3 and create Document records
      if (event.attachments.length > 0 && event.source === 'microsoft' && accessToken) {
        await this.uploadAttachmentsAndCreateDocuments(
          savedDeal.id,
          event,
          accessToken,
        );
      } else if (event.attachments.length > 0) {
        // Create Document records without S3 (for non-Microsoft sources or missing token)
        await this.prismaService.document.createMany({
          data: event.attachments.map((att) => ({
            dealId: savedDeal.id,
            filename: att.filename,
            contentType: att.contentType,
            sizeBytes: att.size,
          })),
        });
      }

      return savedDeal.id;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to save deal: ${msg}`);
      return undefined;
    }
  }

  /**
   * Download attachments from Microsoft Graph, upload to S3, and create Document records
   */
  private async uploadAttachmentsAndCreateDocuments(
    dealId: string,
    event: NormalizedEmailEvent,
    accessToken: string,
  ): Promise<void> {
    for (const att of event.attachments) {
      try {
        // Download attachment content
        const content = await this.microsoftGraphService.getAttachmentContent(
          accessToken,
          event.messageId,
          att.contentId,
        );

        if (!content) {
          this.logger.warn(`Failed to download attachment ${att.filename}, creating Document without S3 key`);
          await this.prismaService.document.create({
            data: {
              dealId,
              filename: att.filename,
              contentType: att.contentType,
              sizeBytes: att.size,
            },
          });
          continue;
        }

        // Upload to S3
        const s3Key = await this.s3Service.uploadDealAttachment(
          content,
          att.filename,
          dealId,
        );

        // Create Document record with S3 key
        // Documents point to S3 - text can be extracted on-demand when needed
        await this.prismaService.document.create({
          data: {
            dealId,
            filename: att.filename,
            contentType: att.contentType,
            sizeBytes: att.size,
            s3Key,
          },
        });

        this.logger.log(`Document saved: ${att.filename} → ${s3Key}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to process attachment ${att.filename}: ${msg}`);
        // Create Document record without S3 key as fallback
        try {
          await this.prismaService.document.create({
            data: {
              dealId,
              filename: att.filename,
              contentType: att.contentType,
              sizeBytes: att.size,
            },
          });
        } catch (dbError) {
          this.logger.error(`Failed to create Document record for ${att.filename}`);
        }
      }
    }
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
