import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SkipTraceService } from '../service/public-data/skip-trace.service';

/**
 * Receives Tracerfy webhook callbacks when a skip trace queue completes.
 * No auth guard — Tracerfy sends these directly. Configure the URL in your
 * Tracerfy account settings: https://tracerfy.com/settings/api/
 *
 * Webhook URL: POST /webhooks/tracerfy
 */
@Controller('webhooks')
export class SkipTraceWebhookController {
  private readonly logger = new Logger(SkipTraceWebhookController.name);

  constructor(private readonly skipTrace: SkipTraceService) {}

  @Post('tracerfy')
  @HttpCode(HttpStatus.OK)
  async handleTracerfyWebhook(@Body() payload: Record<string, unknown>) {
    this.logger.log(
      `Received Tracerfy webhook, queue_id=${payload.id ?? payload.queue_id ?? 'unknown'}`,
    );
    await this.skipTrace.handleWebhook(payload);
    return { ok: true };
  }
}
