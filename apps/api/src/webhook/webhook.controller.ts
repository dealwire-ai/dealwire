import {
  Controller,
  Post,
  Body,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Webhook } from 'svix';
import { emailConfig } from '../config/email.config';
import { EmailSenderService } from '../email/services/email-sender.service';
import { EmailProcessingService } from '../email/services/email-processing.service';
import { EmailTemplateService } from '../email/services/email-template.service';
import { ClientPreferencesService } from '../config/client-preferences.service';
import { DealSummaryService } from '../ai/deal-summary.service';
import { DealDecisionService } from '../ai/deal-decision.service';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);
  private readonly config = emailConfig();

  constructor(
    private readonly emailSender: EmailSenderService,
    private readonly emailProcessing: EmailProcessingService,
    private readonly emailTemplate: EmailTemplateService,
    private readonly clientPreferences: ClientPreferencesService,
    private readonly dealSummary: DealSummaryService,
    private readonly dealDecision: DealDecisionService,
  ) {}

  @Post('resend')
  async handleResendWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
    @Body() body: any,
  ) {
    // Verify webhook signature
    try {
      if (!svixId || !svixTimestamp || !svixSignature) {
        throw new HttpException(
          'Missing webhook headers',
          HttpStatus.UNAUTHORIZED,
        );
      }

      const wh = new Webhook(this.config.resendWebhookSecret);

      // Get raw body for verification
      const rawBody = req.rawBody || Buffer.from(JSON.stringify(body));

      wh.verify(rawBody.toString(), {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Webhook verification failed: ${errorMessage}`);
      throw new HttpException(
        'Invalid webhook signature',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Process email.received events
    if (body.type !== 'email.received') {
      this.logger.log(`Received webhook event: ${body.type}`);
      return { status: 'ok' };
    }

    const emailData = body.data || {};
    const emailId = emailData.email_id;
    const attachmentsMetadata = emailData.attachments || [];

    this.logger.log(
      `Email received: ${emailId} from ${emailData.from} to ${emailData.to} - "${emailData.subject}" (${attachmentsMetadata.length} attachments)`,
    );

    try {
      // Extract all text from email
      const allExtractedText = await this.emailProcessing.extractAllText(
        emailId,
        attachmentsMetadata,
      );

      if (allExtractedText.length === 0) {
        this.logger.log(`No text extracted from email ${emailId}`);
        return { status: 'ok' };
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

      this.logger.log(
        `Generated summary for ${emailId} (${summary.length} chars)`,
      );

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
        return { status: 'ok' };
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
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to process email ${emailId}: ${errorMessage}`,
        errorStack,
      );
    }

    return { status: 'ok' };
  }
}
