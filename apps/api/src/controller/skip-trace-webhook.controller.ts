import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TracerfyProvider } from '../service/public-data/tracerfy.provider';

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

  constructor(private readonly tracerfy: TracerfyProvider) {}

  @Post('tracerfy')
  @HttpCode(HttpStatus.OK)
  handleTracerfyWebhook(@Body() payload: Record<string, unknown>) {
    const rawId = payload.id ?? payload.queue_id;
    const queueId = rawId != null ? `${rawId as string | number}` : 'unknown';
    this.logger.log(`Received Tracerfy webhook, queue_id=${queueId}`);
    this.tracerfy.handleWebhookPayload(payload);
    return { ok: true };
  }
}
