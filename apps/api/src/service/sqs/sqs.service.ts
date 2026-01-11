import { Injectable, Logger } from '@nestjs/common';
import { SqsService } from '@ssut/nestjs-sqs';

@Injectable()
export class SQSService {
  private readonly logger = new Logger(SQSService.name);

  constructor(private readonly sqsService: SqsService) {}

  /**
   * Send a normalized email event to the queue
   */
  async enqueueNormalizedEmail(messageBody: unknown): Promise<void> {
    try {
      // Generate a valid batch entry ID: alphanumeric, hyphens, underscores only, max 80 chars
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 10); // Base36, no decimals
      const id = `email-${timestamp}-${random}`.substring(0, 80); // Ensure max 80 chars
      
      await this.sqsService.send('normalized-email', {
        id,
        body: messageBody,
      });
      this.logger.debug('Message enqueued to normalized-email queue');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to enqueue message: ${msg}`);
      throw error;
    }
  }
}
