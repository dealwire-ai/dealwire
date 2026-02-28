import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { S3Service } from '../s3/s3.service';
import { UnderwritingDocument } from './underwriting-orchestrator.service';

export type DocumentType = 'om' | 'rent-roll' | 't12' | 'proforma' | 'other';

export interface ClassifiedDocument extends UnderwritingDocument {
  documentType: DocumentType;
  confidence: number;
  reasoning: string;
}

const ClassificationSchema = z.object({
  documentType: z
    .enum(['om', 'rent-roll', 't12', 'proforma', 'other'])
    .describe(
      'om = Offering Memorandum, rent-roll = Rent Roll / Schedule of Rent, t12 = Trailing 12-Month Financials, proforma = Pro Forma template, other = anything else',
    ),
  confidence: z.number().min(0).max(1).describe('Confidence score 0–1'),
  reasoning: z.string().max(300).describe('Brief explanation of classification decision'),
});

const SYSTEM_PROMPT = `You are classifying commercial real estate documents for underwriting analysis.

Document types:
- om: Offering Memorandum — property overview, market analysis, investment thesis, asking price/cap rate
- rent-roll: Rent Roll or Schedule of Rent — tenant-by-tenant list with unit numbers, current rent, lease start/end dates
- t12: T-12 Trailing 12-Month Financials — monthly income and expense statement for the trailing 12 months
- proforma: Pro Forma — forward-looking financial projection, usually a template with formulas
- other: Floor plans, photos, legal docs, surveys, or anything not in the above categories

Respond with the document type, your confidence (0–1), and a brief reasoning.`;

@Injectable()
export class DocumentClassifierService {
  private readonly logger = new Logger(DocumentClassifierService.name);

  constructor(private readonly s3Service: S3Service) {}

  /**
   * Classify all documents in parallel. Each document gets its own Claude Haiku call.
   */
  async classify(documents: UnderwritingDocument[]): Promise<ClassifiedDocument[]> {
    return Promise.all(documents.map((doc) => this.classifyOne(doc)));
  }

  private async classifyOne(doc: UnderwritingDocument): Promise<ClassifiedDocument> {
    const isPdf =
      doc.contentType === 'application/pdf' ||
      doc.filename.toLowerCase().endsWith('.pdf');

    try {
      const content: Array<{ type: string; [key: string]: any }> = [
        {
          type: 'text',
          text: `Filename: "${doc.filename}"\nContent type: ${doc.contentType}\n\nClassify this commercial real estate document.`,
        },
      ];

      // For PDFs, download and pass as a native document block for higher accuracy.
      // For Excel/CSV, filename is almost always sufficient.
      if (isPdf) {
        try {
          const buffer = await this.s3Service.downloadDealAttachment(doc.s3Key);
          content.unshift({ type: 'file', data: buffer, mimeType: 'application/pdf' });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `Could not download PDF "${doc.filename}" for classification: ${msg} — using filename only`,
          );
        }
      }

      const { object } = await generateObject({
        model: anthropic('claude-haiku-4-5-20251001'),
        schema: ClassificationSchema,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: content as any }],
      });

      this.logger.log(
        `[classifier] "${doc.filename}" → ${object.documentType} (confidence=${object.confidence.toFixed(2)}) — ${object.reasoning}`,
      );

      return { ...doc, ...object };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Classification failed for "${doc.filename}": ${msg} — defaulting to other`,
      );
      return {
        ...doc,
        documentType: 'other',
        confidence: 0,
        reasoning: 'Classification failed',
      };
    }
  }
}
