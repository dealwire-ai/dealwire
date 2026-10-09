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
import { BrokerIntelligenceService } from '../deal/broker-intelligence.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../s3/s3.service';
import { MetricsService } from '../metrics/metrics.service';
import { NotificationService } from '../notifications/notification.service';
import { ImageProcessorService } from '../email/image-processor.service';

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
    private readonly brokerIntelligenceService: BrokerIntelligenceService,
  ) {}

  /**
   * Process an incoming email from any source (Microsoft, Resend, etc.)
   * Note: Deal detection is now done in the webhook handler before this is called.
   */
  async process(ctx: ProcessDealContext): Promise<ProcessDealResult> {
    const {
      event,
      accessToken,
      inboxOwnerEmail,
      receivedByUserId,
      organizationId,
      detection,
    } = ctx;
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
      const prefs =
        await this.screeningPreferencesService.getPreferences(organizationId);
      const buckets = await this.screeningBucketService.findAll(organizationId);

      if (buckets.length === 0) {
        // Safety net: ensure default buckets exist
        await this.screeningBucketService.ensureDefaultBuckets(organizationId);
        const defaultBuckets =
          await this.screeningBucketService.findAll(organizationId);
        buckets.push(...defaultBuckets);
      }

      // Step 3: Save deal to database first (without screening fields - screening service handles that)
      // Attachments already in S3 from webhook
      const dealId = await this.saveDeal(ctx, detection, accessToken);

      // Truncate text for all AI calls to stay within TPM limits.
      // Data extraction gets a larger budget; downstream calls get less since they also receive structuredData.
      const MAX_EXTRACTION_CHARS = 50_000;
      const MAX_DOWNSTREAM_CHARS = 30_000;
      const extractionText =
        combinedText.length > MAX_EXTRACTION_CHARS
          ? combinedText.slice(0, MAX_EXTRACTION_CHARS) +
            '\n\n[...text truncated for token efficiency]'
          : combinedText;

      // Step 4: Extract structured deal data FIRST (feeds into screening)
      let structuredData: Record<string, unknown> | undefined;
      try {
        const extraction = await this.dataExtractionService.extract(
          dealId,
          extractionText,
        );
        structuredData = extraction.extractedData as Record<string, unknown>;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Data extraction failed for deal ${dealId}: ${msg}`);
      }
      const downstreamText =
        combinedText.length > MAX_DOWNSTREAM_CHARS
          ? combinedText.slice(0, MAX_DOWNSTREAM_CHARS) +
            '\n\n[...text truncated for token efficiency]'
          : combinedText;

      // Step 5: Perform initial screening with structured data context
      const decision = await this.initialScreeningService.screen(
        dealId,
        downstreamText,
        buckets,
        event.from,
        event.fromName,
        structuredData,
        prefs.dealCriteria,
      );

      // Step 4.6: Associate asset with deal if one was found/created
      if (decision.assetId) {
        await this.prismaService.deal.update({
          where: { id: dealId },
          data: { assetId: decision.assetId },
        });
        this.logger.log(
          `Associated deal ${dealId} with asset ${decision.assetId}`,
        );
      }

      // Step 4.7: Associate contact with deal if one was found/created
      if (decision.contactId) {
        await this.prismaService.deal.update({
          where: { id: dealId },
          data: { contactId: decision.contactId },
        });
        this.logger.log(
          `Associated deal ${dealId} with contact ${decision.contactId}`,
        );
      }

      // Step 4.8: Check if this deal is muted (same property + same broker)
      if (decision.assetId && decision.contactId) {
        const mutedDeal = await this.prismaService.deal.findFirst({
          where: {
            organizationId,
            assetId: decision.assetId,
            contactId: decision.contactId,
            isMuted: true,
            id: { not: dealId },
          },
          select: { id: true, mutedReason: true },
        });
        if (mutedDeal) {
          const muteReason = mutedDeal.mutedReason || 'Deal muted by user';
          this.logger.log(
            `Deal ${dealId} suppressed — muted by deal ${mutedDeal.id}: ${muteReason}`,
          );
          await this.prismaService.initialScreening.create({
            data: {
              dealId,
              decision: 'NO',
              reason: `Muted: ${muteReason}`,
              screenedAt: new Date(),
            },
          });
          this.metricsService.recordDealSkipped('muted');
          return {
            processed: true,
            dealId,
            decision: 'no',
            reason: `Muted: ${muteReason}`,
          };
        }
      }

      // Step 5: Find the matched bucket and dispatch on its action
      const matchedBucket =
        buckets.find((b) => b.id === decision.bucketId) ||
        buckets[buckets.length - 1];

      // Historical ingestion: skip email actions (folder moves, replies, drafts)
      if (ctx.historical) {
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
          `Historical deal processed in ${durationSeconds.toFixed(2)}s: ${event.messageId} → ${decision.decision} bucket="${matchedBucket.name}" (skipped actions)`,
        );
        return {
          processed: true,
          dealId,
          decision: decision.decision,
          reason: decision.reason,
          bucketId: matchedBucket.id,
          bucketName: matchedBucket.name,
        };
      }

      // Dispatch on bucket action
      await this.executeBucketAction(
        matchedBucket,
        event,
        accessToken,
        inboxOwnerEmail,
        dealId,
        downstreamText,
        decision,
        prefs,
        organizationId,
        structuredData,
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
      const errorType =
        error instanceof Error ? error.constructor.name : 'Unknown';
      const errorMessage =
        error instanceof Error ? error.message : String(error);
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
    organizationId: string,
    structuredData?: Record<string, unknown>,
  ): Promise<void> {
    // Generate summary and narrative in a single OpenAI call if the bucket requires it
    let summary: string | undefined;
    let narrative: string | undefined;
    if (bucket.generateSummary) {
      const result = await this.dealSummaryService.summarizeDealWithNarrative(
        combinedText,
        bucket.description,
        structuredData,
      );
      summary = result.summary;
      narrative = result.narrative || undefined;
    }

    switch (bucket.action) {
      case 'REPLY_TO_SELF':
        if (summary) {
          await this.sendDealAnalysisReply(
            event,
            accessToken,
            inboxOwnerEmail,
            summary,
            decision,
            prefs,
            narrative,
            dealId,
            organizationId,
          );
        }
        break;

      case 'DRAFT_REPLY_TO_BROKER':
        if (event.source === 'microsoft' && accessToken) {
          await this.handleDraftReplyToBroker(
            accessToken,
            event.messageId,
            combinedText,
            decision,
            prefs,
            dealId,
          );
        }
        break;

      case 'MOVE_TO_FOLDER':
        if (bucket.folderName) {
          await this.handleMoveToFolder(
            event,
            accessToken,
            dealId,
            bucket.folderName,
          );
        }
        break;

      case 'NONE':
        this.logger.log(
          `Bucket "${bucket.name}" action=NONE, no email action taken for deal ${dealId}`,
        );
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

    const folderId = await this.microsoftGraphService.getOrCreateFolder(
      accessToken,
      folderName,
    );
    if (!folderId) return;

    // Get conversation ID BEFORE moving (message ID changes after move)
    const originalMessage = await this.microsoftGraphService.getMessage(
      accessToken,
      event.messageId,
    );
    const conversationId = originalMessage?.conversationId;

    // Move original email immediately
    await this.microsoftGraphService.moveMessage(
      accessToken,
      event.messageId,
      folderId,
    );
    this.logger.log(`Moved original email ${event.messageId} to ${folderName}`);

    // Move entire conversation (wait for Graph API to index)
    await new Promise((resolve) => setTimeout(resolve, 8000));

    if (conversationId && folderId) {
      await this.microsoftGraphService.moveConversation(
        accessToken,
        conversationId,
        folderId,
      );
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
   * Enriched with broker relationship context and smart follow-up questions.
   * The draft is left unsent in the user's Drafts folder for review before sending.
   */
  private async handleDraftReplyToBroker(
    accessToken: string,
    messageId: string,
    combinedText: string,
    decision: InitialScreeningResult,
    prefs: ScreeningPreferences,
    dealId: string,
  ): Promise<void> {
    // Fetch broker context and deal data in parallel for enriched draft
    let brokerContext: Parameters<
      DealSummaryService['generateBrokerReplyDraft']
    >[3];
    let extractedData: Record<string, unknown> | undefined;

    try {
      const deal = await this.prismaService.deal.findUnique({
        where: { id: dealId },
        select: {
          contactId: true,
          organizationId: true,
          extractedData: true,
          contact: { select: { notes: true } },
        },
      });

      if (deal?.extractedData && typeof deal.extractedData === 'object') {
        extractedData = deal.extractedData as Record<string, unknown>;
      }

      if (deal?.contactId && deal.organizationId) {
        const stats = await this.brokerIntelligenceService.getBrokerStats(
          deal.contactId,
          deal.organizationId,
        );

        if (stats && stats.totalDeals > 1) {
          // Get recent passing deal subjects for relationship context
          const recentPassingDeals = await this.prismaService.deal.findMany({
            where: {
              organizationId: deal.organizationId,
              contactId: deal.contactId,
              initialScreening: { decision: 'YES' },
              id: { not: dealId },
            },
            select: { sourceSubject: true },
            orderBy: { createdAt: 'desc' },
            take: 3,
          });

          brokerContext = {
            name:
              [stats.firstName, stats.lastName].filter(Boolean).join(' ') ||
              stats.email,
            totalDeals: stats.totalDeals,
            passRate: stats.passRate,
            topCities: stats.topCities,
            recentPassingDeals: recentPassingDeals
              .map((d) => d.sourceSubject)
              .filter(Boolean) as string[],
            notes: deal.contact?.notes || undefined,
          };
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to fetch broker context for draft: ${msg}`);
    }

    const brokerReply = await this.dealSummaryService.generateBrokerReplyDraft(
      combinedText,
      decision.decision,
      prefs.companyName,
      brokerContext,
      extractedData,
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
    narrative?: string,
    dealId?: string,
    organizationId?: string,
  ): Promise<void> {
    // Build action card data (best-effort, non-blocking)
    const actionCard = await this.buildActionCard(
      event,
      accessToken,
      dealId,
      organizationId,
      decision,
    );

    // Format HTML email
    const htmlEmail = this.emailTemplateService.formatSummaryAsHtml(
      summary,
      decision,
      prefs.organizationImageUrl,
      prefs.companyName,
      prefs.brandColor,
      narrative,
      actionCard,
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
      const replySubject = event.subject
        ? `Re: ${event.subject}`
        : 'Deal Summary';
      await this.emailSenderService.sendEmail({
        to: [inboxOwnerEmail],
        subject: replySubject,
        html: htmlEmail,
        text: summary,
        replyToMessageId: event.messageId,
      });
      this.logger.log(
        `Reply sent via Resend for ${event.messageId} to ${inboxOwnerEmail}`,
      );
    }
  }

  /**
   * Build action card data for the deal analysis email.
   * Gathers webLink, attachment pre-signed URLs, broker context, and extracted links.
   * All lookups are best-effort — failures result in a partial or empty action card.
   */
  private async buildActionCard(
    event: NormalizedEmailEvent,
    accessToken: string | undefined,
    dealId?: string,
    organizationId?: string,
    decision?: InitialScreeningResult,
  ): Promise<
    import('../email/email-template.service').ActionCardData | undefined
  > {
    try {
      const actionCard: import('../email/email-template.service').ActionCardData =
        {};

      // 1. Get webLink and entry ID from Graph API (original email link in Outlook Web + desktop deep link)
      if (event.source === 'microsoft' && accessToken) {
        try {
          const message = await this.microsoftGraphService.getMessage(
            accessToken,
            event.messageId,
            false,
            true,
          );
          if (message?.webLink) {
            actionCard.originalEmailLink = message.webLink;
            // Persist webLink and entry ID on the deal for digest use
            if (dealId) {
              const entryId =
                this.microsoftGraphService.extractEntryId(message);
              this.prismaService.deal
                .update({
                  where: { id: dealId },
                  data: {
                    sourceWebLink: message.webLink,
                    ...(entryId && { sourceEntryId: entryId }),
                  },
                })
                .catch((err) => {
                  const msg = err instanceof Error ? err.message : String(err);
                  this.logger.warn(
                    `Failed to persist webLink for deal ${dealId}: ${msg}`,
                  );
                });
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.debug(`Failed to get webLink for action card: ${msg}`);
        }
      }

      // 2. Get pre-signed URLs for deal documents from S3
      if (dealId) {
        try {
          const documents = await this.prismaService.document.findMany({
            where: { dealId },
            select: {
              filename: true,
              s3Key: true,
              contentType: true,
              sizeBytes: true,
            },
          });

          const attachmentLinks: Array<{
            filename: string;
            url: string;
            contentType: string;
            sizeBytes?: number;
          }> = [];
          for (const doc of documents) {
            if (doc.s3Key) {
              try {
                const url = await this.s3Service.getPresignedUrl(doc.s3Key);
                attachmentLinks.push({
                  filename: doc.filename,
                  url,
                  contentType: doc.contentType,
                  sizeBytes: doc.sizeBytes || undefined,
                });
              } catch {
                // Skip documents that fail to generate pre-signed URLs
              }
            }
          }

          if (attachmentLinks.length > 0) {
            actionCard.attachments = attachmentLinks;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.debug(
            `Failed to get document links for action card: ${msg}`,
          );
        }
      }

      // 3. Look up broker stats
      if (decision?.contactId && organizationId) {
        try {
          const stats = await this.brokerIntelligenceService.getBrokerStats(
            decision.contactId,
            organizationId,
          );

          if (stats && stats.totalDeals > 1) {
            actionCard.brokerContext = {
              name:
                [stats.firstName, stats.lastName].filter(Boolean).join(' ') ||
                stats.email,
              email: stats.email,
              totalDeals: stats.totalDeals,
              passRate: stats.passRate,
              topCities: stats.topCities.map((c) => c.city),
              lastDealAt: stats.lastDealAt || undefined,
            };
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.debug(
            `Failed to get broker stats for action card: ${msg}`,
          );
        }
      }

      // 4. Extract links from email HTML
      if (event.bodyHtml) {
        const links = this.extractLinksFromHtml(event.bodyHtml);
        if (links.dealRoomLinks.length > 0) {
          actionCard.dealRoomLinks = links.dealRoomLinks;
        }
        if (links.caLinks.length > 0) {
          actionCard.caLinks = links.caLinks;
        }
      }

      // Only return action card if it has any content
      const hasContent =
        actionCard.originalEmailLink ||
        (actionCard.attachments && actionCard.attachments.length > 0) ||
        actionCard.brokerContext ||
        (actionCard.dealRoomLinks && actionCard.dealRoomLinks.length > 0) ||
        (actionCard.caLinks && actionCard.caLinks.length > 0);

      return hasContent ? actionCard : undefined;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to build action card: ${msg}`);
      return undefined;
    }
  }

  private async extractAllText(
    event: NormalizedEmailEvent,
    accessToken?: string,
  ): Promise<string[]> {
    const texts: string[] = [];

    // Email body — extract text AND images from HTML
    const { text: bodyText, imageDataUrls } =
      await this.extractTextAndImagesFromHtml(
        event.bodyHtml || '',
        event.bodyText,
      );
    if (bodyText) {
      texts.push(`--- Email Body ---\n${bodyText}`);
    }

    // Process extracted images from HTML via Vision API
    if (imageDataUrls.length > 0) {
      this.logger.log(
        `Found ${imageDataUrls.length} content images in email HTML`,
      );
      const images = imageDataUrls.map((dataUrl, i) => ({
        data: dataUrl,
        label: `embedded-image-${i + 1}`,
      }));
      const imageText =
        await this.imageProcessorService.extractTextFromMultipleImages(images);
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
              const msg =
                error instanceof Error ? error.message : String(error);
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
              const msg =
                error instanceof Error ? error.message : String(error);
              this.logger.warn(
                `Failed to download Resend attachment ${att.filename}: ${msg}`,
              );
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
  ): Promise<string> {
    const { event, organizationId, receivedByUserId, dealId } = ctx;

    // Extract links from email HTML for action cards and digest
    const extractedLinks = event.bodyHtml
      ? this.extractLinksFromHtml(event.bodyHtml)
      : undefined;

    // Upsert on sourceMessageId (the natural idempotency key) so duplicate
    // webhook deliveries and SQS retries reuse the existing deal, even when
    // a fresh dealId was generated for this attempt.
    const savedDeal = await this.prismaService.deal.upsert({
      where: { sourceMessageId: event.messageId },
      create: {
        id: dealId,
        organizationId,
        receivedByUserId,
        sourceMessageId: event.messageId,
        sourceFrom: event.from,
        sourceSubject: event.subject,
        sourceReceivedAt: event.receivedAt,
        detectionConfidence: detection.confidence,
        detectionReason: detection.reason,
        extractedLinks: extractedLinks
          ? JSON.parse(JSON.stringify(extractedLinks))
          : undefined,
      },
      update: {},
      select: { id: true },
    });
    this.logger.log(`Deal saved: ${savedDeal.id}`);

    // Create Document records (attachments already in S3 from webhook)
    if (event.attachments.length > 0) {
      await this.createDocumentRecords(savedDeal.id, event);
    }

    return savedDeal.id;
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

        this.logger.log(
          `Document saved: ${att.filename}${att.s3Key ? ` → ${att.s3Key}` : ''}`,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(
          `Failed to create Document record for ${att.filename}: ${msg}`,
        );
      }
    }
  }

  /**
   * Known tracking/pixel domains to exclude from image OCR
   */
  private static readonly TRACKING_DOMAINS = [
    'open.',
    'track.',
    'click.',
    'pixel.',
    'beacon.',
    'mailchimp.com/track',
    'list-manage.com/track',
    'sendgrid.net/wf/',
    'mandrillapp.com/track',
    'google-analytics.com',
    'doubleclick.net',
    'facebook.com/tr',
    'bat.bing.com',
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
          if (
            EmailProcessorService.TRACKING_DOMAINS.some((d) => src.includes(d))
          ) {
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
      this.logger.warn(
        `HTML parsing failed, falling back to regex strip: ${msg}`,
      );
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
   * Extract and classify URLs from email HTML.
   * Finds deal room links, CA/NDA links, and listing links.
   */
  private extractLinksFromHtml(html: string): {
    dealRoomLinks: string[];
    caLinks: string[];
    listingLinks: string[];
  } {
    const result = {
      dealRoomLinks: [] as string[],
      caLinks: [] as string[],
      listingLinks: [] as string[],
    };
    if (!html) return result;

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { load } = require('cheerio');
      const $ = load(html);

      // Domains to skip entirely
      const skipPatterns = [
        'unsubscribe',
        'mailto:',
        'tel:',
        'facebook.com',
        'twitter.com',
        'linkedin.com',
        'instagram.com',
        'youtube.com',
        'tiktok.com',
        'open.',
        'track.',
        'click.',
        'pixel.',
        'beacon.',
        'google-analytics.com',
        'doubleclick.net',
      ];

      const dealRoomDomains = [
        'junipersquare.com',
        'dropbox.com',
        'box.com',
        'sharefile.com',
        'onedrive.com',
        'drive.google.com',
        'ipreo.com',
        'dealpath.com',
      ];

      const caDomains = [
        'docusign.com',
        'docusign.net',
        'hellosign.com',
        'adobesign.com',
        'pandadoc.com',
      ];
      const caTextPatterns = ['confidential', 'nda', 'ca agreement'];

      const listingDomains = [
        'crexi.com',
        'loopnet.com',
        'costar.com',
        'cbre.com',
        'jll.com',
        'cushwake.com',
        'nmrk.com',
        'colliers.com',
      ];

      const seen = new Set<string>();

      $('a[href]').each((_: number, el: unknown) => {
        const href = ($(el).attr('href') as string | undefined)?.trim();
        if (!href || !href.startsWith('http')) return;

        const lowerHref = href.toLowerCase();
        const linkText = ($(el).text() as string).toLowerCase().trim();

        // Skip tracking/social/utility links
        if (skipPatterns.some((p) => lowerHref.includes(p))) return;

        // Deduplicate
        if (seen.has(href)) return;
        seen.add(href);

        // Classify
        if (dealRoomDomains.some((d) => lowerHref.includes(d))) {
          result.dealRoomLinks.push(href);
        } else if (
          caDomains.some((d) => lowerHref.includes(d)) ||
          caTextPatterns.some((p) => linkText.includes(p))
        ) {
          result.caLinks.push(href);
        } else if (listingDomains.some((d) => lowerHref.includes(d))) {
          result.listingLinks.push(href);
        }
      });

      return result;
    } catch {
      return result;
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
      imageContentTypes.includes(contentType) || imageExtensions.test(filename)
    );
  }
}
