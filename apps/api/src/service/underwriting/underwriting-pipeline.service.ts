import { Injectable, Logger } from '@nestjs/common';

export interface UnderwritingDocument {
  s3Key: string;
  filename: string;
  contentType: string;
}

export interface UnderwritingJobContext {
  dealId: string;
  orgId: string;
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
export class UnderwritingPipelineService {
  private readonly logger = new Logger(UnderwritingPipelineService.name);

  async run(ctx: UnderwritingJobContext): Promise<UnderwritingResult> {
    const startTime = Date.now();
    const { dealId, orgId, documents } = ctx;

    this.logger.log(
      `Starting underwriting pipeline: dealId=${dealId} orgId=${orgId} documents=${documents.map((d) => d.filename).join(', ')}`,
    );

    // TODO Step 1: Classifier — haiku-4-5, generateObject, identify doc types
    this.logger.log(`[${dealId}] Step 1: Classify documents`);

    // TODO Step 2: Parallel extractors — sonnet-4-6, generateObject per doc type
    //   PDF → Claude document block
    //   Excel → SheetJS → JSON → Claude text
    //   Scanned → pdftoppm + vision (existing path)
    this.logger.log(`[${dealId}] Step 2: Extract rent roll / T-12 / OM in parallel`);

    // TODO Step 3: Normalizer — pure code
    //   Sum rent roll rows → GPI, vacancy, unit mix
    //   Map T-12 line items → canonical expense schema
    //   Compute derived fields: EGI, NOI, vacancy rate
    this.logger.log(`[${dealId}] Step 3: Normalize extracted data`);

    // TODO Step 4: Reconciler — opus-4-6 + extended thinking, retry loop (max 2)
    //   Cross-check OM NOI vs T-12 computed NOI
    //   Cross-check OM occupancy vs rent roll vacancy count
    this.logger.log(`[${dealId}] Step 4: Reconcile cross-document conflicts`);

    // TODO Step 5: Confidence gate — pure code
    //   >= 0.85 → pass, 0.60–0.85 → flag, < 0.60 → null + flag
    this.logger.log(`[${dealId}] Step 5: Confidence gate`);

    // TODO Step 6: Pro forma fill — pure code
    //   Load FieldMap from DB (set at template onboarding)
    //   xlsx-populate writes to input cells only (XML passthrough)
    //   Save filled .xlsx to S3: deals/{dealId}/proforma_filled.xlsx
    this.logger.log(`[${dealId}] Step 6: Fill pro forma template`);

    // TODO Step 7: Deliver — Resend email + dashboard notification
    this.logger.log(`[${dealId}] Step 7: Deliver results`);

    const durationMs = Date.now() - startTime;
    this.logger.log(`Underwriting pipeline complete: dealId=${dealId} duration=${durationMs}ms`);

    return {
      dealId,
      status: 'completed',
      humanReviewFlags: [],
      durationMs,
    };
  }
}
