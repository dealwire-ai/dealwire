import { Injectable, Logger } from '@nestjs/common';
import { SqsMessageHandler, SqsConsumerEventHandler } from '@ssut/nestjs-sqs';
import { Message } from '@aws-sdk/client-sqs';
import {
  UnderwritingOrchestratorService,
  UnderwritingJobContext,
} from './underwriting-orchestrator.service';
import { AgenticUnderwritingService } from './agentic/agentic-underwriting.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { LlmContextStore, withLlmContext } from '../llm/llm-context';
import { MetricsService } from '../metrics/metrics.service';

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
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
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
      // Create initial RUNNING record. If this fails with a unique constraint
      // violation, the job was already processed (SQS redelivery) — skip it.
      if (parsed.orgId) {
        try {
          await this.prisma.underwritingRun.create({
            data: {
              jobId: parsed.dealId,
              organizationId: parsed.orgId,
              senderEmail: parsed.senderEmail,
              emailSubject: parsed.emailSubject,
              status: 'RUNNING',
            },
          });
        } catch (createErr) {
          const isUniqueViolation =
            createErr instanceof Prisma.PrismaClientKnownRequestError &&
            createErr.code === 'P2002';
          if (isUniqueViolation) {
            this.logger.warn(
              `[${parsed.dealId}] Duplicate jobId — already processed, skipping pipeline`,
            );
            return;
          }
          // Non-duplicate error — log but continue, the failure upsert will still persist
          this.logger.error(
            `[${parsed.dealId}] Failed to create initial run record: ${createErr}`,
          );
        }
      }

      const llmStore: LlmContextStore = {
        runId: parsed.dealId,
        dealId: parsed.dealId,
        organizationId: parsed.orgId,
      };
      const result = await withLlmContext(llmStore, () =>
        useAgentic ? this.agenticPipeline.run(ctx) : this.pipeline.run(ctx),
      );
      const acc = llmStore.accumulator;

      // Persist completed result
      if (parsed.orgId) {
        await this.prisma.underwritingRun.update({
          where: { jobId: parsed.dealId },
          data: {
            status: 'COMPLETED',
            analysisData:
              (result.analysisData as Prisma.InputJsonValue) ?? undefined,
            filledProformaModelS3Key: result.filledProformaModelS3Key,
            humanReviewFlags: result.humanReviewFlags,
            confidence: result.confidence,
            durationMs: result.durationMs,
            proformaId: result.proformaId,
            completedAt: new Date(),
            ...(acc && {
              totalPromptTokens: acc.totalPromptTokens,
              totalCompletionTokens: acc.totalCompletionTokens,
              totalLlmCostUsd: new Prisma.Decimal(acc.totalCostUsd.toFixed(6)),
              llmCostByStage: acc.costByStage as Prisma.InputJsonValue,
            }),
          },
        });
        this.logger.log(
          `[${parsed.dealId}] Underwriting result persisted to DB`,
        );

        if (acc) {
          this.metrics.recordUnderwritingRunLlmTotals({
            organizationId: parsed.orgId,
            totalPromptTokens: acc.totalPromptTokens,
            totalCompletionTokens: acc.totalCompletionTokens,
            totalCostUsd: acc.totalCostUsd,
          });
          this.logger.log(
            `llm.run.summary ${JSON.stringify({
              runId: parsed.dealId,
              organizationId: parsed.orgId,
              totalCostUsd: Number(acc.totalCostUsd.toFixed(6)),
              totalPromptTokens: acc.totalPromptTokens,
              totalCompletionTokens: acc.totalCompletionTokens,
              callCount: acc.callCount,
              costByStage: Object.fromEntries(
                Object.entries(acc.costByStage).map(([k, v]) => [
                  k,
                  Number(v.toFixed(6)),
                ]),
              ),
            })}`,
          );
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${parsed.dealId}] Pipeline failed: ${msg}`,
        err instanceof Error ? err.stack : undefined,
      );

      // Persist failure
      if (parsed.orgId) {
        try {
          await this.prisma.underwritingRun.upsert({
            where: { jobId: parsed.dealId },
            update: {
              status: 'FAILED',
              error: msg,
              completedAt: new Date(),
            },
            create: {
              jobId: parsed.dealId,
              organizationId: parsed.orgId,
              senderEmail: parsed.senderEmail,
              emailSubject: parsed.emailSubject,
              status: 'FAILED',
              error: msg,
              completedAt: new Date(),
            },
          });
        } catch (persistErr) {
          this.logger.error(
            `[${parsed.dealId}] Failed to persist error state: ${persistErr}`,
          );
        }
      }
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
