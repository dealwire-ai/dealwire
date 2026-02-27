import { Injectable, Logger } from '@nestjs/common';
import { MicrosoftGraphService } from './microsoft-graph.service';
import { MicrosoftSubscriptionService } from './microsoft-subscription.service';
import { PrismaService } from '../prisma/prisma.service';
import { SQSService } from '../sqs/sqs.service';
import { S3Service } from '../s3/s3.service';
import { MetricsService } from '../metrics/metrics.service';
import { DealDetectionService } from '../deal/deal-detection.service';

interface GraphNotification {
  subscriptionId: string;
  changeType: string;
  resource: string;
  resourceData: {
    id: string;
    '@odata.type': string;
    '@odata.id': string;
    '@odata.etag': string;
  };
  clientState: string;
  tenantId: string;
}

interface GraphNotificationPayload {
  value: GraphNotification[];
}

@Injectable()
export class MicrosoftWebhookService {
  private readonly logger = new Logger(MicrosoftWebhookService.name);
  // Simple dedup cache - tracks processed message IDs for 5 minutes
  private readonly processedMessages = new Map<string, number>();
  private readonly DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(
    private readonly microsoftGraphService: MicrosoftGraphService,
    private readonly subscriptionService: MicrosoftSubscriptionService,
    private readonly prismaService: PrismaService,
    private readonly sqsService: SQSService,
    private readonly s3Service: S3Service,
    private readonly metricsService: MetricsService,
    private readonly dealDetectionService: DealDetectionService,
  ) {}

  /**
   * Process notifications from Microsoft Graph
   */
  async handleNotifications(payload: GraphNotificationPayload): Promise<void> {
    if (!payload?.value || !Array.isArray(payload.value)) {
      this.logger.log(
        `Received non-notification payload (lifecycle event or empty). Payload: ${JSON.stringify(payload)}`,
      );
      return;
    }

    this.logger.log(`Processing ${payload.value.length} notification(s) from Microsoft Graph`);

    for (const notification of payload.value) {
      if (notification.changeType !== 'created') {
        this.logger.debug(`Ignoring ${notification.changeType} notification`);
        continue;
      }

      this.metricsService.recordEmailReceived('microsoft');
      await this.processEmailNotification(notification);
    }
  }

  private async processEmailNotification(
    notification: GraphNotification,
  ): Promise<void> {
    const { subscriptionId, resourceData } = notification;
    const messageId = resourceData.id;
    let userEmail: string | null = null;

    this.logger.log(
      `Processing email notification: messageId=${messageId}, subscriptionId=${subscriptionId}, changeType=${notification.changeType}`,
    );

    try {
      // Find which user this subscription belongs to BEFORE dedup check
      // so that unknown/orphaned subscriptions don't poison the dedup cache
      const userId =
        await this.subscriptionService.getUserBySubscriptionId(subscriptionId);
      if (!userId) {
        this.logger.warn(`Unknown subscription ${subscriptionId} - no user found`);
        return;
      }

      // Dedup check - skip if we've already processed this message recently
      const now = Date.now();
      if (this.processedMessages.has(messageId)) {
        this.logger.log(`Skipping duplicate notification for ${messageId}`);
        return;
      }
      // Mark as processed and clean up old entries
      this.processedMessages.set(messageId, now);
      this.cleanupProcessedMessages();

      this.logger.log(`Found user ${userId} for subscription ${subscriptionId}`);

      // Get access token for this user
      const accessToken = await this.microsoftGraphService.getMicrosoftOAuthTokenFromClerk(userId);
      if (!accessToken) {
        this.logger.error(`No access token for user ${userId} - cannot fetch email`);
        return;
      }

      this.logger.log(`Retrieved access token for user ${userId}, fetching email ${messageId}`);

      // Fetch the email and convert to normalized format
      const emailEvent = await this.microsoftGraphService.toNormalizedEvent(
        userId,
        accessToken,
        messageId,
      );

      if (!emailEvent) {
        this.logger.error(`Failed to fetch email ${messageId} for user ${userId}`);
        return;
      }

      // Get inbox owner's email and org
      const inboxOwner = await this.prismaService.user.findUnique({
        where: { id: userId },
        select: { email: true, organizationId: true },
      });

      if (!inboxOwner?.email) {
        this.logger.error(`No email found for user ${userId}`);
        return;
      }

      userEmail = inboxOwner.email;

      // Check if this inbox is the designated monitoring inbox for the org
      const designatedInboxEmail =
        await this.subscriptionService.resolveDesignatedMonitoringInboxEmailForOrganization(
          inboxOwner.organizationId ?? '',
        );

      if (
        designatedInboxEmail &&
        inboxOwner.email.toLowerCase() !== designatedInboxEmail.toLowerCase()
      ) {
        this.logger.log(
          `Skipping notification from non-designated inbox ${inboxOwner.email} ` +
            `(designated: ${designatedInboxEmail}) for org ${inboxOwner.organizationId}`,
        );
        return;
      }

      // Self-sent: either our bot reply (skip) or user replying to our analysis (run agent)
      if (emailEvent.from.toLowerCase() === inboxOwner.email.toLowerCase()) {
        const messageWithHeaders = await this.microsoftGraphService.getMessage(
          accessToken,
          messageId,
          true,
        );
        if (
          messageWithHeaders &&
          this.microsoftGraphService.hasAnalyzerSentHeader(messageWithHeaders)
        ) {
          this.logger.debug(
            `Skipping our own reply: ${emailEvent.messageId} - "${emailEvent.subject}"`,
          );
          if (userEmail) {
            this.metricsService.recordMicrosoftWebhookRequest(userEmail, 'success');
          }
          return;
        }
        // User reply in thread - enqueue for agent processing
        this.logger.log(
          `Enqueueing user-reply-command: ${emailEvent.messageId} - "${emailEvent.subject}"`,
        );
        await this.sqsService.enqueueUserReplyCommand({
          type: 'user-reply-command',
          event: emailEvent,
          accessToken,
          inboxOwnerEmail: inboxOwner.email,
          receivedByUserId: userId,
          organizationId: inboxOwner.organizationId ?? null,
        });
        if (userEmail) {
          this.metricsService.recordMicrosoftWebhookRequest(userEmail, 'success');
        }
        return;
      }

      this.logger.log(
        `Processing Microsoft email: ${emailEvent.messageId} from ${emailEvent.from} to ${inboxOwner.email} - "${emailEvent.subject}"`,
      );

      // Deal detection - must happen before S3 upload
      const bodyText = emailEvent.bodyText || this.htmlToText(emailEvent.bodyHtml || '');
      const detection = await this.dealDetectionService.isDealEmail(
        emailEvent.subject,
        bodyText,
        emailEvent.attachments.length > 0,
        userId,
        inboxOwner.organizationId,
      );

      if (!detection.isDeal) {
        this.logger.log(
          `Skipping non-deal email: ${emailEvent.messageId} - "${emailEvent.subject}" (${detection.reason})`,
        );
        this.metricsService.recordDealSkipped(detection.reason || 'unknown');
        if (userEmail) {
          this.metricsService.recordMicrosoftWebhookRequest(userEmail, 'success');
        }
        return;
      }

      const dealId = this.generateDealId();

      // Upload attachments to S3 only if it's a deal
      if (emailEvent.attachments.length > 0) {
        await this.uploadAttachmentsToS3(emailEvent, accessToken, dealId);
      }

      // Enqueue to SQS for async processing (attachments already in S3, detection already done)
      await this.sqsService.enqueueNormalizedEmail({
        event: emailEvent,
        accessToken,
        inboxOwnerEmail: inboxOwner.email,
        receivedByUserId: userId,
        organizationId: inboxOwner.organizationId ?? null,
        dealId,
        detection,
      });

      if (userEmail) {
        this.metricsService.recordMicrosoftWebhookRequest(userEmail, 'success');
      }
    } catch (error) {
      if (userEmail) {
        this.metricsService.recordMicrosoftWebhookRequest(userEmail, 'error');
      }
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing email notification ${messageId}: ${msg}`);
      throw error;
    }
  }

  /**
   * Generate a dealId (cuid format, like Prisma's default)
   */
  private generateDealId(): string {
    // Simple cuid-like generator (or use a library)
    // For now, use timestamp + random to create a unique ID
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `deal_${timestamp}_${random}`;
  }

  /**
   * Download attachments from Microsoft Graph and upload to S3
   * Updates emailEvent.attachments with s3Key for each attachment
   */
  private async uploadAttachmentsToS3(
    emailEvent: { messageId: string; attachments: Array<{ contentId: string; filename: string; s3Key?: string }> },
    accessToken: string,
    dealId: string,
  ): Promise<void> {
    for (const att of emailEvent.attachments) {
      // Download attachment content from Microsoft Graph
      const content = await this.microsoftGraphService.getAttachmentContent(
        accessToken,
        emailEvent.messageId,
        att.contentId,
      );

      if (!content) {
        this.logger.warn(`Failed to download attachment ${att.filename}, skipping S3 upload`);
        continue;
      }

      // Upload to S3 using pre-generated dealId
      const s3Key = await this.s3Service.uploadDealAttachment(
        content,
        att.filename,
        dealId,
      );

      // Update attachment with S3 key
      att.s3Key = s3Key;
    }
  }

  private cleanupProcessedMessages(): void {
    const now = Date.now();
    for (const [messageId, timestamp] of this.processedMessages) {
      if (now - timestamp > this.DEDUP_TTL_MS) {
        this.processedMessages.delete(messageId);
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
