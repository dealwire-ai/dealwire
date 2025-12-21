import { Injectable, Logger } from '@nestjs/common';
import { EmailProcessingService } from '../email/email-processing.service';
import { EmailSenderService } from '../email/email-sender.service';
import { EmailTemplateService } from '../email/email-template.service';
import { ClientPreferencesService } from '../preferences/client-preferences.service';
import { DealSummaryService } from '../ai/deal-summary.service';
import { DealDecisionService } from '../ai/deal-decision.service';

@Injectable()
export class ResendWebhookService {
  private readonly logger = new Logger(ResendWebhookService.name);

  constructor(
    private readonly emailProcessing: EmailProcessingService,
    private readonly emailSender: EmailSenderService,
    private readonly emailTemplate: EmailTemplateService,
    private readonly clientPreferences: ClientPreferencesService,
    private readonly dealSummary: DealSummaryService,
    private readonly dealDecision: DealDecisionService,
  ) {}

  async handleEmailReceived(emailData: any): Promise<void> {
    const emailId = emailData.email_id;
    const attachmentsMetadata = emailData.attachments || [];

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
    const clientPrefs = this.clientPreferences.getPreferences(forwarderEmail);

    // Generate AI summary with client-specific criteria
    const summary = await this.dealSummary.summarizeDeal(
      combinedText,
      clientPrefs.dealCriteria,
    );

    this.logger.log(`Generated summary for ${emailId} (${summary.length} chars)`);

    // Make deal decision based on summary and criteria
    const decision = await this.dealDecision.makeDecision(
      summary,
      clientPrefs.dealCriteria,
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
      clientPrefs.logoUrl,
      clientPrefs.companyName,
      clientPrefs.brandColor,
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
