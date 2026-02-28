import { Injectable, Logger } from '@nestjs/common';
import { SqsMessageHandler, SqsConsumerEventHandler } from '@ssut/nestjs-sqs';
import { Message } from '@aws-sdk/client-sqs';
import { UnderwritingPipelineService, UnderwritingJobContext } from './underwriting-pipeline.service';

export interface UnderwritingJobMessage {
  type: 'underwriting-job';
  dealId: string;
  orgId: string;
  documents: Array<{
    s3Key: string;
    filename: string;
    contentType: string;
  }>;
}

@Injectable()
export class UnderwritingListenerService {
  private readonly logger = new Logger(UnderwritingListenerService.name);

  constructor(private readonly pipeline: UnderwritingPipelineService) {}

  @SqsMessageHandler('underwriting', false)
  async handleMessage(message: Message): Promise<void> {
    if (!message.Body) {
      this.logger.warn('Received underwriting message without body');
      return;
    }

    let parsed: UnderwritingJobMessage;
    try {
      parsed = JSON.parse(message.Body) as UnderwritingJobMessage;
    } catch {
      this.logger.error('Failed to parse underwriting message body — discarding');
      return;
    }

    if (parsed.type !== 'underwriting-job') {
      this.logger.warn(`Unknown message type: ${parsed.type} — discarding`);
      return;
    }

    if (!parsed.dealId || !parsed.orgId || !parsed.documents?.length) {
      this.logger.error(`Invalid underwriting message — missing required fields: ${message.Body}`);
      return;
    }

    this.logger.log(
      `Received underwriting job: dealId=${parsed.dealId} orgId=${parsed.orgId} docs=${parsed.documents.map((d) => d.filename).join(', ')}`,
    );

    const ctx: UnderwritingJobContext = {
      dealId: parsed.dealId,
      orgId: parsed.orgId,
      documents: parsed.documents,
    };

    // Run the full pipeline synchronously within this handler.
    // Message is acknowledged when run() resolves.
    // Re-throws on error → SQS retries automatically (visibilityTimeout: 600s).
    await this.pipeline.run(ctx);
  }

  @SqsConsumerEventHandler('underwriting', 'processing_error')
  onProcessingError(error: Error, message: Message): void {
    this.logger.error(
      `SQS processing error for underwriting message: ${error.message}`,
      error.stack,
    );
  }
}
