import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { BaseWebhookController } from './base-webhook.controller';
import { ResendWebhookService } from '../../service/resend/resend-webhook.service';
import { UnderwritingInboundService } from '../../service/underwriting/underwriting-inbound.service';
import { emailConfig } from '../../config/email.config';

@Controller('webhooks')
export class ResendWebhookController extends BaseWebhookController {
  protected readonly logger = new Logger(ResendWebhookController.name);
  private readonly emailConfig = emailConfig();

  constructor(
    private readonly resendWebhookService: ResendWebhookService,
    private readonly underwritingInboundService: UnderwritingInboundService,
  ) {
    super();
  }

  @Post('resend')
  async handleResendWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
    @Body() body: any,
  ) {
    this.verifyWebhook(
      req,
      body,
      svixId,
      svixTimestamp,
      svixSignature,
      this.emailConfig.resendWebhookSecret,
    );

    if (body.type !== 'email.received') {
      this.logger.log(`Received webhook event: ${body.type}`);
      return { status: 'ok' };
    }

    const emailData = body.data || {};

    try {
      if (this.isUnderwritingEmail(emailData)) {
        await this.underwritingInboundService.handleEmail(emailData);
      } else {
        await this.resendWebhookService.handleEmailReceived(emailData);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to process email ${emailData.email_id}: ${errorMessage}`,
        errorStack,
      );
    }

    return { status: 'ok' };
  }

  /**
   * Returns true if any recipient matches the configured underwriting inbound address.
   */
  private isUnderwritingEmail(emailData: any): boolean {
    const underwritingAddr = this.emailConfig.underwritingInboundEmail;
    if (!underwritingAddr) return false;

    const toAddresses: string[] = Array.isArray(emailData.to)
      ? emailData.to
      : [emailData.to || ''];

    return toAddresses.some(
      (addr) => addr.toLowerCase() === underwritingAddr.toLowerCase(),
    );
  }
}
