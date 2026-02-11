import { Injectable, Logger, Optional } from '@nestjs/common';
import { SqsService } from '@ssut/nestjs-sqs';
import { NormalizedEmailEvent } from '../../dto/normalized-email-event.dto';
import { MetricsService } from '../metrics/metrics.service';
import { DealDetection } from '../deal/deal-detection.service';

interface QueuedEmailMessage {
  event: NormalizedEmailEvent;
  accessToken: string;
  inboxOwnerEmail: string;
  receivedByUserId: string;
  organizationId: string | null;
  dealId: string;
  detection: DealDetection; // Deal detection result (done in webhook)
}

/** User reply in thread (self-sent) - run agent, update prefs, reply in thread */
interface QueuedUserReplyCommand {
  type: 'user-reply-command';
  event: NormalizedEmailEvent;
  accessToken: string;
  inboxOwnerEmail: string;
  receivedByUserId: string;
  organizationId: string | null;
}

@Injectable()
export class SQSService {
  private readonly logger = new Logger(SQSService.name);

  constructor(
    @Optional() private readonly sqsService: SqsService,
    private readonly metricsService: MetricsService,
  ) {
    if (!sqsService) {
      this.logger.warn('SQS is disabled - enqueue operations will fail');
    }
  }

  /**
   * Enqueue a normalized email event to the queue
   */
  async enqueueNormalizedEmail(messageBody: QueuedEmailMessage): Promise<void> {
    if (!this.sqsService) {
      this.logger.warn('SQS is disabled - skipping enqueue');
      return;
    }

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

  /**
   * Enqueue a user reply command (self-sent email without X-Analyzer-Sent = user replying to our analysis)
   * Same queue as normalized-email; listener branches on type.
   */
  async enqueueUserReplyCommand(messageBody: QueuedUserReplyCommand): Promise<void> {
    if (!this.sqsService) {
      this.logger.warn('SQS is disabled - skipping enqueue');
      return;
    }

    try {
      this.logger.log(
        `Enqueueing user-reply-command: ${messageBody.event?.messageId} from ${messageBody.inboxOwnerEmail} - "${messageBody.event?.subject}"`,
      );

      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 10);
      const id = `user-reply-${timestamp}-${random}`.substring(0, 80);

      await this.sqsService.send('normalized-email', {
        id,
        body: messageBody,
      });
      this.metricsService.recordSqsMessageSent('normalized-email', 'success');
      this.logger.debug(`User-reply-command sent to normalized-email queue: ${messageBody.event?.messageId}`);
    } catch (error) {
      this.metricsService.recordSqsMessageSent('normalized-email', 'error');
      this.metricsService.recordSqsError('normalized-email', 'send');
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send user-reply-command: ${msg}`);
      throw error;
    }
  }
}
