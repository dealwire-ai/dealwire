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
import { emailConfig } from '../../config/email.config';

@Controller('webhooks')
export class ResendWebhookController extends BaseWebhookController {
  protected readonly logger = new Logger(ResendWebhookController.name);
  private readonly config = emailConfig();

  constructor(private readonly resendWebhookService: ResendWebhookService) {
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
      this.config.resendWebhookSecret,
    );

    if (body.type !== 'email.received') {
      this.logger.log(`Received webhook event: ${body.type}`);
      return { status: 'ok' };
    }

    try {
      await this.resendWebhookService.handleEmailReceived(body.data || {});
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to process email ${body.data?.email_id}: ${errorMessage}`,
        errorStack,
      );
    }

    return { status: 'ok' };
  }
}
