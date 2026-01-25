import {
  Controller,
  Post,
  Body,
  Query,
  Logger,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { MicrosoftWebhookService } from '../../service/microsoft/microsoft-webhook.service';
import { microsoftConfig } from '../../config/microsoft.config';

@Controller('webhooks')
export class MicrosoftWebhookController {
  private readonly logger = new Logger(MicrosoftWebhookController.name);
  private readonly microsoftConfig = microsoftConfig();

  constructor(
    private readonly microsoftWebhookService: MicrosoftWebhookService,
  ) {}

  /**
   * Microsoft Graph subscription validation and notification endpoint
   *
   * When creating a subscription, Microsoft sends a validation request with
   * a validationToken query parameter. We must echo it back as plain text.
   *
   * For actual notifications, Microsoft POSTs a JSON payload with change data.
   */
  @Post('microsoft')
  @HttpCode(HttpStatus.OK)
  async handleMicrosoftWebhook(
    @Query('validationToken') validationToken: string | undefined,
    @Body() body: any,
  ): Promise<string> {
    // Handle subscription validation
    if (validationToken) {
      this.logger.log('Microsoft Graph subscription validation request');
      // Must return the token as plain text
      return validationToken;
    }

    // Log incoming webhook for debugging
    this.logger.log(
      `Microsoft webhook received: ${body?.value?.length || 0} notification(s)`,
    );

    // Validate clientState to ensure notification is from our subscription
    if (body?.value) {
      for (const notification of body.value) {
        if (notification.clientState !== this.microsoftConfig.webhookSecret) {
          this.logger.warn(
            `Invalid clientState in notification. Expected: ${this.microsoftConfig.webhookSecret?.substring(0, 8)}..., Got: ${notification.clientState?.substring(0, 8)}...`,
          );
          throw new BadRequestException('Invalid clientState');
        }
      }
    }

    // Process notifications asynchronously
    try {
      await this.microsoftWebhookService.handleNotifications(body);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Error processing Microsoft webhook: ${msg}`, stack);
    }

    // Always return 200 to acknowledge receipt
    return 'OK';
  }
}


