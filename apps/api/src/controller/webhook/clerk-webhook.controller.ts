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
import { ClerkWebhookService } from '../../service/clerk/clerk-webhook.service';
import { clerkConfig } from '../../config/clerk.config';

@Controller('webhooks')
export class ClerkWebhookController extends BaseWebhookController {
  protected readonly logger = new Logger(ClerkWebhookController.name);
  private readonly clerkConfig = clerkConfig();

  constructor(private readonly clerkWebhookService: ClerkWebhookService) {
    super();
  }

  @Post('clerk')
  async handleClerkWebhook(
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
      this.clerkConfig.webhookSecret,
    );

    this.logger.log(`Clerk webhook received: ${body.type}`);

    try {
      await this.clerkWebhookService.handleEvent(body.type, body.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process Clerk event ${body.type}: ${errorMessage}`);
    }

    return { status: 'ok' };
  }
}
