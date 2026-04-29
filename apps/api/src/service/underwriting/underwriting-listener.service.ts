import { Injectable, Logger } from '@nestjs/common';
import { SqsMessageHandler, SqsConsumerEventHandler } from '@ssut/nestjs-sqs';
import { Message } from '@aws-sdk/client-sqs';
import { Prisma } from '@prisma/client';
import { UnderwritingJobContext } from './underwriting-types';
import { AgenticUnderwritingService } from './agentic/agentic-underwriting.service';
import { AssumptionEmailService } from './agentic/assumption-email.service';
import {
  AssumptionQuestion,
  UserAssumptions,
} from './agentic/assumption-types';
import { threadPropertyLabel } from './agentic/thread-subject';
import { DealAnalysis } from './agentic/agentic-types';
import {
  ConversationTurn,
  ReplyRouterService,
} from './agentic/reply-router.service';
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
    private readonly assumptionEmail: AssumptionEmailService,
    private readonly replyRouter: ReplyRouterService,
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
            bodyText: rawBody,
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

    let transitionedToRunning = false;
    try {
      const analysis =
        (parent.extractionSnapshot as unknown as DealAnalysis | null) || null;
      const property = threadPropertyLabel(analysis);
      const rootRunId = await this.agenticPipeline.findRootRunId(parent);
      const references =
        await this.agenticPipeline.collectThreadReferences(rootRunId);
      const history = await this.loadConversationHistory(rootRunId);

      const decision = await withLlmContext(llmStore, () =>
        this.replyRouter.route({
          rawBody,
          history,
          askedQuestions,
          priorValues,
          analysis,
        }),
      );

      if (decision.intent === 'answer') {
        await this.assumptionEmail.sendAnswerEmail({
          runId: parent.id,
          senderEmail,
          answer: decision.answer,
          inReplyToMessageId: parsed.inReplyToMessageId,
          property,
          rootRunId,
          references,
        });
        this.logger.log(
          `[${parent.jobId}] Answer sent (parent.status=${parent.status}, reason="${decision.rationale.slice(0, 80)}")`,
        );
        return;
      }

      if (decision.intent === 'clarify') {
        await this.assumptionEmail.sendClarificationEmail({
          runId: parent.id,
          senderEmail,
          unparseable: decision.parsed.unparseable,
          inReplyToMessageId: parsed.inReplyToMessageId,
          property,
          rootRunId,
          references,
        });
        await this.prisma.underwritingRun.update({
          where: { id: parent.id },
          data: { status: 'WAITING_FOR_CLARIFICATION' },
        });
        this.logger.log(
          `[${parent.jobId}] Clarification sent — ${decision.parsed.unparseable.length} unparseable`,
        );
        return;
      }

      // intent === 'apply'
      const values = decision.parsed.values;

      const fillEligibleStatuses: ReadonlyArray<typeof parent.status> = [
        'WAITING_FOR_ASSUMPTIONS',
        'WAITING_FOR_CLARIFICATION',
      ];
      const canRecoverFromFailed =
        parent.status === 'FAILED' && analysis != null;

      if (
        fillEligibleStatuses.includes(parent.status) ||
        canRecoverFromFailed
      ) {
        // Optimistic lock → RUNNING. If another worker already grabbed it, skip.
        const lock = await this.prisma.underwritingRun.updateMany({
          where: {
            id: parent.id,
            status: {
              in: [
                'WAITING_FOR_ASSUMPTIONS',
                'WAITING_FOR_CLARIFICATION',
                'FAILED',
              ],
            },
          },
          data: { status: 'RUNNING', error: null },
        });
        if (lock.count === 0) {
          this.logger.warn(
            `[${parent.jobId}] Lost optimistic lock on parent run — another worker is processing`,
          );
          return;
        }
        transitionedToRunning = true;

        if (canRecoverFromFailed) {
          this.logger.log(
            `[${parent.jobId}] Recovering FAILED run with valid analysis snapshot`,
          );
        }

        await withLlmContext(llmStore, () =>
          this.agenticPipeline.runFillPhase(parent.id, values, {
            senderEmail,
            inReplyToMessageId: parsed.inReplyToMessageId,
            threadAnchorRunId: rootRunId,
            references,
            priorAssumptions: priorValues,
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
          this.agenticPipeline.runRerunPhase(parent.id, values, {
            senderEmail,
            inReplyToMessageId: parsed.inReplyToMessageId,
          }),
        );
        return;
      }

      this.logger.warn(
        `[${parent.jobId}] Apply intent but parent status=${parent.status} — ignoring`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `[${parent.jobId}] Reply processing failed: ${msg}`,
        err instanceof Error ? err.stack : undefined,
      );
      // Only mark the run FAILED if we actually started executing the apply
      // phase. Router/clarify/answer crashes leave the run in its prior status
      // so a follow-up reply can recover it.
      if (transitionedToRunning) {
        await this.prisma.underwritingRun
          .update({
            where: { id: parent.id },
            data: { status: 'FAILED', error: msg, completedAt: new Date() },
          })
          .catch(() => {});
      }
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

  /**
   * Load the conversation transcript for a thread, ordered chronologically.
   * Pulls every message from runs descended from `rootRunId` (so reruns are
   * included). Skips messages without bodyText (legacy rows + delivery emails).
   */
  private async loadConversationHistory(
    rootRunId: string,
  ): Promise<ConversationTurn[]> {
    const runIds = new Set<string>([rootRunId]);
    let frontier: string[] = [rootRunId];
    while (frontier.length > 0) {
      const children = await this.prisma.underwritingRun.findMany({
        where: { parentRunId: { in: frontier } },
        select: { id: true },
      });
      frontier = children.map((c) => c.id).filter((id) => !runIds.has(id));
      frontier.forEach((id) => runIds.add(id));
    }
    const messages = await this.prisma.underwritingRunMessage.findMany({
      where: { runId: { in: Array.from(runIds) }, bodyText: { not: null } },
      orderBy: { sentAt: 'asc' },
      select: { direction: true, bodyText: true },
    });
    return messages
      .filter((m) => m.bodyText && m.bodyText.trim().length > 0)
      .map((m) => ({
        role: m.direction === 'INBOUND' ? 'user' : 'assistant',
        body: m.bodyText as string,
      }));
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
