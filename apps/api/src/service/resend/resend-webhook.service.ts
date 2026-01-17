import { Injectable, Logger } from '@nestjs/common';
import { EmailProcessingService } from '../email/email-processing.service';
import { EmailSenderService } from '../email/email-sender.service';
import { EmailTemplateService } from '../email/email-template.service';
import { ScreeningPreferencesService } from '../preferences/screening-preferences.service';
import { DealSummaryService } from '../deal/deal-summary.service';
import { DealDecisionService } from '../deal/deal-decision.service';
import { MetricsService } from '../metrics/metrics.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ResendWebhookService {
  private readonly logger = new Logger(ResendWebhookService.name);

  constructor(
    private readonly emailProcessing: EmailProcessingService,
    private readonly emailSender: EmailSenderService,
    private readonly emailTemplate: EmailTemplateService,
    private readonly screeningPreferences: ScreeningPreferencesService,
    private readonly dealSummary: DealSummaryService,
    private readonly dealDecision: DealDecisionService,
    private readonly metricsService: MetricsService,
    private readonly prisma: PrismaService,
  ) {}

  async handleEmailReceived(emailData: any): Promise<void> {
    const emailId = emailData.email_id;
    const attachmentsMetadata = emailData.attachments || [];

    this.metricsService.recordEmailReceived('resend');

    this.logger.log(
      `Email received: ${emailId} from ${emailData.from} to ${emailData.to} - "${emailData.subject}" (${attachmentsMetadata.length} attachments)`,
    );

    // Extract all text from email
    const allExtractedText = await this.emailProcessing.extractAllText(
      emailId,
      attachmentsMetadata,
    );

    if (allExtractedText.length === 0) {
      this.logger.log(`No text extracted from email ${emailId}`);
      return;
    }

    const combinedText = allExtractedText.join('\n\n');

    // Look up client preferences for personalized analysis
    const forwarderEmail = emailData.from || '';
    let organizationId: string | null = null;
    
    if (forwarderEmail) {
      try {
        const user = await this.prisma.user.findUnique({
          where: { email: forwarderEmail },
          select: { organizationId: true },
        });
        organizationId = user?.organizationId || null;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Failed to lookup user for ${forwarderEmail}: ${msg}`);
      }
    }
    
    const prefs = await this.screeningPreferences.getPreferences(organizationId);

    // Generate AI summary with client-specific criteria
    const summary = await this.dealSummary.summarizeDeal(
      combinedText,
      prefs.dealCriteria,
    );

    this.logger.log(`Generated summary for ${emailId} (${summary.length} chars)`);

    // Make deal decision based on summary and criteria
    const decision = await this.dealDecision.makeDecision(
      summary,
      prefs.dealCriteria,
    );

    this.logger.log(
      `Made decision for ${emailId}: ${decision.decision} - ${decision.reason}`,
    );

    // Send reply email
    if (!forwarderEmail) {
      this.logger.warn(`No forwarder email for ${emailId}`);
      return;
    }

    const originalSubject = emailData.subject || '';
    const originalMessageId = emailData.message_id || '';

    const replySubject = originalSubject
      ? `Re: ${originalSubject}`
      : 'Deal Summary';

    const htmlEmail = this.emailTemplate.formatSummaryAsHtml(
      summary,
      decision,
      prefs.logoUrl,
      prefs.companyName,
      prefs.brandColor,
    );

    await this.emailSender.sendEmail({
      to: [forwarderEmail],
      subject: replySubject,
      html: htmlEmail,
      text: summary,
      replyToMessageId: originalMessageId,
    });

    this.logger.log(`Reply sent for ${emailId} to ${forwarderEmail}`);
  }
}
