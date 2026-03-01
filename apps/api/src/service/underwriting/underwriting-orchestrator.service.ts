import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentClassifierService } from './extractors/document-classifier.service';
import { OMExtractorService } from './extractors/om-extractor.service';
import { RentRollExtractorService } from './extractors/rent-roll-extractor.service';
import { T12ExtractorService } from './extractors/t12-extractor.service';
import { ExtractionResults } from './extractors/extraction-types';
import { FieldMapEntry } from './proforma.service';
import { GenericExtractorService } from './extractors/generic-extractor.service';

export interface UnderwritingDocument {
  s3Key: string;
  filename: string;
  contentType: string;
}

export interface UnderwritingJobContext {
  dealId: string;
  orgId: string;
  senderEmail: string;
  documents: UnderwritingDocument[];
}

export interface UnderwritingResult {
  dealId: string;
  status: 'completed' | 'failed';
  proformaS3Key?: string;
  humanReviewFlags: string[];
  durationMs: number;
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
  ) {}

  async run(ctx: UnderwritingJobContext): Promise<UnderwritingResult> {
    const startTime = Date.now();
    const { dealId, orgId, documents } = ctx;

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
    const rentRollDocs = classified.filter((d) => d.documentType === 'rent-roll');
    const t12Docs = classified.filter((d) => d.documentType === 't12');
    const otherDocs = classified.filter((d) => d.documentType === 'other');

    const [omResults, rentRollResults, t12Results, genericResults] = await Promise.all([
      Promise.all(omDocs.map((d) => this.omExtractor.extract(d, neededFields))),
      Promise.all(rentRollDocs.map((d) => this.rentRollExtractor.extract(d, neededFields))),
      Promise.all(t12Docs.map((d) => this.t12Extractor.extract(d, neededFields))),
      neededFields?.length
        ? Promise.all(otherDocs.map((d) => this.genericExtractor.extract(d, neededFields)))
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

    // ── Step 3: Normalize ──────────────────────────────────────────────────────
    // Pure-code derivations on top of extracted data.
    this.logger.log(`[${dealId}] Step 3: Normalize extracted data`);
    // TODO: compute derived fields (EGI, vacancy rate from unit counts, expense ratio)

    // TODO Step 4: Reconciler — opus-4-6 + extended thinking, retry loop (max 2)
    //   Cross-check OM NOI vs T-12 computed NOI
    //   Cross-check OM occupancy vs rent roll vacancy count
    this.logger.log(`[${dealId}] Step 4: Reconcile cross-document conflicts`);

    // TODO Step 5: Confidence gate — pure code
    //   >= 0.85 → pass, 0.60–0.85 → flag, < 0.60 → null + flag
    this.logger.log(`[${dealId}] Step 5: Confidence gate`);

    // TODO Step 6: Pro forma fill — pure code
    //   Use proforma.fieldMap to write extracted values into the .xlsx template
    //   xlsx-populate writes to input cells only (XML passthrough)
    //   Save filled .xlsx to S3: deals/{dealId}/proforma_filled.xlsx
    this.logger.log(`[${dealId}] Step 6: Fill pro forma template`);

    // TODO Step 7: Deliver — Resend email + dashboard notification
    this.logger.log(`[${dealId}] Step 7: Deliver results`);

    const durationMs = Date.now() - startTime;
    this.logger.log(
      `Underwriting pipeline complete: dealId=${dealId} duration=${durationMs}ms`,
    );

    return {
      dealId,
      status: 'completed',
      humanReviewFlags: [],
      durationMs,
    };
  }
}
