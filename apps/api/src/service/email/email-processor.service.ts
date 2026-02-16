import { Injectable, Logger } from '@nestjs/common';
import { ScreeningBucket } from '@prisma/client';
import { EmailProcessingService } from '../email/email-processing.service';
import { EmailTemplateService } from '../email/email-template.service';
import { EmailSenderService } from '../email/email-sender.service';
import { MicrosoftGraphService } from '../microsoft/microsoft-graph.service';
import {
  ScreeningPreferencesService,
  ScreeningPreferences,
} from '../preferences/screening-preferences.service';
import { ScreeningBucketService } from '../preferences/screening-bucket.service';
import { DealSummaryService } from '../deal/deal-summary.service';
import { InitialScreeningService } from '../deal/initial-screening.service';
import { DataExtractionService } from '../deal/data-extraction.service';
import { DealDetection } from '../deal/deal-detection.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { MetricsService } from '../metrics/metrics.service';
import { NotificationService } from '../notifications/notification.service';
import { ImageProcessorService } from '../email/image-processor.service';
import { aiConfig } from '../../config/ai.config';
import { NormalizedEmailEvent } from '../../dto/normalized-email-event.dto';
import { InitialScreeningResult } from '../../model/initial-screening.model';

export interface ProcessDealContext {
  event: NormalizedEmailEvent;
  accessToken?: string;
  inboxOwnerEmail: string;
  receivedByUserId?: string;
  organizationId: string; // Required - deals must be associated with an organization
  dealId?: string; // Pre-generated dealId for S3 organization
  detection: DealDetection; // Deal detection result (done in webhook)
  historical?: boolean; // When true, skip reply emails and folder moves (historical ingestion)
}

export interface ProcessDealResult {
  processed: boolean;
  dealId?: string;
  decision?: 'yes' | 'no';
  reason?: string;
  skippedReason?: string;
  bucketId?: string;
  bucketName?: string;
}

@Injectable()
export class EmailProcessorService {
  private readonly logger = new Logger(EmailProcessorService.name);
  private readonly aiConfig = aiConfig();

  constructor(
    private readonly emailProcessingService: EmailProcessingService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly emailSenderService: EmailSenderService,
    private readonly microsoftGraphService: MicrosoftGraphService,
    private readonly screeningPreferencesService: ScreeningPreferencesService,
    private readonly screeningBucketService: ScreeningBucketService,
    private readonly dealSummaryService: DealSummaryService,
    private readonly initialScreeningService: InitialScreeningService,
    private readonly dataExtractionService: DataExtractionService,
    private readonly prismaService: PrismaService,
    private readonly s3Service: S3Service,
    private readonly metricsService: MetricsService,
    private readonly notificationService: NotificationService,
    private readonly imageProcessorService: ImageProcessorService,
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

      // Step 2: Get client preferences and screening buckets
      const prefs = await this.screeningPreferencesService.getPreferences(organizationId);
      const buckets = await this.screeningBucketService.findAll(organizationId);

      if (buckets.length === 0) {
        // Safety net: ensure default buckets exist
        await this.screeningBucketService.ensureDefaultBuckets(organizationId);
        const defaultBuckets = await this.screeningBucketService.findAll(organizationId);
        buckets.push(...defaultBuckets);
      }

      // Step 3: Save deal to database first (without screening fields - screening service handles that)
      // Attachments already in S3 from webhook
      const dealId = await this.saveDeal(ctx, detection, accessToken);

      if (!dealId) {
        throw new Error('Failed to save deal');
      }

      // Step 4: Extract structured deal data FIRST (feeds into screening)
      let structuredData: Record<string, unknown> | undefined;
      try {
        const extraction = await this.dataExtractionService.extract(dealId, combinedText);
        structuredData = extraction.extractedData as Record<string, unknown>;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Data extraction failed for deal ${dealId}: ${msg}`);
      }

      // Step 5: Perform initial screening with structured data context
      const decision = await this.initialScreeningService.screen(
        dealId,
        combinedText,
        buckets,
        event.from,
        event.fromName,
        structuredData,
      );

      // Step 4.6: Associate asset with deal if one was found/created
      if (decision.assetId) {
        await this.prismaService.deal.update({
          where: { id: dealId },
          data: { assetId: decision.assetId },
        });
        this.logger.log(`Associated deal ${dealId} with asset ${decision.assetId}`);
      }

      // Step 4.7: Associate contact with deal if one was found/created
      if (decision.contactId) {
        await this.prismaService.deal.update({
          where: { id: dealId },
          data: { contactId: decision.contactId },
        });
        this.logger.log(`Associated deal ${dealId} with contact ${decision.contactId}`);
      }

      // Step 5: Find the matched bucket and dispatch on its action
      const matchedBucket = buckets.find((b) => b.id === decision.bucketId) || buckets[buckets.length - 1];

      // Historical ingestion: skip email actions (folder moves, replies, drafts)
      if (ctx.historical) {
        const durationSeconds = (Date.now() - startTime) / 1000;
        this.metricsService.recordDealProcessed(decision.decision, event.source, organizationId, inboxOwnerEmail);
        this.metricsService.recordDealProcessingDuration(durationSeconds, decision.decision, event.source);
        this.metricsService.recordEmailEvent(true, decision.decision, false);
        this.logger.log(`Historical deal processed in ${durationSeconds.toFixed(2)}s: ${event.messageId} → ${decision.decision} bucket="${matchedBucket.name}" (skipped actions)`);
        return { processed: true, dealId, decision: decision.decision, reason: decision.reason, bucketId: matchedBucket.id, bucketName: matchedBucket.name };
      }

      // Dispatch on bucket action
      await this.executeBucketAction(
        matchedBucket,
        event,
        accessToken,
        inboxOwnerEmail,
        dealId,
        combinedText,
        decision,
        prefs,
      );

      const durationSeconds = (Date.now() - startTime) / 1000;
      this.metricsService.recordDealProcessed(
        decision.decision,
        event.source,
        organizationId,
        inboxOwnerEmail,
      );
      this.metricsService.recordDealProcessingDuration(
        durationSeconds,
        decision.decision,
        event.source,
      );
      this.metricsService.recordEmailEvent(true, decision.decision, false);

      this.logger.log(
        `Deal processed in ${durationSeconds.toFixed(2)}s: ${event.messageId} → ${decision.decision} bucket="${matchedBucket.name}" action=${matchedBucket.action}`,
      );

      return {
        processed: true,
        dealId,
        decision: decision.decision,
        reason: decision.reason,
        bucketId: matchedBucket.id,
        bucketName: matchedBucket.name,
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

  /**
   * Execute the action defined by the matched screening bucket.
   */
  private async executeBucketAction(
    bucket: ScreeningBucket,
    event: NormalizedEmailEvent,
    accessToken: string | undefined,
    inboxOwnerEmail: string,
    dealId: string,
    combinedText: string,
    decision: InitialScreeningResult,
    prefs: ScreeningPreferences,
  ): Promise<void> {
    // Generate summary if the bucket requires it
    let summary: string | undefined;
    if (bucket.generateSummary) {
      summary = await this.dealSummaryService.summarizeDeal(
        combinedText,
        bucket.description,
      );
    }

    switch (bucket.action) {
      case 'REPLY_TO_SELF':
        if (summary) {
          await this.sendDealAnalysisReply(event, accessToken, inboxOwnerEmail, summary, decision, prefs);
        }
        break;

      case 'DRAFT_REPLY_TO_BROKER':
        if (event.source === 'microsoft' && accessToken) {
          await this.handleDraftReplyToBroker(accessToken, event.messageId, combinedText, decision, prefs);
        }
        break;

      case 'MOVE_TO_FOLDER':
        if (bucket.folderName) {
          await this.handleMoveToFolder(event, accessToken, dealId, bucket.folderName);
        }
        break;

      case 'NONE':
        this.logger.log(`Bucket "${bucket.name}" action=NONE, no email action taken for deal ${dealId}`);
        break;
    }
  }

  /**
   * Move email to a specific folder (Microsoft only).
   */
  private async handleMoveToFolder(
    event: NormalizedEmailEvent,
    accessToken: string | undefined,
    dealId: string,
    folderName: string,
  ): Promise<void> {
    if (event.source !== 'microsoft' || !accessToken) return;

    const folderId = await this.microsoftGraphService.getOrCreateFolder(accessToken, folderName);
    if (!folderId) return;

    // Get conversation ID BEFORE moving (message ID changes after move)
    const originalMessage = await this.microsoftGraphService.getMessage(accessToken, event.messageId);
    const conversationId = originalMessage?.conversationId;

    // Move original email immediately
    await this.microsoftGraphService.moveMessage(accessToken, event.messageId, folderId);
    this.logger.log(`Moved original email ${event.messageId} to ${folderName}`);

    // Move entire conversation (wait for Graph API to index)
    await new Promise((resolve) => setTimeout(resolve, 8000));

    if (conversationId && folderId) {
      await this.microsoftGraphService.moveConversation(accessToken, conversationId, folderId);
    }

    // Update Deal record with folder name
    await this.prismaService.deal.update({
      where: { id: dealId },
      data: { folderMovedTo: folderName },
    });

    this.metricsService.recordFolderMove(folderName);
  }

  /**
   * Create a draft reply to the broker (original sender) with a conversational response.
   * Uses AI to generate a natural-sounding reply (not the internal analysis).
   * The draft is left unsent in the user's Drafts folder for review before sending.
   */
  private async handleDraftReplyToBroker(
    accessToken: string,
    messageId: string,
    combinedText: string,
    decision: InitialScreeningResult,
    prefs: ScreeningPreferences,
  ): Promise<void> {
    const brokerReply = await this.dealSummaryService.generateBrokerReplyDraft(
      combinedText,
      decision.decision,
      prefs.companyName,
    );

    // Format as simple HTML (no branded template — this goes to the broker)
    const htmlBody = `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #333; line-height: 1.6;">${brokerReply.replace(/\n/g, '<br>')}</div>`;

    await this.microsoftGraphService.createDraftReplyToBroker(
      accessToken,
      messageId,
      htmlBody,
    );
  }

  /**
   * Send deal analysis reply to self (threaded).
   * Formats HTML email and sends via Microsoft Graph or Resend API.
   * Must be called BEFORE moving message, as moving changes the message ID.
   */
  private async sendDealAnalysisReply(
    event: NormalizedEmailEvent,
    accessToken: string | undefined,
    inboxOwnerEmail: string,
    summary: string,
    decision: InitialScreeningResult,
    prefs: ScreeningPreferences,
  ): Promise<void> {
    // Format HTML email
    const htmlEmail = this.emailTemplateService.formatSummaryAsHtml(
      summary,
      decision,
      prefs.organizationImageUrl,
      prefs.companyName,
      prefs.brandColor,
    );

    if (event.source === 'microsoft' && accessToken) {
      // Send replies FIRST while message is still in inbox (message ID is still valid)
      await this.microsoftGraphService.replyInThreadToSelf(
        accessToken,
        event.messageId,
        inboxOwnerEmail,
        htmlEmail,
      );

      // Forward original email to admins (non-blocking)
      try {
        await this.microsoftGraphService.forwardToAdmins(
          accessToken,
          event.messageId,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to forward email to admins: ${msg}`);
      }
    } else if (event.source === 'resend') {
      // Send reply via Resend API
      const replySubject = event.subject ? `Re: ${event.subject}` : 'Deal Summary';
      await this.emailSenderService.sendEmail({
        to: [inboxOwnerEmail],
        subject: replySubject,
        html: htmlEmail,
        text: summary,
        replyToMessageId: event.messageId,
      });
      this.logger.log(`Reply sent via Resend for ${event.messageId} to ${inboxOwnerEmail}`);
    }
  }

  private async extractAllText(
    event: NormalizedEmailEvent,
    accessToken?: string,
  ): Promise<string[]> {
    const texts: string[] = [];

    // Email body — extract text AND images from HTML
    const { text: bodyText, imageDataUrls } = await this.extractTextAndImagesFromHtml(
      event.bodyHtml || '',
      event.bodyText,
    );
    if (bodyText) {
      texts.push(`--- Email Body ---\n${bodyText}`);
    }

    // Process extracted images from HTML via Vision API
    if (imageDataUrls.length > 0) {
      this.logger.log(`Found ${imageDataUrls.length} content images in email HTML`);
      const images = imageDataUrls.map((dataUrl, i) => ({
        data: dataUrl,
        label: `embedded-image-${i + 1}`,
      }));
      const imageText = await this.imageProcessorService.extractTextFromMultipleImages(images);
      if (imageText) {
        texts.push(`--- Embedded Image Content ---\n${imageText}`);
      }
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

          // Fallback to Resend API if S3 not available (shouldn't happen, but be defensive)
          if (!content && event.source === 'resend') {
            // For Resend, contentId is the downloadUrl
            try {
              const response = await fetch(att.contentId);
              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                content = Buffer.from(arrayBuffer);
              }
            } catch (error) {
              const msg = error instanceof Error ? error.message : String(error);
              this.logger.warn(`Failed to download Resend attachment ${att.filename}: ${msg}`);
            }
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
    detection: DealDetection,
    accessToken?: string,
  ): Promise<string | undefined> {
    const { event, organizationId, receivedByUserId, dealId } = ctx;

    try {
      // Create deal (use pre-generated dealId if provided, otherwise Prisma generates one)
      // Note: Screening fields are no longer saved here - InitialScreeningService handles that
      const savedDeal = await this.prismaService.deal.create({
        data: {
          id: dealId, // Use pre-generated dealId from webhook (for S3 organization)
          organizationId,
          receivedByUserId,
          sourceMessageId: event.messageId,
          sourceFrom: event.from,
          sourceSubject: event.subject,
          sourceReceivedAt: event.receivedAt,
          detectionConfidence: detection.confidence,
          detectionReason: detection.reason,
        },
        select: { id: true },
      });
      this.logger.log(`Deal saved: ${savedDeal.id}`);

      // Create Document records (attachments already in S3 from webhook)
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

  /**
   * Known tracking/pixel domains to exclude from image OCR
   */
  private static readonly TRACKING_DOMAINS = [
    'open.', 'track.', 'click.', 'pixel.', 'beacon.',
    'mailchimp.com/track', 'list-manage.com/track',
    'sendgrid.net/wf/', 'mandrillapp.com/track',
    'google-analytics.com', 'doubleclick.net',
    'facebook.com/tr', 'bat.bing.com',
  ];

  /**
   * Extract text and content images from HTML email.
   * Filters out tracking pixels and non-content images.
   * Downloads external images and converts them to data URLs for Vision API.
   */
  async extractTextAndImagesFromHtml(
    html: string,
    plainText?: string,
  ): Promise<{ text: string; imageDataUrls: string[] }> {
    if (!html) {
      return { text: plainText || '', imageDataUrls: [] };
    }

    try {
      const { load } = await import('cheerio');
      const $ = load(html);

      // Remove script and style tags
      $('script, style').remove();

      // Extract text content
      const text = $.text().replace(/\s+/g, ' ').trim();

      // Collect image URLs (external and base64)
      const imageDataUrls: string[] = [];
      const imgElements = $('img').toArray();

      for (const el of imgElements) {
        const src = $(el).attr('src');
        if (!src) continue;

        const width = parseInt($(el).attr('width') || '0', 10);
        const height = parseInt($(el).attr('height') || '0', 10);

        // Filter out tracking pixels by dimension
        if ((width > 0 && width <= 3) || (height > 0 && height <= 3)) {
          continue;
        }

        // Base64 embedded images — include directly
        if (src.startsWith('data:image/')) {
          imageDataUrls.push(src);
          continue;
        }

        // External image URLs
        if (src.startsWith('http://') || src.startsWith('https://')) {
          // Filter out known tracking domains
          if (EmailProcessorService.TRACKING_DOMAINS.some((d) => src.includes(d))) {
            continue;
          }

          // Download and convert to data URL
          try {
            const response = await fetch(src, {
              signal: AbortSignal.timeout(10000),
              headers: { 'User-Agent': 'Mozilla/5.0' },
            });
            if (!response.ok) continue;

            const contentType = response.headers.get('content-type') || '';
            if (!contentType.startsWith('image/')) continue;

            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            // Skip tiny images (likely tracking pixels or spacers)
            if (buffer.length < 5000) continue;

            const base64 = buffer.toString('base64');
            const mimeType = contentType.split(';')[0];
            imageDataUrls.push(`data:${mimeType};base64,${base64}`);
          } catch {
            // Skip images that fail to download
          }
        }
      }

      return { text: text || plainText || '', imageDataUrls };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`HTML parsing failed, falling back to regex strip: ${msg}`);
      // Fallback to basic regex strip
      const fallbackText = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return { text: fallbackText || plainText || '', imageDataUrls: [] };
    }
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
