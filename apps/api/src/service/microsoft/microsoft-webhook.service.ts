import { Injectable, Logger } from '@nestjs/common';
import { MicrosoftGraphService } from './microsoft-graph.service';
import { MicrosoftSubscriptionService } from './microsoft-subscription.service';
import { EmailProcessingService } from '../email/email-processing.service';
import { EmailSenderService } from '../email/email-sender.service';
import { EmailTemplateService } from '../email/email-template.service';
import { ClientPreferencesService } from '../preferences/client-preferences.service';
import { DealSummaryService } from '../ai/deal-summary.service';
import { DealDecisionService } from '../ai/deal-decision.service';
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

  constructor(
    private readonly graphService: MicrosoftGraphService,
    private readonly subscriptionService: MicrosoftSubscriptionService,
    private readonly emailProcessing: EmailProcessingService,
    private readonly emailSender: EmailSenderService,
    private readonly emailTemplate: EmailTemplateService,
    private readonly clientPreferences: ClientPreferencesService,
    private readonly dealSummary: DealSummaryService,
    private readonly dealDecision: DealDecisionService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Process notifications from Microsoft Graph
   */
  async handleNotifications(payload: GraphNotificationPayload): Promise<void> {
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

    // Find which user this subscription belongs to
    const userId =
      await this.subscriptionService.getUserBySubscriptionId(subscriptionId);
    if (!userId) {
      this.logger.warn(`Unknown subscription ${subscriptionId}`);
      return;
    }

    // Get access token for this user
    const accessToken = await this.graphService.getAccessToken(userId);
    if (!accessToken) {
      this.logger.error(`No access token for user ${userId}`);
      return;
    }

    // Fetch the email and convert to normalized format
    const emailEvent = await this.graphService.toNormalizedEvent(
      userId,
      accessToken,
      messageId,
    );

    if (!emailEvent) {
      this.logger.error(`Failed to fetch email ${messageId} for user ${userId}`);
      return;
    }

    // Get inbox owner's email for preferences and reply
    const inboxOwner = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!inboxOwner?.email) {
      this.logger.error(`No email found for user ${userId}`);
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
    const recipientEmail = inboxOwnerEmail || event.from;

    // Extract text from email body
    const allExtractedText: string[] = [];

    // Get body text
    const bodyText = event.bodyText || this.htmlToText(event.bodyHtml || '');
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
          const content = await this.graphService.getAttachmentContent(
            accessToken,
            event.messageId,
            att.contentId,
          );
          if (content) {
            const text = await this.emailProcessing.processPdfBuffer(content);
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
    const clientPrefs = this.clientPreferences.getPreferences(recipientEmail);

    // Generate AI summary
    const summary = await this.dealSummary.summarizeDeal(
      combinedText,
      clientPrefs.dealCriteria,
    );

    this.logger.log(
      `Generated summary for ${event.messageId} (${summary.length} chars)`,
    );

    // Make deal decision
    const decision = await this.dealDecision.makeDecision(
      summary,
      clientPrefs.dealCriteria,
    );

    this.logger.log(
      `Decision for ${event.messageId}: ${decision.decision} - ${decision.reason}`,
    );

    // Send reply to the inbox owner (our user), not the original sender
    if (!recipientEmail) {
      this.logger.warn(`No recipient email for ${event.messageId}`);
      return;
    }

    const replySubject = event.subject
      ? `Re: ${event.subject}`
      : 'Deal Summary';

    const htmlEmail = this.emailTemplate.formatSummaryAsHtml(
      summary,
      decision,
      clientPrefs.logoUrl,
      clientPrefs.companyName,
      clientPrefs.brandColor,
    );

    await this.emailSender.sendEmail({
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
}


