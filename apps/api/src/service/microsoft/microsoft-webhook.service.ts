import { Injectable, Logger } from '@nestjs/common';
import { MicrosoftGraphService } from './microsoft-graph.service';
import { MicrosoftSubscriptionService } from './microsoft-subscription.service';
import { PrismaService } from '../prisma/prisma.service';
import { SQSService } from '../sqs/sqs.service';
import { S3Service } from '../s3/s3.service';
import { MetricsService } from '../metrics/metrics.service';

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
  ) {}

  /**
   * Process notifications from Microsoft Graph
   */
  async handleNotifications(payload: GraphNotificationPayload): Promise<void> {
    if (!payload?.value || !Array.isArray(payload.value)) {
      this.logger.debug('Received non-notification payload (lifecycle event or empty)');
      return;
    }

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

    // Dedup check - skip if we've already processed this message recently
    const now = Date.now();
    if (this.processedMessages.has(messageId)) {
      this.logger.debug(`Skipping duplicate notification for ${messageId}`);
      return;
    }
    // Mark as processed and clean up old entries
    this.processedMessages.set(messageId, now);
    this.cleanupProcessedMessages();

    // Find which user this subscription belongs to
    const userId =
      await this.subscriptionService.getUserBySubscriptionId(subscriptionId);
    if (!userId) {
      this.logger.warn(`Unknown subscription ${subscriptionId}`);
      return;
    }

    // Get access token for this user
    const accessToken = await this.microsoftGraphService.getAccessToken(userId);
    if (!accessToken) {
      this.logger.error(`No access token for user ${userId}`);
      return;
    }

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

    // Skip emails from the user themselves (prevents infinite loop from reply-to-self)
    if (emailEvent.from.toLowerCase() === inboxOwner.email.toLowerCase()) {
      this.logger.debug(
        `Skipping self-sent email: ${emailEvent.messageId} - "${emailEvent.subject}"`,
      );
      return;
    }

    this.logger.log(
      `Processing Microsoft email: ${emailEvent.messageId} from ${emailEvent.from} to ${inboxOwner.email} - "${emailEvent.subject}"`,
    );

    // Generate a dealId UUID for S3 organization (will be used when creating Deal record)
    // This ensures attachments are organized correctly even before Deal is created
    const dealId = this.generateDealId();

    // Upload attachments to S3 before enqueueing
    // This decouples processing from Microsoft Graph API
    if (emailEvent.attachments.length > 0) {
      await this.uploadAttachmentsToS3(emailEvent, accessToken, dealId);
    }

    this.logger.log(
      `Enqueueing Microsoft email: ${emailEvent.messageId} from ${emailEvent.from} to ${inboxOwner.email} - "${emailEvent.subject}"`,
    );

    // Enqueue to SQS for async processing (attachments already in S3)
    await this.sqsService.enqueueNormalizedEmail({
      event: emailEvent,
      accessToken,
      inboxOwnerEmail: inboxOwner.email,
      receivedByUserId: userId,
      organizationId: inboxOwner.organizationId || undefined,
      dealId, // Pre-generated dealId for S3 organization
    });

    this.logger.log(`Email enqueued: ${emailEvent.messageId}`);
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
      try {
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
        this.logger.log(`Uploaded attachment ${att.filename} to S3: ${s3Key}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.error(`Failed to upload attachment ${att.filename} to S3: ${msg}`);
        // Continue with other attachments even if one fails
      }
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
}
