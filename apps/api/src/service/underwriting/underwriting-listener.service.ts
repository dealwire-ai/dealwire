import { Injectable, Logger } from '@nestjs/common';
import { SqsMessageHandler, SqsConsumerEventHandler } from '@ssut/nestjs-sqs';
import { Message } from '@aws-sdk/client-sqs';
import {
  UnderwritingOrchestratorService,
  UnderwritingJobContext,
} from './underwriting-orchestrator.service';
import { AgenticUnderwritingService } from './agentic/agentic-underwriting.service';

export interface UnderwritingJobMessage {
  type: 'underwriting-job';
  dealId: string;
  orgId: string;
  senderEmail: string;
  emailSubject?: string;
  documents: Array<{
    s3Key: string;
    filename: string;
    contentType: string;
  }>;
  inReplyToMessageId?: string;
}

@Injectable()
export class UnderwritingListenerService {
  private readonly logger = new Logger(UnderwritingListenerService.name);

  constructor(
    private readonly pipeline: UnderwritingOrchestratorService,
    private readonly agenticPipeline: AgenticUnderwritingService,
  ) {}

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
      this.logger.error(
        'Failed to parse underwriting message body — discarding',
      );
      return;
    }

    if (parsed.type !== 'underwriting-job') {
      this.logger.warn(`Unknown message type: ${parsed.type} — discarding`);
      return;
    }

    if (!parsed.dealId || !parsed.documents?.length || !parsed.senderEmail) {
      this.logger.error(
        `Invalid underwriting message — missing required fields: ${message.Body}`,
      );
      return;
    }

    if (!parsed.orgId) {
      this.logger.warn(
        `[${parsed.dealId}] No orgId — pipeline will run but pro forma fill will be skipped`,
      );
    }

    this.logger.log(
      `Received underwriting job: dealId=${parsed.dealId} orgId=${parsed.orgId} docs=${parsed.documents.map((d) => d.filename).join(', ')}`,
    );

    const ctx: UnderwritingJobContext = {
      dealId: parsed.dealId,
      orgId: parsed.orgId,
      senderEmail: parsed.senderEmail,
      emailSubject: parsed.emailSubject,
      documents: parsed.documents,
      inReplyToMessageId: parsed.inReplyToMessageId,
    };

    const useAgentic = process.env.AGENTIC_UNDERWRITING_ENABLED === 'true';

    this.logger.log(
      `[${parsed.dealId}] Using ${useAgentic ? 'agentic' : 'legacy'} pipeline`,
    );

    // Run the pipeline. Catch errors so the SQS consumer keeps polling
    // (unhandled throws kill the sqs-consumer polling loop permanently).
    // The message is still acknowledged — failed jobs won't retry endlessly.
    try {
      if (useAgentic) {
        await this.agenticPipeline.run(ctx);
      } else {
        await this.pipeline.run(ctx);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${parsed.dealId}] Pipeline failed: ${msg}`,
        err instanceof Error ? err.stack : undefined,
      );
    }
  }

  @SqsConsumerEventHandler('underwriting', 'processing_error')
  onProcessingError(error: Error, message: Message): void {
    this.logger.error(
      `SQS processing error for underwriting message: ${error.message}`,
      error.stack,
    );
  }
}
