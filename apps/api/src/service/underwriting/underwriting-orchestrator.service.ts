import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentClassifierService } from './extractors/document-classifier.service';
import { OMExtractorService } from './extractors/om-extractor.service';
import { RentRollExtractorService } from './extractors/rent-roll-extractor.service';
import { T12ExtractorService } from './extractors/t12-extractor.service';
import { ExtractionResults } from './extractors/extraction-types';
import { FieldMapEntry } from './proforma.service';
import { GenericExtractorService } from './extractors/generic-extractor.service';
import { ExtractionReconcilerService } from './steps/extraction-reconciler.service';
import { ProformaFillService } from './steps/proforma-fill.service';
import { DeliveryService } from './steps/delivery.service';

export interface UnderwritingDocument {
  s3Key: string;
  filename: string;
  contentType: string;
}

export interface UnderwritingJobContext {
  dealId: string;
  orgId: string;
  senderEmail: string;
  emailSubject?: string;
  documents: UnderwritingDocument[];
  inReplyToMessageId?: string;
}

export interface UnderwritingResult {
  dealId: string;
  status: 'completed' | 'failed';
  proformaS3Key?: string;
  humanReviewFlags: string[];
  durationMs: number;
  analysisData?: Record<string, unknown>;
  confidence?: number;
  proformaId?: string;
}

@Injectable()
export class UnderwritingOrchestratorService {
  private readonly logger = new Logger(UnderwritingOrchestratorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly classifier: DocumentClassifierService,
    private readonly omExtractor: OMExtractorService,
    private readonly rentRollExtractor: RentRollExtractorService,
    private readonly t12Extractor: T12ExtractorService,
    private readonly genericExtractor: GenericExtractorService,
    private readonly reconciler: ExtractionReconcilerService,
    private readonly proformaFill: ProformaFillService,
    private readonly delivery: DeliveryService,
  ) {}

  async run(ctx: UnderwritingJobContext): Promise<UnderwritingResult> {
    const startTime = Date.now();
    const { dealId, orgId, senderEmail, documents, inReplyToMessageId } = ctx;

    this.logger.log(
      `Starting underwriting pipeline: dealId=${dealId} orgId=${orgId} documents=${documents.map((d) => d.filename).join(', ')}`,
    );

    // ── Proforma lookup ────────────────────────────────────────────────────────
    // Load the org's default proforma fieldMap upfront. We don't fail if missing
    // — extraction still runs, but Step 6 (fill) will be skipped.
    const proforma = await this.prisma.proforma.findFirst({
      where: { organizationId: orgId, isReady: true, isDefault: true },
    });

    if (!proforma) {
      this.logger.warn(
        `[${dealId}] No ready default proforma found for org ${orgId} — extraction will run but pro forma fill will be skipped`,
      );
    } else {
      this.logger.log(
        `[${dealId}] Loaded proforma "${proforma.name}" (${(proforma.fieldMap as any[]).length} mapped fields)`,
      );
    }

    const neededFields = proforma
      ? (proforma.fieldMap as unknown as FieldMapEntry[]).map((f) => f.name)
      : undefined;

    // ── Step 1: Classify ───────────────────────────────────────────────────────
    this.logger.log(`[${dealId}] Step 1: Classify documents`);
    const classified = await this.classifier.classify(documents);
    this.logger.log(
      `[${dealId}] Classification: ${classified.map((d) => `${d.filename}=${d.documentType}(${d.confidence.toFixed(2)})`).join(', ')}`,
    );

    // ── Step 2: Extract ────────────────────────────────────────────────────────
    this.logger.log(`[${dealId}] Step 2: Extract documents in parallel`);

    const omDocs = classified.filter((d) => d.documentType === 'om');
    const rentRollDocs = classified.filter(
      (d) => d.documentType === 'rent-roll',
    );
    const t12Docs = classified.filter((d) => d.documentType === 't12');
    const otherDocs = classified.filter((d) => d.documentType === 'other');

    const [omResults, rentRollResults, t12Results, genericResults] =
      await Promise.all([
        Promise.all(
          omDocs.map((d) => this.omExtractor.extract(d, neededFields)),
        ),
        Promise.all(
          rentRollDocs.map((d) =>
            this.rentRollExtractor.extract(d, neededFields),
          ),
        ),
        Promise.all(
          t12Docs.map((d) => this.t12Extractor.extract(d, neededFields)),
        ),
        neededFields?.length
          ? Promise.all(
              otherDocs.map((d) =>
                this.genericExtractor.extract(d, neededFields),
              ),
            )
          : Promise.resolve([]),
      ]);

    if (otherDocs.length > 0) {
      this.logger.log(
        `[${dealId}] Generic extraction: ${otherDocs.length} unclassified doc(s) → ${genericResults.reduce((n, r) => n + r.fields.filter((f) => f.value !== null).length, 0)} fields found`,
      );
    }

    // Use the first of each type (most deals have one of each)
    const extraction: ExtractionResults = {
      om: omResults[0] ?? null,
      rentRoll: rentRollResults[0] ?? null,
      t12: t12Results[0] ?? null,
      generic: genericResults,
    };

    this.logger.log(
      `[${dealId}] Extraction summary: om=${extraction.om ? `confidence=${extraction.om.confidence.toFixed(2)}` : 'none'} rentRoll=${extraction.rentRoll ? `units=${extraction.rentRoll.totalUnits} confidence=${extraction.rentRoll.confidence.toFixed(2)}` : 'none'} t12=${extraction.t12 ? `noi=${extraction.t12.noi} confidence=${extraction.t12.confidence.toFixed(2)}` : 'none'} generic=${extraction.generic.length} doc(s)`,
    );

    // ── Steps 3+4: Normalize + Reconcile ──────────────────────────────────────
    this.logger.log(`[${dealId}] Steps 3+4: Snapshot — derive and reconcile`);
    const normalized = this.reconciler.resolve(extraction);
    if (normalized.flags.length > 0) {
      this.logger.warn(
        `[${dealId}] Reconciliation flags (${normalized.flags.length}): ${normalized.flags.join(' | ')}`,
      );
    }
    this.logger.log(
      `[${dealId}] Normalized: noi=${normalized.reconciledNoi} occupancy=${normalized.reconciledOccupancyRate} units=${normalized.reconciledTotalUnits} egi=${normalized.effectiveGrossIncome}`,
    );

    // ── Step 5: Confidence gate ────────────────────────────────────────────────
    this.logger.log(`[${dealId}] Step 5: Confidence gate`);
    const confidenceFlags: string[] = [];
    if (extraction.om && extraction.om.confidence < 0.6) {
      confidenceFlags.push(
        `Low OM confidence (${extraction.om.confidence.toFixed(2)}) — values may be unreliable`,
      );
    } else if (extraction.om && extraction.om.confidence < 0.85) {
      confidenceFlags.push(
        `Moderate OM confidence (${extraction.om.confidence.toFixed(2)}) — review key figures`,
      );
    }
    if (extraction.rentRoll && extraction.rentRoll.confidence < 0.6) {
      confidenceFlags.push(
        `Low rent roll confidence (${extraction.rentRoll.confidence.toFixed(2)}) — review unit data`,
      );
    }
    if (extraction.t12 && extraction.t12.confidence < 0.6) {
      confidenceFlags.push(
        `Low T-12 confidence (${extraction.t12.confidence.toFixed(2)}) — review expense data`,
      );
    }

    const allFlags = [...normalized.flags, ...confidenceFlags];

    // ── Step 6: Proforma fill ──────────────────────────────────────────────────
    let proformaS3Key: string | undefined;
    if (proforma) {
      this.logger.log(`[${dealId}] Step 6: Fill pro forma template`);
      try {
        const fieldMap = proforma.fieldMap as unknown as FieldMapEntry[];
        proformaS3Key = await this.proformaFill.fill(
          proforma.s3Key,
          fieldMap,
          extraction,
          normalized,
          dealId,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[${dealId}] Proforma fill failed: ${msg}`);
        allFlags.push('Pro forma fill failed — see logs');
      }
    } else {
      this.logger.log(
        `[${dealId}] Step 6: Skipped (no ready proforma for org)`,
      );
    }

    // ── Step 7: Deliver ────────────────────────────────────────────────────────
    if (senderEmail && proformaS3Key) {
      this.logger.log(`[${dealId}] Step 7: Deliver results to ${senderEmail}`);
      try {
        await this.delivery.deliver({
          senderEmail,
          dealId,
          proformaS3Key,
          normalized,
          extraction,
          inReplyToMessageId,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[${dealId}] Delivery failed: ${msg}`);
      }
    } else {
      this.logger.log(
        `[${dealId}] Step 7: Skipped (${!senderEmail ? 'no senderEmail' : 'no filled proforma'})`,
      );
    }

    const durationMs = Date.now() - startTime;
    this.logger.log(
      `Underwriting pipeline complete: dealId=${dealId} duration=${durationMs}ms flags=${allFlags.length}`,
    );

    return {
      dealId,
      status: 'completed',
      proformaS3Key,
      humanReviewFlags: allFlags,
      durationMs,
      analysisData: {
        pipeline: 'legacy',
        resolved: normalized,
        om: extraction.om ?? undefined,
      },
      confidence: extraction.om?.confidence ?? undefined,
      proformaId: proforma?.id,
    };
  }
}
