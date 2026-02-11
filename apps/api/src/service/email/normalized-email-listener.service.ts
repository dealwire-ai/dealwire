import { Injectable, Logger } from '@nestjs/common';
import { SqsMessageHandler, SqsConsumerEventHandler } from '@ssut/nestjs-sqs';
import { Message } from '@aws-sdk/client-sqs';
import { marked } from 'marked';
import { EmailProcessorService, ProcessDealContext } from './email-processor.service';
import { DealDetection } from '../deal/deal-detection.service';
import { NormalizedEmailEvent } from '../../dto/normalized-email-event.dto';
import { MicrosoftGraphService } from '../microsoft/microsoft-graph.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../metrics/metrics.service';
import { AnalyzerAgentService } from '../agent/analyzer-agent.service';

interface QueuedEmailMessage {
  event: NormalizedEmailEvent;
  accessToken: string;
  inboxOwnerEmail: string;
  receivedByUserId: string;
  organizationId: string | null;
  dealId: string; // Pre-generated dealId for S3 organization
  detection: DealDetection; // Deal detection result (done in webhook)
}

interface QueuedUserReplyCommand {
  type: 'user-reply-command';
  event: NormalizedEmailEvent;
  accessToken: string;
  inboxOwnerEmail: string;
  receivedByUserId: string;
  organizationId: string | null;
}

@Injectable()
export class NormalizedEmailListenerService {
  private readonly logger = new Logger(NormalizedEmailListenerService.name);

  constructor(
    private readonly emailProcessor: EmailProcessorService,
    private readonly microsoftGraphService: MicrosoftGraphService,
    private readonly prismaService: PrismaService,
    private readonly metricsService: MetricsService,
    private readonly analyzerAgent: AnalyzerAgentService,
  ) {}

  @SqsMessageHandler('normalized-email', false)
  async handleMessage(message: Message): Promise<void> {
    if (!message.Body) {
      this.logger.warn('Received message without body');
      return;
    }

    try {
      const parsed = JSON.parse(message.Body);
      if (parsed.type === 'user-reply-command') {
        await this.handleUserReplyCommand(parsed as QueuedUserReplyCommand);
        this.metricsService.recordSqsMessageReceived('normalized-email', 'success');
        return;
      }

      const queuedMessage = parsed as QueuedEmailMessage;

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
        const token = await this.microsoftGraphService.getMicrosoftOAuthTokenFromClerk(queuedMessage.receivedByUserId);
        if (!token) {
          this.logger.error(`No access token for user ${queuedMessage.receivedByUserId}`);
          throw new Error(`No access token for user ${queuedMessage.receivedByUserId}`);
        }
        accessToken = token;
      }

      // OrganizationId is required for deal processing
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
      // Detection is required - must be provided from webhook
      if (!queuedMessage.detection) {
        this.logger.error(`Missing detection result for email ${queuedMessage.event.messageId}`);
        throw new Error('Missing detection result - deal detection must be done in webhook');
      }

      // OrganizationId is required - skip processing if missing
      if (!organizationId) {
        this.logger.warn(
          `Skipping deal processing for email ${queuedMessage.event.messageId} - user ${queuedMessage.receivedByUserId} has no organization`,
        );
        return;
      }

      const ctx: ProcessDealContext = {
        event: queuedMessage.event,
        accessToken,
        inboxOwnerEmail: queuedMessage.inboxOwnerEmail,
        receivedByUserId: queuedMessage.receivedByUserId,
        organizationId,
        dealId: queuedMessage.dealId, // Pre-generated dealId for S3 organization
        detection: queuedMessage.detection, // Deal detection result from webhook
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

  private async handleUserReplyCommand(cmd: QueuedUserReplyCommand): Promise<void> {
    const { event, accessToken, inboxOwnerEmail, organizationId } = cmd;
    if (!organizationId) {
      this.logger.warn('User reply command missing organizationId, skipping');
      return;
    }

    const userMessage =
      event.bodyText ||
      (event.bodyHtml
        ? event.bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        : '');
    if (!userMessage || userMessage.length < 2) {
      this.logger.warn('User reply has no content, skipping');
      return;
    }

    this.logger.log(`Processing user-reply-command: ${event.messageId} - "${userMessage.slice(0, 50)}..."`);

    const responseText = await this.analyzerAgent.generate(
      { organizationId },
      userMessage,
    );
    const htmlBody = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">${(marked.parse(responseText) as string)}</div>`;

    const ok = await this.microsoftGraphService.replyInThreadToSelf(
      accessToken,
      event.messageId,
      inboxOwnerEmail,
      htmlBody,
    );
    if (!ok) {
      throw new Error(`Failed to send reply for ${event.messageId}`);
    }
    this.logger.log(`Replied to user command: ${event.messageId}`);
  }

  @SqsConsumerEventHandler('normalized-email', 'processing_error')
  onProcessingError(error: Error, message: Message): void {
    this.metricsService.recordSqsError('normalized-email', 'receive');
    this.logger.error(`SQS processing error: ${error.message}`, error.stack);
  }
}
