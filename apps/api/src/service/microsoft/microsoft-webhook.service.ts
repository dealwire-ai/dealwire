import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { MicrosoftGraphService } from './microsoft-graph.service';
import { MicrosoftSubscriptionService } from './microsoft-subscription.service';
import { PrismaService } from '../prisma/prisma.service';
import { DealProcessorService } from '../deal/deal-processor.service';

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
    @Inject(forwardRef(() => DealProcessorService))
    private readonly dealProcessorService: DealProcessorService,
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

    // Delegate to deal processor
    const result = await this.dealProcessorService.processDeal({
      event: emailEvent,
      accessToken,
      inboxOwnerEmail: inboxOwner.email,
      receivedByUserId: userId,
      organizationId: inboxOwner.organizationId || undefined,
    });

    if (result.processed) {
      this.logger.log(
        `Deal processed: ${result.dealId || 'not saved'}, decision: ${result.decision}`,
      );
    } else {
      this.logger.log(`Email skipped: ${result.skippedReason}`);
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
