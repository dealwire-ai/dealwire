import { Injectable, Logger } from '@nestjs/common';
import { SqsMessageHandler, SqsConsumerEventHandler } from '@ssut/nestjs-sqs';
import { Message } from '@aws-sdk/client-sqs';
import { EmailProcessorService, ProcessDealContext } from './email-processor.service';
import { NormalizedEmailEvent } from '../../dto/normalized-email-event.dto';
import { MicrosoftGraphService } from '../microsoft/microsoft-graph.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';

interface QueuedEmailMessage {
  event: NormalizedEmailEvent;
  accessToken: string;
  inboxOwnerEmail: string;
  receivedByUserId: string;
  organizationId: string | null;
  dealId: string; // Pre-generated dealId for S3 organization
}

@Injectable()
export class NormalizedEmailListenerService {
  private readonly logger = new Logger(NormalizedEmailListenerService.name);

  constructor(
    private readonly emailProcessor: EmailProcessorService,
    private readonly microsoftGraphService: MicrosoftGraphService,
    private readonly prismaService: PrismaService,
    private readonly metricsService: MetricsService,
  ) {}

  @SqsMessageHandler('normalized-email', false)
  async handleMessage(message: Message): Promise<void> {
    if (!message.Body) {
      this.logger.warn('Received message without body');
      return;
    }

    try {
      const queuedMessage: QueuedEmailMessage = JSON.parse(message.Body);

      this.logger.log(
        `Received message: messageId=${queuedMessage.event?.messageId}, ` +
        `source=${queuedMessage.event?.source}, ` +
        `from=${queuedMessage.event?.from}, ` +
        `subject=${queuedMessage.event?.subject}, ` +
        `inboxOwner=${queuedMessage.inboxOwnerEmail}, ` +
        `attachments=${queuedMessage.event?.attachments?.length || 0}`,
      );

      // Validate required fields
      if (!queuedMessage.event || !queuedMessage.inboxOwnerEmail) {
        this.logger.warn('Invalid message format, skipping');
        return;
      }

      // Access token is now always provided, but validate it
      let accessToken: string | undefined = queuedMessage.accessToken;
      if (queuedMessage.event.source === 'microsoft' && !accessToken) {
        // Fallback: try to fetch if missing (shouldn't happen, but be defensive)
        const token = await this.microsoftGraphService.getAccessToken(queuedMessage.receivedByUserId);
        if (!token) {
          this.logger.error(`No access token for user ${queuedMessage.receivedByUserId}`);
          throw new Error(`No access token for user ${queuedMessage.receivedByUserId}`);
        }
        accessToken = token;
      }

      // OrganizationId is now always provided (may be null)
      let organizationId = queuedMessage.organizationId;
      if (!organizationId && queuedMessage.receivedByUserId) {
        // Fallback: try to fetch if null (shouldn't happen, but be defensive)
        const user = await this.prismaService.user.findUnique({
          where: { id: queuedMessage.receivedByUserId },
          select: { organizationId: true },
        });
        organizationId = user?.organizationId ?? null;
      }

      // Process the email
      const ctx: ProcessDealContext = {
        event: queuedMessage.event,
        accessToken,
        inboxOwnerEmail: queuedMessage.inboxOwnerEmail,
        receivedByUserId: queuedMessage.receivedByUserId,
        organizationId: organizationId ?? undefined,
        dealId: queuedMessage.dealId, // Pre-generated dealId for S3 organization
      };

      await this.emailProcessor.process(ctx);
      this.metricsService.recordSqsMessageReceived('normalized-email', 'success');
      this.logger.log(`Processed email ${queuedMessage.event.messageId} from queue`);
    } catch (error) {
      this.metricsService.recordSqsMessageReceived('normalized-email', 'error');
      this.metricsService.recordSqsError('normalized-email', 'receive');
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process queued message: ${msg}`);
      // Re-throw to let the library handle retries
      throw error;
    }
  }

  @SqsConsumerEventHandler('normalized-email', 'processing_error')
  onProcessingError(error: Error, message: Message): void {
    this.metricsService.recordSqsError('normalized-email', 'receive');
    this.logger.error(`SQS processing error: ${error.message}`, error.stack);
  }
}
