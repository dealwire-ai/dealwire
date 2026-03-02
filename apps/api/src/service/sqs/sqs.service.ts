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
   * Enqueue a document package for underwriting processing.
   * Documents must already be uploaded to S3 before calling this.
   */
  async enqueueUnderwritingJob(messageBody: {
    type: 'underwriting-job';
    dealId: string;
    orgId: string;
    senderEmail: string;
    documents: Array<{ s3Key: string; filename: string; contentType: string }>;
  }): Promise<void> {
    if (!this.sqsService) {
      this.logger.warn('SQS is disabled - skipping underwriting enqueue');
      return;
    }

    try {
      this.logger.log(`Enqueueing underwriting job: dealId=${messageBody.dealId} docs=${messageBody.documents.map((d) => d.filename).join(', ')}`);

      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 10);
      const id = `underwriting-${timestamp}-${random}`.substring(0, 80);

      await this.sqsService.send('underwriting', { id, body: messageBody });
      this.metricsService.recordSqsMessageSent('underwriting', 'success');
    } catch (error) {
      this.metricsService.recordSqsMessageSent('underwriting', 'error');
      this.metricsService.recordSqsError('underwriting', 'send');
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to enqueue underwriting job: ${msg}`);
      throw error;
    }
  }

}
