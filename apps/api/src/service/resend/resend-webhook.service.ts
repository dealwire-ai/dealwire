import { Injectable, Logger } from '@nestjs/common';
import { EmailProcessingService } from '../email/email-processing.service';
import { EmailSenderService } from '../email/email-sender.service';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { DealDetectionService } from '../deal/deal-detection.service';
import { SQSService } from '../sqs/sqs.service';
import { S3Service } from '../s3/s3.service';
import { NormalizedEmailEvent, NormalizedEmailAttachment } from '../../dto/normalized-email-event.dto';

@Injectable()
export class ResendWebhookService {
  private readonly logger = new Logger(ResendWebhookService.name);

  constructor(
    private readonly emailProcessing: EmailProcessingService,
    private readonly emailSender: EmailSenderService,
    private readonly metricsService: MetricsService,
    private readonly prisma: PrismaService,
    private readonly dealDetectionService: DealDetectionService,
    private readonly sqsService: SQSService,
    private readonly s3Service: S3Service,
  ) {}

  async handleEmailReceived(emailData: any): Promise<void> {
    const emailId = emailData.email_id;
    let userEmail: string | null = null;

    try {
      this.metricsService.recordEmailReceived('resend');

      this.logger.log(
        `Email received: ${emailId} from ${emailData.from} to ${emailData.to} - "${emailData.subject}"`,
      );

      // Convert Resend email to normalized format
      const emailEvent = await this.toNormalizedEvent(emailData);
      if (!emailEvent) {
        this.logger.error(`Failed to convert Resend email ${emailId} to normalized format`);
        return;
      }

      // Look up user and organization
      const forwarderEmail = emailData.from || '';
      let userId: string | undefined;
      let organizationId: string | null = null;

      if (forwarderEmail) {
        try {
          const user = await this.prisma.user.findUnique({
            where: { email: forwarderEmail },
            select: { id: true, organizationId: true },
          });
          userId = user?.id;
          organizationId = user?.organizationId || null;
          userEmail = forwarderEmail;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Failed to lookup user for ${forwarderEmail}: ${msg}`);
        }
      }

      // Deal detection - must happen before S3 upload
      const bodyText = emailEvent.bodyText || this.htmlToText(emailEvent.bodyHtml || '');
      const detection = await this.dealDetectionService.isDealEmail(
        emailEvent.subject,
        bodyText,
        emailEvent.attachments.length > 0,
        userId,
        organizationId,
      );

      if (!detection.isDeal) {
        this.logger.log(
          `Skipping non-deal email: ${emailId} - "${emailEvent.subject}" (${detection.reason})`,
        );
        this.metricsService.recordDealSkipped(detection.reason || 'unknown');
        return;
      }

      const dealId = this.generateDealId();

      // Upload attachments to S3 only if it's a deal
      if (emailEvent.attachments.length > 0) {
        await this.uploadAttachmentsToS3(emailEvent, dealId);
      }

      // Enqueue to SQS for async processing (attachments already in S3, detection already done)
      await this.sqsService.enqueueNormalizedEmail({
        event: emailEvent,
        accessToken: '', // Resend doesn't need access token
        inboxOwnerEmail: forwarderEmail || emailEvent.to[0] || '',
        receivedByUserId: userId || '',
        organizationId: organizationId ?? null,
        dealId,
        detection,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error processing Resend email ${emailId}: ${msg}`);
      throw error;
    }
  }

  /**
   * Convert Resend webhook payload to NormalizedEmailEvent format
   */
  private async toNormalizedEvent(emailData: any): Promise<NormalizedEmailEvent | null> {
    try {
      const emailId = emailData.email_id;
      
      // Fetch email body from Resend API
      const { text: emailBodyText } = await this.emailProcessing.extractEmailBody(emailId);
      const emailHtml = emailData.html || '';
      
      // Fetch attachments metadata
      const attachmentsMetadata = emailData.attachments || [];
      const attachments: NormalizedEmailAttachment[] = [];

      if (attachmentsMetadata.length > 0) {
        const fetchedAttachments = await this.emailProcessing.fetchAttachments(emailId);
        for (const att of fetchedAttachments) {
          attachments.push({
            filename: att.filename,
            contentType: att.contentType,
            size: att.size,
            contentId: att.downloadUrl, // For Resend, contentId is the downloadUrl
          });
        }
      }

      return {
        source: 'resend',
        messageId: emailId,
        from: emailData.from || '',
        to: Array.isArray(emailData.to) ? emailData.to : [emailData.to || ''],
        subject: emailData.subject || '',
        bodyHtml: emailHtml,
        bodyText: emailBodyText,
        attachments,
        receivedAt: emailData.created_at ? new Date(emailData.created_at) : new Date(),
        rawData: emailData,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to convert Resend email to normalized format: ${msg}`);
      return null;
    }
  }

  /**
   * Download attachments from Resend and upload to S3
   * Updates emailEvent.attachments with s3Key for each attachment
   */
  private async uploadAttachmentsToS3(
    emailEvent: { attachments: Array<{ contentId: string; filename: string; s3Key?: string }> },
    dealId: string,
  ): Promise<void> {
    for (const att of emailEvent.attachments) {
      try {
        // Download attachment content from Resend (contentId is the downloadUrl)
        const response = await fetch(att.contentId);
        if (!response.ok) {
          this.logger.warn(`Failed to download attachment ${att.filename}, skipping S3 upload`);
          continue;
        }

        const arrayBuffer = await response.arrayBuffer();
        const content = Buffer.from(arrayBuffer);

        // Upload to S3 using pre-generated dealId
        const s3Key = await this.s3Service.uploadDealAttachment(
          content,
          att.filename,
          dealId,
        );

        // Update attachment with S3 key
        att.s3Key = s3Key;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to upload attachment ${att.filename} to S3: ${msg}`);
      }
    }
  }

  /**
   * Generate a dealId (cuid format, like Prisma's default)
   */
  private generateDealId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    return `deal_${timestamp}_${random}`;
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
