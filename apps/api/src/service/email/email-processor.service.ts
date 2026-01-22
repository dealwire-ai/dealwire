import { Injectable, Logger } from '@nestjs/common';
import { EmailProcessingService } from '../email/email-processing.service';
import { EmailTemplateService } from '../email/email-template.service';
import { MicrosoftGraphService } from '../microsoft/microsoft-graph.service';
import {
  ScreeningPreferencesService,
  DEFAULT_PASSED_FOLDER,
} from '../preferences/screening-preferences.service';
import { DealSummaryService } from '../deal/deal-summary.service';
import { DealDecisionService } from '../deal/deal-decision.service';
import { DealDetection } from '../deal/deal-detection.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { MetricsService } from '../metrics/metrics.service';
import { NotificationService } from '../notifications/notification.service';
import { aiConfig } from '../../config/ai.config';
import { NormalizedEmailEvent } from '../../dto/normalized-email-event.dto';

export interface ProcessDealContext {
  event: NormalizedEmailEvent;
  accessToken?: string;
  inboxOwnerEmail: string;
  receivedByUserId?: string;
  organizationId?: string;
  dealId?: string; // Pre-generated dealId for S3 organization
  detection: DealDetection; // Deal detection result (done in webhook)
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
    private readonly screeningPreferencesService: ScreeningPreferencesService,
    private readonly dealSummaryService: DealSummaryService,
    private readonly dealDecisionService: DealDecisionService,
    private readonly prismaService: PrismaService,
    private readonly s3Service: S3Service,
    private readonly metricsService: MetricsService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Process an incoming email from any source (Microsoft, Resend, etc.)
   * Note: Deal detection is now done in the webhook handler before this is called.
   */
  async process(ctx: ProcessDealContext): Promise<ProcessDealResult> {
    const { event, accessToken, inboxOwnerEmail, receivedByUserId, organizationId, detection } = ctx;
    const startTime = Date.now();

    try {
      // Deal detection is done in webhook - if we get here, it's already a deal
      if (!detection.isDeal) {
        this.logger.warn(
          `Received non-deal email in processor: ${event.messageId} - "${event.subject}" (${detection.reason})`,
        );
        this.metricsService.recordDealSkipped(detection.reason || 'unknown');
        this.metricsService.recordEmailEvent(false, null, false);
        
        return { processed: false, skippedReason: detection.reason };
      }

      // Step 1: Extract text from email and attachments
      const extractedTexts = await this.extractAllText(event, accessToken);
      if (extractedTexts.length === 0) {
        this.logger.log(`No text extracted from email ${event.messageId}`);
        this.metricsService.recordDealSkipped('No text extracted');
        this.metricsService.recordEmailEvent(false, null, false);
        
        return { processed: false, skippedReason: 'No text extracted' };
      }

      const combinedText = extractedTexts.join('\n\n');

      // Step 2: Get client preferences
      const prefs = await this.screeningPreferencesService.getPreferences(organizationId);

      // Step 3: Generate AI summary
      const summary = await this.dealSummaryService.summarizeDeal(
        combinedText,
        prefs.dealCriteria,
      );

      // Step 4: Make AI decision
      const decision = await this.dealDecisionService.makeDecision(
        summary,
        prefs.dealCriteria,
      );

      // Step 5: Save deal to database (attachments already in S3 from webhook)
      let dealId: string | undefined;
      if (organizationId) {
        dealId = await this.saveDeal(
          ctx,
          summary,
          decision.decision as 'yes' | 'no',
          detection,
          accessToken,
        );
      } else {
        this.logger.warn(`User ${receivedByUserId} has no organization - deal will not be saved`);
      }

      // Step 6: Handle NO decisions - move original email immediately to skip inbox
      if (event.source === 'microsoft' && accessToken && decision.decision === 'no' && dealId) {
        const folderName = prefs.passedFolderName || DEFAULT_PASSED_FOLDER;
        const folderId = await this.microsoftGraphService.getOrCreateFolder(accessToken, folderName);
        
        if (folderId) {
          // Move original email immediately (before sending replies) to skip inbox entirely
          await this.microsoftGraphService.moveMessage(accessToken, event.messageId, folderId);
          this.logger.log(`Moved original email ${event.messageId} to ${folderName} immediately (skipping inbox)`);
        }
      }

      // Step 7: Send reply
      const htmlEmail = this.emailTemplateService.formatSummaryAsHtml(
        summary,
        decision,
        prefs.logoUrl,
        prefs.companyName,
        prefs.brandColor,
      );

      if (event.source === 'microsoft' && accessToken) {
        await this.microsoftGraphService.replyToSelf(
          accessToken,
          event.messageId,
          inboxOwnerEmail,
          htmlEmail,
        );

        // Forward original email to admins (non-blocking)
        // Admins are also CC'd on the reply, so they'll see both in the conversation thread
        try {
          await this.microsoftGraphService.forwardToAdmins(
            accessToken,
            event.messageId,
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Failed to forward email to admins: ${msg}`);
          // Don't fail the deal processing if forward fails
        }

        // Step 8: Move entire conversation for NO decisions (to catch reply-to-self and forward)
        if (decision.decision === 'no' && dealId) {
          const folderName = prefs.passedFolderName || DEFAULT_PASSED_FOLDER;
          
          // Wait for Graph API to index the replies we just sent
          await new Promise((resolve) => setTimeout(resolve, 8000));
          
          // Move entire conversation (this will catch reply-to-self and forward emails)
          await this.microsoftGraphService.moveMessageToPassedFolder(
            accessToken,
            event.messageId,
            folderName,
          );
          
          // Update Deal record with folder name
          await this.prismaService.deal.update({
            where: { id: dealId },
            data: { folderMovedTo: folderName },
          });

          // Record metrics
          this.metricsService.recordFolderMove(folderName);
        }
      }

      const durationSeconds = (Date.now() - startTime) / 1000;
      this.metricsService.recordDealProcessed(decision.decision as 'yes' | 'no', event.source);
      this.metricsService.recordDealProcessingDuration(
        durationSeconds,
        decision.decision as 'yes' | 'no',
        event.source,
      );
      this.metricsService.recordEmailEvent(true, decision.decision as 'yes' | 'no', false);

      this.logger.log(
        `Deal processed in ${durationSeconds.toFixed(2)}s: ${event.messageId} → ${decision.decision}`,
      );

      return {
        processed: true,
        dealId,
        decision: decision.decision as 'yes' | 'no',
        reason: decision.reason,
      };
    } catch (error: unknown) {
      const errorType = error instanceof Error ? error.constructor.name : 'Unknown';
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.metricsService.recordProcessingError(errorType, 'processing');
      
      // Record metrics
      this.metricsService.recordEmailEvent(true, null, true);

      // Notify about processing error
      await this.notificationService.notifyError(
        ctx.event.messageId,
        ctx.event.subject || 'No subject',
        errorMessage,
        'processing',
      );
      
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
        const isPdf =
          att.contentType === 'application/pdf' ||
          att.filename.toLowerCase().endsWith('.pdf');
        const isImage = this.isImageType(att.contentType, att.filename);

        if (isPdf || isImage) {
          let content: Buffer | null = null;

          // Prefer S3 if available (already uploaded)
          if (att.s3Key) {
            try {
              content = await this.s3Service.downloadDealAttachment(att.s3Key);
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              this.logger.warn(
                `Failed to download ${att.filename} from S3 (${att.s3Key}): ${msg}, falling back to Graph API`,
              );
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
            let text = '';
            if (isPdf) {
              text = await this.emailProcessingService.processPdfBuffer(
                content,
                att.filename,
              );
            } else if (isImage) {
              text = await this.emailProcessingService.processImageBuffer(
                content,
                att.filename,
              );
            }

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
    detection: { isDeal: boolean; confidence: string; reason: string },
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
          detectionConfidence: detection.confidence,
          detectionReason: detection.reason,
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
   * Documents point to S3 - text can be extracted on-demand when needed
   */
  private async createDocumentRecords(
    dealId: string,
    event: NormalizedEmailEvent,
  ): Promise<void> {
    for (const att of event.attachments) {
      try {
        // Create Document record pointing to S3
        await this.prismaService.document.create({
          data: {
            dealId,
            filename: att.filename,
            contentType: att.contentType,
            sizeBytes: att.size,
            s3Key: att.s3Key, // S3 key where document is stored
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

  /**
   * Check if attachment is an image type
   */
  private isImageType(contentType: string, filename: string): boolean {
    const imageContentTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp',
    ];
    const imageExtensions = /\.(png|jpg|jpeg|gif|webp)$/i;

    return (
      imageContentTypes.includes(contentType) ||
      imageExtensions.test(filename)
    );
  }
}
