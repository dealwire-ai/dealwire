import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Service } from '../../s3/s3.service';
import { DealAnalyzerService } from './deal-analyzer.service';
import { TemplateFillerService } from './template-filler.service';
import { ProformaValidatorService } from './proforma-validator.service';
import { AgenticDeliveryService } from './agentic-delivery.service';
import { ValidationResult } from './agentic-types';
import {
  UnderwritingJobContext,
  UnderwritingResult,
} from '../underwriting-orchestrator.service';

// xlsx-populate ships no TypeScript types — use require with any
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XlsxPopulate = require('xlsx-populate') as any;

@Injectable()
export class AgenticUnderwritingService {
  private readonly logger = new Logger(AgenticUnderwritingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3: S3Service,
    private readonly analyzer: DealAnalyzerService,
    private readonly filler: TemplateFillerService,
    private readonly validator: ProformaValidatorService,
    private readonly delivery: AgenticDeliveryService,
  ) {}

  async run(ctx: UnderwritingJobContext): Promise<UnderwritingResult> {
    const startTime = Date.now();
    const { dealId, orgId, senderEmail, documents, inReplyToMessageId } = ctx;

    this.logger.log(
      `[${dealId}] Starting agentic underwriting: orgId=${orgId} docs=${documents.map((d) => d.filename).join(', ')}`,
    );

    // ── Load proforma template ────────────────────────────────────────────────
    const proforma = await this.prisma.proforma.findFirst({
      where: { organizationId: orgId, isReady: true, isDefault: true },
    });

    if (!proforma) {
      this.logger.warn(
        `[${dealId}] No ready default proforma for org ${orgId} — analysis will run but template fill will be skipped`,
      );
    }

    // ── Call 1: Analyze deal ──────────────────────────────────────────────────
    const analysis = await this.analyzer.analyze(documents, dealId);

    // ── Call 2 + Excel write: Fill template ───────────────────────────────────
    let proformaS3Key: string | undefined;
    let validation: ValidationResult | undefined;
    let correctionsApplied = 0;

    if (proforma) {
      try {
        const templateBuffer = await this.s3.downloadDealAttachment(
          proforma.s3Key,
        );

        // Load workbook first — the filler reads styles (blue = input cells)
        const workbook = await XlsxPopulate.fromDataAsync(templateBuffer);

        // Get cell mappings from AI (uses workbook to detect blue input cells)
        const cellMappings = await this.filler.mapToTemplate(
          analysis,
          workbook,
          dealId,
        );
        let filled = 0;

        for (const mapping of cellMappings.mappings) {
          try {
            const sheet = workbook.sheet(mapping.sheet);
            if (!sheet) {
              this.logger.warn(
                `[${dealId}] Sheet "${mapping.sheet}" not found — skipping ${mapping.cell}`,
              );
              continue;
            }
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

        // ── Call 3: Validate filled proforma ─────────────────────────────────
        const filledBuffer = Buffer.from(await workbook.outputAsync());

        try {
          validation = await this.validator.validate(
            filledBuffer,
            analysis,
            dealId,
          );

          // Apply corrections from validator
          if (validation.corrections.length > 0) {
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
            this.logger.log(
              `[${dealId}] Applied ${correctionsApplied}/${validation.corrections.length} corrections`,
            );
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error(`[${dealId}] Validation failed: ${msg}`);
          analysis.flags.push('Pro forma validation failed — see logs');
        }

        // Upload final proforma (with corrections applied)
        const outputBuffer = await workbook.outputAsync();
        proformaS3Key = await this.s3.uploadFilledProforma(
          Buffer.from(outputBuffer),
          dealId,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[${dealId}] Template fill failed: ${msg}`);
        analysis.flags.push('Pro forma fill failed — see logs');
      }
    }

    // ── Deliver ───────────────────────────────────────────────────────────────
    if (senderEmail && proformaS3Key) {
      this.logger.log(`[${dealId}] Delivering results to ${senderEmail}`);
      try {
        await this.delivery.deliver({
          senderEmail,
          dealId,
          proformaS3Key,
          analysis,
          validation,
          correctionsApplied,
          inReplyToMessageId,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[${dealId}] Delivery failed: ${msg}`);
      }
    } else {
      this.logger.log(
        `[${dealId}] Delivery skipped (${!senderEmail ? 'no senderEmail' : 'no filled proforma'})`,
      );
    }

    const durationMs = Date.now() - startTime;
    this.logger.log(
      `[${dealId}] Agentic underwriting complete: duration=${durationMs}ms flags=${analysis.flags.length}`,
    );

    return {
      dealId,
      status: 'completed',
      proformaS3Key,
      humanReviewFlags: analysis.flags,
      durationMs,
    };
  }
}
