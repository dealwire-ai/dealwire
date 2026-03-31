import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { S3Service } from '../../s3/s3.service';
import { excelToText } from '../extractors/extraction-types';
import { DealAnalysisSchema, DealAnalysis } from './agentic-types';
import { UnderwritingDocument } from '../underwriting-orchestrator.service';

interface PreparedDocument {
  filename: string;
  contentType: string;
  /** Text representation for Excel/CSV, or raw Buffer for PDFs */
  content: string | Buffer;
}

const SYSTEM_PROMPT = `You are a senior commercial real estate underwriting analyst. You are given all the documents from a deal room — offering memorandums, rent rolls, trailing-12 financials, and any other supporting documents.

Your job is to read ALL documents, extract every relevant metric, reconcile conflicts between sources, and produce a comprehensive deal analysis.

## How to handle each document type

**Offering Memorandum (OM):** Extract property info (name, address, type, year built, units, sqft), asking price, stated cap rate, stated NOI, and occupancy. OMs often contain marketing spin — flag numbers that seem optimistic.

**Rent Roll:** Extract unit-level data and aggregate into unit mix by bed/bath type. Calculate total units, occupied/vacant, average rent, gross potential rent, and vacancy rate. If multiple rent rolls exist (e.g. different dates), prefer the most recent.

**T-12 / Trailing Financials:** Extract all income and expense line items (annual). This is the most reliable source for actual operating performance. If the T-12 shows monthly figures, annualize them (multiply by 12).

**Other documents** (CapEx trackers, AR reports, HVAC summaries, property condition reports): Extract any data relevant to underwriting — renovation costs, deferred maintenance, capital needs.

## Reconciliation rules

- If the OM and T-12 disagree on NOI, prefer the T-12 (actual performance > marketing).
- If the OM and rent roll disagree on unit count or occupancy, prefer the rent roll.
- If cap rate is not stated, derive it: NOI / asking price.
- If NOI is not stated, derive it: EGI - operating expenses.
- Flag any discrepancy > 5% between sources.

## Output guidelines

- All dollar amounts should be annual (not monthly) unless the field name says "monthly".
- Percentages as decimals (0.95 for 95%).
- Set fields to null if the data is genuinely not available — don't guess.
- For unitMix, aggregate rent roll units by bed/bath combination. Use 0 beds for studios.
- The analystNotes field should be 2-4 sentences: what kind of deal this is, notable strengths/risks, and what's missing.
- List any document types that were not provided in missingDocs (e.g. if there's no T-12, add "T-12").
- Add reconciliation issues and red flags to the flags array.`;

@Injectable()
export class DealAnalyzerService {
  private readonly logger = new Logger(DealAnalyzerService.name);

  constructor(private readonly s3: S3Service) {}

  /**
   * Download all deal documents from S3, prepare them for the model,
   * and run a single analysis call.
   */
  async analyze(
    documents: UnderwritingDocument[],
    dealId: string,
  ): Promise<DealAnalysis> {
    this.logger.log(`[${dealId}] Preparing ${documents.length} document(s)`);

    const prepared = await this.prepareDocuments(documents, dealId);
    const messages = this.buildMessages(prepared);

    this.logger.log(`[${dealId}] Running deal analysis (single-pass)`);

    const { object } = await generateObject({
      model: anthropic('claude-sonnet-4-6'),
      schema: DealAnalysisSchema,
      system: SYSTEM_PROMPT,
      messages,
      maxRetries: 2,
    });

    this.logger.log(
      `[${dealId}] Analysis complete: confidence=${object.confidence.toFixed(2)} flags=${object.flags.length} missing=${object.missingDocs.length}`,
    );

    return object;
  }

  private async prepareDocuments(
    documents: UnderwritingDocument[],
    dealId: string,
  ): Promise<PreparedDocument[]> {
    const results: PreparedDocument[] = [];

    for (const doc of documents) {
      try {
        const buffer = await this.s3.downloadDealAttachment(doc.s3Key);
        const isPdf =
          doc.contentType === 'application/pdf' ||
          doc.filename.toLowerCase().endsWith('.pdf');
        const isExcel =
          doc.contentType.includes('spreadsheet') ||
          doc.contentType.includes('excel') ||
          doc.contentType === 'application/vnd.ms-excel' ||
          /\.(xlsx?|csv)$/i.test(doc.filename);

        if (isPdf) {
          results.push({
            filename: doc.filename,
            contentType: doc.contentType,
            content: buffer,
          });
        } else if (isExcel) {
          const text = excelToText(buffer);
          results.push({
            filename: doc.filename,
            contentType: 'text/plain',
            content: text,
          });
        } else {
          // Try as text
          results.push({
            filename: doc.filename,
            contentType: 'text/plain',
            content: buffer.toString('utf-8'),
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `[${dealId}] Failed to prepare ${doc.filename}: ${msg}`,
        );
      }
    }

    return results;
  }

  private buildMessages(
    documents: PreparedDocument[],
  ): Array<{ role: 'user'; content: any }> {
    const contentParts: any[] = [];

    contentParts.push({
      type: 'text',
      text: `I'm sending you ${documents.length} document(s) from a deal room. Analyze them all and produce a comprehensive underwriting analysis.\n\nDocuments:`,
    });

    for (const doc of documents) {
      if (Buffer.isBuffer(doc.content)) {
        // PDF — use native document block
        contentParts.push({
          type: 'text',
          text: `\n📄 ${doc.filename}:`,
        });
        contentParts.push({
          type: 'file',
          data: doc.content.toString('base64'),
          mimeType: 'application/pdf',
        });
      } else {
        // Text content (Excel converted to CSV, or raw text)
        contentParts.push({
          type: 'text',
          text: `\n📄 ${doc.filename}:\n\`\`\`\n${doc.content}\n\`\`\``,
        });
      }
    }

    return [{ role: 'user', content: contentParts }];
  }
}
