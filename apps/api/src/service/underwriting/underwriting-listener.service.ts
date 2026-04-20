import { Injectable, Logger } from '@nestjs/common';
import { SqsMessageHandler, SqsConsumerEventHandler } from '@ssut/nestjs-sqs';
import { Message } from '@aws-sdk/client-sqs';
import { Prisma } from '@prisma/client';
import { UnderwritingJobContext } from './underwriting-types';
import { AgenticUnderwritingService } from './agentic/agentic-underwriting.service';
import { AssumptionReplyParserService } from './agentic/assumption-reply-parser.service';
import { AssumptionEmailService } from './agentic/assumption-email.service';
import {
  AssumptionQuestion,
  UserAssumptions,
} from './agentic/assumption-types';
import { PrismaService } from '../prisma/prisma.service';
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

export interface UnderwritingReplyMessage {
  type: 'underwriting-reply-job';
  parentRunId: string;
  senderEmail: string;
  rawBody: string;
  inboundMessageId?: string;
  inReplyToMessageId?: string;
}

type IncomingMessage = UnderwritingJobMessage | UnderwritingReplyMessage;

@Injectable()
export class UnderwritingListenerService {
  private readonly logger = new Logger(UnderwritingListenerService.name);

  constructor(
    private readonly agenticPipeline: AgenticUnderwritingService,
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly replyParser: AssumptionReplyParserService,
    private readonly assumptionEmail: AssumptionEmailService,
  ) {}

  @SqsMessageHandler('underwriting', false)
  async handleMessage(message: Message): Promise<void> {
    if (!message.Body) {
      this.logger.warn('Received underwriting message without body');
      return;
    }

    let parsed: IncomingMessage;
    try {
      parsed = JSON.parse(message.Body) as IncomingMessage;
    } catch {
      this.logger.error(
        'Failed to parse underwriting message body — discarding',
      );
      return;
    }

    if (parsed.type === 'underwriting-job') {
      await this.handleNewJob(parsed);
      return;
    }
    if (parsed.type === 'underwriting-reply-job') {
      await this.handleReplyJob(parsed);
      return;
    }

    this.logger.warn(
      `Unknown message type: ${(parsed as any).type} — discarding`,
    );
  }

  private async handleNewJob(parsed: UnderwritingJobMessage): Promise<void> {
    if (!parsed.dealId || !parsed.documents?.length || !parsed.senderEmail) {
      this.logger.error(
        `Invalid underwriting job — missing required fields: dealId=${parsed.dealId} docs=${parsed.documents?.length}`,
      );
      return;
    }

    if (!parsed.orgId) {
      this.logger.warn(
        `[${parsed.dealId}] No orgId — cannot run interactive underwriting without proforma template`,
      );
      return;
    }

    this.logger.log(
      `New underwriting job: dealId=${parsed.dealId} orgId=${parsed.orgId} docs=${parsed.documents.map((d) => d.filename).join(', ')}`,
    );

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
          `[${parsed.dealId}] Duplicate jobId — already processed, skipping`,
        );
        return;
      }
      this.logger.error(
        `[${parsed.dealId}] Failed to create initial run record: ${createErr}`,
      );
      return;
    }

    const ctx: UnderwritingJobContext = {
      dealId: parsed.dealId,
      orgId: parsed.orgId,
      senderEmail: parsed.senderEmail,
      emailSubject: parsed.emailSubject,
      documents: parsed.documents,
      inReplyToMessageId: parsed.inReplyToMessageId,
    };

    const llmStore: LlmContextStore = {
      runId: parsed.dealId,
      dealId: parsed.dealId,
      organizationId: parsed.orgId,
    };

    try {
      await withLlmContext(llmStore, () =>
        this.agenticPipeline.runAnalysisPhase(ctx),
      );
      this.persistLlmTotals(parsed.dealId, parsed.orgId, llmStore, {
        finalize: false,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${parsed.dealId}] Analysis phase failed: ${msg}`,
        err instanceof Error ? err.stack : undefined,
      );
      await this.markFailed(parsed.dealId, msg);
    }
  }

  private async handleReplyJob(
    parsed: UnderwritingReplyMessage,
  ): Promise<void> {
    const { parentRunId, senderEmail, rawBody, inboundMessageId } = parsed;

    if (inboundMessageId) {
      try {
        await this.prisma.underwritingRunMessage.create({
          data: {
            runId: parentRunId,
            messageId: inboundMessageId,
            direction: 'INBOUND',
            phase: 'REPLY',
          },
        });
      } catch (err) {
        const isUniqueViolation =
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002';
        if (isUniqueViolation) {
          this.logger.warn(
            `[${parentRunId}] Duplicate inbound messageId=${inboundMessageId} — skipping`,
          );
          return;
        }
        this.logger.error(
          `[${parentRunId}] Failed to record inbound messageId: ${err}`,
        );
      }
    }

    const parent = await this.prisma.underwritingRun.findUnique({
      where: { id: parentRunId },
    });

    if (!parent) {
      this.logger.error(
        `Reply references unknown parentRunId=${parentRunId} — discarding`,
      );
      return;
    }

    const askedQuestions =
      (parent.askedAssumptions as unknown as AssumptionQuestion[] | null) || [];
    const priorValues =
      (parent.receivedAssumptions as unknown as UserAssumptions | null) || null;

    const llmStore: LlmContextStore = {
      runId: parent.jobId,
      dealId: parent.jobId,
      organizationId: parent.organizationId,
    };

    try {
      const parsedReply = await withLlmContext(llmStore, () =>
        this.replyParser.parseReply(rawBody, askedQuestions, priorValues),
      );

      if (parsedReply.unparseable.length > 0) {
        await this.assumptionEmail.sendClarificationEmail({
          runId: parent.id,
          senderEmail,
          unparseable: parsedReply.unparseable,
          inReplyToMessageId: parsed.inReplyToMessageId,
        });
        await this.prisma.underwritingRun.update({
          where: { id: parent.id },
          data: { status: 'WAITING_FOR_CLARIFICATION' },
        });
        this.logger.log(
          `[${parent.jobId}] Clarification sent — ${parsedReply.unparseable.length} unparseable`,
        );
        return;
      }

      if (
        parent.status === 'WAITING_FOR_ASSUMPTIONS' ||
        parent.status === 'WAITING_FOR_CLARIFICATION'
      ) {
        // Optimistic lock → RUNNING. If another worker already grabbed it, skip.
        const lock = await this.prisma.underwritingRun.updateMany({
          where: {
            id: parent.id,
            status: {
              in: ['WAITING_FOR_ASSUMPTIONS', 'WAITING_FOR_CLARIFICATION'],
            },
          },
          data: { status: 'RUNNING' },
        });
        if (lock.count === 0) {
          this.logger.warn(
            `[${parent.jobId}] Lost optimistic lock on parent run — another worker is processing`,
          );
          return;
        }

        await withLlmContext(llmStore, () =>
          this.agenticPipeline.runFillPhase(parent.id, parsedReply.values, {
            senderEmail,
            inReplyToMessageId: parsed.inReplyToMessageId,
          }),
        );
        this.persistLlmTotals(parent.jobId, parent.organizationId, llmStore, {
          finalize: true,
          runId: parent.id,
        });
        return;
      }

      if (parent.status === 'COMPLETED') {
        await withLlmContext(llmStore, () =>
          this.agenticPipeline.runRerunPhase(parent.id, parsedReply.values, {
            senderEmail,
            inReplyToMessageId: parsed.inReplyToMessageId,
          }),
        );
        return;
      }

      this.logger.warn(
        `[${parent.jobId}] Reply received but parent status=${parent.status} — ignoring`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${parent.jobId}] Reply processing failed: ${msg}`,
        err instanceof Error ? err.stack : undefined,
      );
      await this.prisma.underwritingRun
        .update({
          where: { id: parent.id },
          data: { status: 'FAILED', error: msg, completedAt: new Date() },
        })
        .catch(() => {});
    }
  }

  /**
   * Persist LLM cost totals onto an UnderwritingRun. Used at phase boundaries
   * (analysis phase done → leaves WAITING; fill phase done → finalize).
   */
  private persistLlmTotals(
    dealId: string,
    orgId: string,
    llmStore: LlmContextStore,
    opts: { finalize: boolean; runId?: string },
  ): void {
    const acc = llmStore.accumulator;
    if (!acc) return;

    const where = opts.runId ? { id: opts.runId } : { jobId: dealId };

    void this.prisma.underwritingRun
      .update({
        where,
        data: {
          totalPromptTokens: acc.totalPromptTokens,
          totalCompletionTokens: acc.totalCompletionTokens,
          totalLlmCostUsd: new Prisma.Decimal(acc.totalCostUsd.toFixed(6)),
          llmCostByStage: acc.costByStage as Prisma.InputJsonValue,
        },
      })
      .catch((err) => {
        this.logger.warn(
          `[${dealId}] Failed to persist LLM totals: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

    this.metrics.recordUnderwritingRunLlmTotals({
      organizationId: orgId,
      totalPromptTokens: acc.totalPromptTokens,
      totalCompletionTokens: acc.totalCompletionTokens,
      totalCostUsd: acc.totalCostUsd,
    });

    if (opts.finalize) {
      this.logger.log(
        `llm.run.summary ${JSON.stringify({
          runId: dealId,
          organizationId: orgId,
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

  private async markFailed(dealId: string, error: string): Promise<void> {
    try {
      await this.prisma.underwritingRun.update({
        where: { jobId: dealId },
        data: { status: 'FAILED', error, completedAt: new Date() },
      });
    } catch (err) {
      this.logger.error(`[${dealId}] Failed to persist error state: ${err}`);
    }
  }

  @SqsConsumerEventHandler('underwriting', 'processing_error')
  onProcessingError(error: Error, _message: Message): void {
    this.logger.error(
      `SQS processing error for underwriting message: ${error.message}`,
      error.stack,
    );
  }
}
