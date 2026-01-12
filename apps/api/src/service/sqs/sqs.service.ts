import { Injectable, Logger } from '@nestjs/common';
import { SqsService } from '@ssut/nestjs-sqs';
import { NormalizedEmailEvent } from '../../dto/normalized-email-event.dto';
import { MetricsService } from '../metrics/metrics.service';

interface QueuedEmailMessage {
  event: NormalizedEmailEvent;
  accessToken: string;
  inboxOwnerEmail: string;
  receivedByUserId: string;
  organizationId: string | null;
  dealId: string;
}

@Injectable()
export class SQSService {
  private readonly logger = new Logger(SQSService.name);

  constructor(
    private readonly sqsService: SqsService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Enqueue a normalized email event to the queue
   */
  async enqueueNormalizedEmail(messageBody: QueuedEmailMessage): Promise<void> {
    try {
      this.logger.log(
        `Enqueueing normalized email: ${messageBody.event?.messageId} from ${messageBody.event?.from} to ${messageBody.inboxOwnerEmail} - "${messageBody.event?.subject}"`,
      );

      // Generate a valid batch entry ID: alphanumeric, hyphens, underscores only, max 80 chars
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 10); // Base36, no decimals
      const id = `email-${timestamp}-${random}`.substring(0, 80); // Ensure max 80 chars
      
      await this.sqsService.send('normalized-email', {
        id,
        body: messageBody,
      });
      this.metricsService.recordSqsMessageSent('normalized-email', 'success');
      this.logger.debug(`Message sent to normalized-email queue: ${messageBody.event?.messageId} from ${messageBody.event?.from} to ${messageBody.inboxOwnerEmail} - "${messageBody.event?.subject}"`);
    } catch (error) {
      this.metricsService.recordSqsMessageSent('normalized-email', 'error');
      this.metricsService.recordSqsError('normalized-email', 'send');
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send message: ${msg}`);
      throw error;
    }
  }
}
