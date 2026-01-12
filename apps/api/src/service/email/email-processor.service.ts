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
  dealId?: string; // Pre-generated dealId for S3 organization
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
      const clientPrefs = this.clientPreferencesService.getPreferences(inboxOwnerEmail);

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

    // Process attachments (prefer S3, fallback to Microsoft Graph)
    if (event.attachments.length > 0) {
      for (const att of event.attachments) {
        if (att.contentType === 'application/pdf' || att.filename.toLowerCase().endsWith('.pdf')) {
          let content: Buffer | null = null;

          // Prefer S3 if available (already uploaded)
          if (att.s3Key) {
            try {
              content = await this.s3Service.downloadDealAttachment(att.s3Key);
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              this.logger.warn(`Failed to download ${att.filename} from S3 (${att.s3Key}): ${msg}, falling back to Graph API`);
            }
          }

          // Fallback to Microsoft Graph if S3 not available
          if (!content && event.source === 'microsoft' && accessToken) {
            content = await this.microsoftGraphService.getAttachmentContent(
              accessToken,
              event.messageId,
              att.contentId,
            );
          }

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
    const { event, organizationId, receivedByUserId, dealId } = ctx;

    try {
      // Step 1: Create deal (use pre-generated dealId if provided, otherwise Prisma generates one)
      const savedDeal = await this.prismaService.deal.create({
        data: {
          id: dealId, // Use pre-generated dealId from webhook (for S3 organization)
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

      // Step 2: Create Document records (attachments already in S3 from webhook)
      if (event.attachments.length > 0) {
        await this.createDocumentRecords(savedDeal.id, event);
      }

      return savedDeal.id;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to save deal: ${msg}`);
      return undefined;
    }
  }

  /**
   * Create Document records from attachments (already uploaded to S3 in webhook)
   * If S3 key exists, download and extract text for PDFs
   */
  private async createDocumentRecords(
    dealId: string,
    event: NormalizedEmailEvent,
  ): Promise<void> {
    for (const att of event.attachments) {
      try {
        let extractedText: string | undefined;

        // If attachment is already in S3, download and extract text
        if (att.s3Key) {
          try {
            const content = await this.s3Service.downloadDealAttachment(att.s3Key);
            // Extract text if PDF (for searchability)
            if (att.contentType === 'application/pdf' || att.filename.toLowerCase().endsWith('.pdf')) {
              extractedText = await this.emailProcessingService.processPdfBuffer(content);
            }
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            this.logger.warn(`Failed to download ${att.filename} from S3 for text extraction: ${msg}`);
          }
        }

        // Create Document record
        await this.prismaService.document.create({
          data: {
            dealId,
            filename: att.filename,
            contentType: att.contentType,
            sizeBytes: att.size,
            s3Key: att.s3Key, // Use S3 key from attachment if available
            extractedText,
          },
        });

        this.logger.log(`Document saved: ${att.filename}${att.s3Key ? ` → ${att.s3Key}` : ''}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to create Document record for ${att.filename}: ${msg}`);
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
