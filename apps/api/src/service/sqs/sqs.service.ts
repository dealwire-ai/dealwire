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
      await this.sqsService.send('normalized-email', {
        id: `email-${Date.now()}-${Math.random()}`,
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
