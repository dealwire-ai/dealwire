import { Injectable, Logger } from '@nestjs/common';
import { MicrosoftGraphService } from './microsoft-graph.service';
import { MicrosoftSubscriptionService } from './microsoft-subscription.service';
import { EmailProcessingService } from '../email/email-processing.service';
import { EmailSenderService } from '../email/email-sender.service';
import { EmailTemplateService } from '../email/email-template.service';
import { ClientPreferencesService } from '../preferences/client-preferences.service';
import { DealSummaryService } from '../ai/deal-summary.service';
import { DealDecisionService } from '../ai/deal-decision.service';
import { DealDetectionService } from '../ai/deal-detection.service';
import { PrismaService } from '../prisma/prisma.service';
import { NormalizedEmailEvent } from '../../dto/normalized-email-event.dto';

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
    private readonly emailProcessingService: EmailProcessingService,
    private readonly emailSenderService: EmailSenderService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly clientPreferencesService: ClientPreferencesService,
    private readonly dealSummaryService: DealSummaryService,
    private readonly dealDecisionService: DealDecisionService,
    private readonly dealDetectionService: DealDetectionService,
    private readonly prismaService: PrismaService,
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

    // Get inbox owner's email for preferences and reply
    const inboxOwner = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { email: true },
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

    await this.processNormalizedEmail(emailEvent, accessToken, inboxOwner.email);
  }

  /**
   * Process a normalized email event
   * @param inboxOwnerEmail - For Microsoft: the user's email (recipient). For Resend: undefined (uses sender).
   */
  async processNormalizedEmail(
    event: NormalizedEmailEvent,
    accessToken?: string,
    inboxOwnerEmail?: string,
  ): Promise<void> {
    // For Microsoft emails, the inbox owner is the recipient (our user)
    // For Resend emails (forwarded), the sender is our client
    const recipientEmail = inboxOwnerEmail;

    if (!recipientEmail) {
      this.logger.warn(`No recipient email for ${event.messageId}`);
      return;
    }

    // Get body text for detection
    const bodyText = event.bodyText || this.htmlToText(event.bodyHtml || '');

    // Quick check: is this a deal-related email?
    const detection = await this.dealDetectionService.isDealEmail(
      event.subject,
      bodyText,
      event.attachments.length > 0,
    );

    if (!detection.isDeal) {
      this.logger.log(
        `Skipping non-deal email: ${event.messageId} - "${event.subject}" (${detection.reason})`,
      );
      return;
    }

    // Extract text from email body
    const allExtractedText: string[] = [];

    if (bodyText) {
      allExtractedText.push(`--- Email Body Text ---\n${bodyText}`);
    }

    // Process attachments if Microsoft source
    if (event.source === 'microsoft' && accessToken && event.attachments.length > 0) {
      for (const att of event.attachments) {
        if (
          att.contentType === 'application/pdf' ||
          att.filename.toLowerCase().endsWith('.pdf')
        ) {
          const content = await this.microsoftGraphService.getAttachmentContent(
            accessToken,
            event.messageId,
            att.contentId,
          );
          if (content) {
            const text = await this.emailProcessingService.processPdfBuffer(content);
            if (text) {
              allExtractedText.push(`--- ${att.filename} ---\n${text}`);
            }
          }
        }
      }
    }

    if (allExtractedText.length === 0) {
      this.logger.log(`No text extracted from email ${event.messageId}`);
      return;
    }

    const combinedText = allExtractedText.join('\n\n');

    // Look up client preferences using the inbox owner's email
    const clientPrefs = this.clientPreferencesService.getPreferences(recipientEmail);

    // Generate AI summary
    const summary = await this.dealSummaryService.summarizeDeal(
      combinedText,
      clientPrefs.dealCriteria,
    );

    this.logger.log(
      `Generated summary for ${event.messageId} (${summary.length} chars)`,
    );

    // Make deal decision
    const decision = await this.dealDecisionService.makeDecision(
      summary,
      clientPrefs.dealCriteria,
    );

    this.logger.log(
      `Decision for ${event.messageId}: ${decision.decision} - ${decision.reason}`,
    );

    // Send reply
    if (!recipientEmail) {
      this.logger.warn(`No recipient email for ${event.messageId}`);
      return;
    }

    const htmlEmail = this.emailTemplateService.formatSummaryAsHtml(
      summary,
      decision,
      clientPrefs.logoUrl,
      clientPrefs.companyName,
      clientPrefs.brandColor,
    );

    // For Microsoft emails, reply to self via Graph API to stay in thread
    if (event.source === 'microsoft' && accessToken) {
      const success = await this.microsoftGraphService.replyToSelf(
        accessToken,
        event.messageId,
        recipientEmail,
        htmlEmail,
      );
      if (success) {
        this.logger.log(`Reply-to-self sent via Graph for ${event.messageId}`);
      } else {
        this.logger.error(`Failed to send Graph reply for ${event.messageId}`);
      }
      return;
    }

    // Fallback to Resend for non-Microsoft emails
    const replySubject = event.subject
      ? `Re: ${event.subject}`
      : 'Deal Summary';

    await this.emailSenderService.sendEmail({
      to: [recipientEmail],
      subject: replySubject,
      html: htmlEmail,
      text: summary,
    });

    this.logger.log(`Reply sent for ${event.messageId} to ${recipientEmail}`);
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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


