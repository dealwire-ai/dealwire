import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../s3/s3.service';
import { DealAnalyzerService } from './deal-analyzer.service';
import { TemplateFillerService } from './template-filler.service';
import { ProformaValidatorService } from './proforma-validator.service';
import { DeliveryService } from './delivery.service';
import { AssumptionAskerService } from './assumption-asker.service';
import { AssumptionEmailService } from './assumption-email.service';
import { DealAnalysis, ValidationResult } from './workflow-types';
import { AssumptionQuestion, UserAssumptions } from './assumption-types';
import { buildThreadSubject, threadPropertyLabel } from './thread-subject';
import {
  UnderwritingJobContext,
  UnderwritingResult,
} from '../underwriting-types';

// xlsx-populate ships no TypeScript types — use require with any
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XlsxPopulate = require('xlsx-populate') as any;

@Injectable()
export class UnderwritingWorkflowService {
  private readonly logger = new Logger(UnderwritingWorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly analyzer: DealAnalyzerService,
    private readonly filler: TemplateFillerService,
    private readonly validator: ProformaValidatorService,
    private readonly delivery: DeliveryService,
    private readonly asker: AssumptionAskerService,
    private readonly assumptionEmail: AssumptionEmailService,
  ) {}

  /**
   * Phase 1 — analyze the deal documents and email the investor a list
   * of underwriting assumptions. The run is left in WAITING_FOR_ASSUMPTIONS.
   * Caller (listener) must have already created the UnderwritingRun row in
   * RUNNING state with `jobId === ctx.dealId`.
   */
  async runAnalysisPhase(
    ctx: UnderwritingJobContext,
  ): Promise<{ status: 'waiting_for_assumptions'; runId: string }> {
    const { dealId, orgId, senderEmail, documents, inReplyToMessageId } = ctx;

    this.logger.log(
      `[${dealId}] Analysis phase start: orgId=${orgId} docs=${documents.map((d) => d.filename).join(', ')}`,
    );

    const run = await this.prisma.underwritingRun.findUniqueOrThrow({
      where: { jobId: dealId },
    });

    const proforma = await this.prisma.proforma.findFirst({
      where: { organizationId: orgId, isReady: true, isDefault: true },
    });

    if (!proforma) {
      throw new Error(
        `No ready default proforma for org ${orgId} — cannot run interactive underwriting.`,
      );
    }

    const analysis = await this.analyzer.analyze(documents, dealId);

    const templateBuffer = await this.s3.downloadDealAttachment(proforma.s3Key);
    const workbook = await XlsxPopulate.fromDataAsync(templateBuffer);
    const questions = await this.asker.generateQuestions(
      analysis,
      workbook,
      dealId,
    );

    const subject = buildThreadSubject(
      threadPropertyLabel(analysis),
      run.id,
      false,
    );

    await this.assumptionEmail.sendQuestionsEmail({
      runId: run.id,
      senderEmail,
      questions,
      inReplyToMessageId,
      subject,
    });

    await this.prisma.underwritingRun.update({
      where: { id: run.id },
      data: {
        status: 'WAITING_FOR_ASSUMPTIONS',
        extractionSnapshot: analysis as unknown as Prisma.InputJsonValue,
        askedAssumptions: questions as unknown as Prisma.InputJsonValue,
        proformaId: proforma.id,
        confidence: analysis.confidence,
      },
    });

    this.logger.log(
      `[${dealId}] Analysis phase complete → WAITING_FOR_ASSUMPTIONS, ${questions.length} questions sent`,
    );

    return { status: 'waiting_for_assumptions', runId: run.id };
  }

  /**
   * Phase 2 — fill the proforma using the extraction snapshot + user assumptions,
   * deliver, and mark COMPLETED. Used both for first-reply (after
   * WAITING_FOR_ASSUMPTIONS) and for re-runs after branching (parent COMPLETED).
   */
  async runFillPhase(
    runId: string,
    assumptions: UserAssumptions,
    replyContext: {
      senderEmail: string;
      inReplyToMessageId?: string;
      threadAnchorRunId?: string;
      references?: string[];
      priorAssumptions?: UserAssumptions | null;
    },
  ): Promise<UnderwritingResult> {
    const startTime = Date.now();
    const run = await this.prisma.underwritingRun.findUniqueOrThrow({
      where: { id: runId },
    });

    const dealId = run.jobId;
    this.logger.log(`[${dealId}] Fill phase start: runId=${runId}`);

    const snapshot = run.extractionSnapshot as unknown as DealAnalysis | null;
    if (!snapshot) {
      throw new Error(
        `Run ${runId} has no extractionSnapshot — cannot fill template.`,
      );
    }

    const proforma = run.proformaId
      ? await this.prisma.proforma.findUnique({ where: { id: run.proformaId } })
      : await this.prisma.proforma.findFirst({
          where: {
            organizationId: run.organizationId,
            isReady: true,
            isDefault: true,
          },
        });

    if (!proforma) {
      throw new Error(`No proforma for run ${runId} — cannot fill template.`);
    }

    const templateBuffer = await this.s3.downloadDealAttachment(proforma.s3Key);
    const workbook = await XlsxPopulate.fromDataAsync(templateBuffer);

    const cellMappings = await this.filler.mapToTemplate(
      snapshot,
      assumptions,
      workbook,
      dealId,
    );
    let filled = 0;
    for (const mapping of cellMappings.mappings) {
      try {
        const sheet = workbook.sheet(mapping.sheet);
        if (!sheet) continue;
        sheet.cell(mapping.cell).value(mapping.value);
        filled++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `[${dealId}] Could not write ${mapping.sheet}!${mapping.cell}: ${msg}`,
        );
      }
    }
    this.logger.log(
      `[${dealId}] Filled ${filled}/${cellMappings.mappings.length} AI-mapped cells`,
    );

    // Validate + apply corrections
    let validation: ValidationResult | undefined;
    let correctionsApplied = 0;
    try {
      const interimBuffer = Buffer.from(await workbook.outputAsync());
      validation = await this.validator.validate(
        interimBuffer,
        snapshot,
        dealId,
      );
      for (const fix of validation.corrections) {
        try {
          const sheet = workbook.sheet(fix.sheet);
          if (!sheet) continue;
          const value = fix.correctValue === null ? '' : fix.correctValue;
          sheet.cell(fix.cell).value(value);
          correctionsApplied++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `[${dealId}] Could not apply correction ${fix.sheet}!${fix.cell}: ${msg}`,
          );
        }
      }
      if (correctionsApplied > 0) {
        this.logger.log(
          `[${dealId}] Applied ${correctionsApplied}/${validation.corrections.length} corrections`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[${dealId}] Validation failed: ${msg}`);
      snapshot.flags.push('Pro forma validation failed — see logs');
    }

    const outputBuffer = await workbook.outputAsync();
    const proformaS3Key = await this.s3.uploadFilledProforma(
      Buffer.from(outputBuffer),
      dealId,
    );

    const rootRunId =
      replyContext.threadAnchorRunId ?? (await this.findRootRunId(run));

    await this.delivery.deliver({
      runId: run.id,
      senderEmail: replyContext.senderEmail,
      dealId,
      proformaS3Key,
      analysis: snapshot,
      validation,
      correctionsApplied,
      inReplyToMessageId: replyContext.inReplyToMessageId,
      threadAnchorRunId: rootRunId,
      references: replyContext.references,
      priorAssumptions: replyContext.priorAssumptions ?? null,
      newAssumptions: assumptions,
    });

    const durationMs = Date.now() - startTime;

    await this.prisma.underwritingRun.update({
      where: { id: run.id },
      data: {
        status: 'COMPLETED',
        receivedAssumptions: assumptions as unknown as Prisma.InputJsonValue,
        analysisData: snapshot as unknown as Prisma.InputJsonValue,
        filledProformaModelS3Key: proformaS3Key,
        humanReviewFlags: snapshot.flags,
        confidence: snapshot.confidence,
        durationMs,
        proformaId: proforma.id,
        completedAt: new Date(),
      },
    });

    this.logger.log(
      `[${dealId}] Fill phase complete → COMPLETED in ${durationMs}ms`,
    );

    return {
      dealId,
      status: 'completed',
      filledProformaModelS3Key: proformaS3Key,
      humanReviewFlags: snapshot.flags,
      durationMs,
      analysisData: { ...snapshot },
      confidence: snapshot.confidence,
      proformaId: proforma.id,
    };
  }

  /**
   * Phase 3 — reply to a COMPLETED run ("what if rate drops to 5.5%").
   * Creates a new UnderwritingRun with parentRunId set, inherits the parent's
   * extractionSnapshot and proforma, merges new assumptions over parent's
   * receivedAssumptions, and runs the fill phase.
   */
  async runRerunPhase(
    parentRunId: string,
    newAssumptions: UserAssumptions,
    replyContext: {
      senderEmail: string;
      inReplyToMessageId?: string;
    },
  ): Promise<UnderwritingResult> {
    const parent = await this.prisma.underwritingRun.findUniqueOrThrow({
      where: { id: parentRunId },
    });

    const rootRunId = await this.findRootRunId(parent);
    const references = await this.collectThreadReferences(rootRunId);

    const childJobId = `${parent.jobId}_r${Date.now().toString(36)}`;

    const child = await this.prisma.underwritingRun.create({
      data: {
        jobId: childJobId,
        organizationId: parent.organizationId,
        senderEmail: parent.senderEmail,
        emailSubject: parent.emailSubject,
        status: 'RUNNING',
        parentRunId: parent.id,
        extractionSnapshot: parent.extractionSnapshot ?? Prisma.JsonNull,
        askedAssumptions: parent.askedAssumptions ?? Prisma.JsonNull,
        receivedAssumptions: newAssumptions as unknown as Prisma.InputJsonValue,
        proformaId: parent.proformaId,
      },
    });

    this.logger.log(
      `[${child.jobId}] Re-run: child run ${child.id} of parent ${parent.id} (thread anchor=${rootRunId}, refs=${references.length})`,
    );

    const priorAssumptions =
      (parent.receivedAssumptions as unknown as UserAssumptions | null) || null;

    return this.runFillPhase(child.id, newAssumptions, {
      ...replyContext,
      threadAnchorRunId: rootRunId,
      references,
      priorAssumptions,
    });
  }

  /** Walk parentRunId up until we hit the root of the thread. */
  async findRootRunId(run: {
    id: string;
    parentRunId: string | null;
  }): Promise<string> {
    let cursor: { id: string; parentRunId: string | null } = run;
    const seen = new Set<string>([cursor.id]);
    while (cursor.parentRunId) {
      if (seen.has(cursor.parentRunId)) break;
      const parent = await this.prisma.underwritingRun.findUnique({
        where: { id: cursor.parentRunId },
        select: { id: true, parentRunId: true },
      });
      if (!parent) break;
      seen.add(parent.id);
      cursor = parent;
    }
    return cursor.id;
  }

  /**
   * Collect all message IDs in the thread starting at rootRunId, in
   * chronological order. Walks every descendant run and returns each run's
   * messages so References reflects the full conversation.
   */
  async collectThreadReferences(rootRunId: string): Promise<string[]> {
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
      where: { runId: { in: Array.from(runIds) } },
      orderBy: { sentAt: 'asc' },
      select: { messageId: true },
    });
    return messages.map((m) => m.messageId);
  }
}
