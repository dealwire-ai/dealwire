import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { S3Service } from '../../s3/s3.service';
import { ClassifiedDocument } from './document-classifier.service';
import { T12ExtractionSchema, T12Extraction, excelToText } from './extraction-types';

const SYSTEM_PROMPT = `You are an expert real estate underwriter extracting annual income and expense figures from a T-12 (Trailing 12-Month) financial statement.

Rules:
- All values must be ANNUAL totals in dollars. If the document shows monthly columns, sum them. Add a flag if you summed monthly figures.
- grossRentalIncome: total scheduled / actual rent collected annually.
- otherIncome: laundry, parking, late fees, etc. — everything that is not rent.
- effectiveGrossIncome: grossRentalIncome + otherIncome (net of vacancy if stated). Null if not derivable.
- operatingExpenses: total of all operating expense line items (exclude debt service).
- taxes, insurance, utilities, repairsAndMaintenance, managementFees: individual line items. Null if not separately stated.
- otherExpenses: catch-all for any operating expense not in the above categories.
- noi: effectiveGrossIncome - operatingExpenses. If explicitly stated, use stated value; if derived, add a flag.
- expenseRatio: operatingExpenses / effectiveGrossIncome as a decimal. Null if either is null.

Do NOT include debt service (mortgage, interest) in operating expenses.
Set confidence (0–1) based on completeness. Flag assumptions and derivations.`;

@Injectable()
export class T12ExtractorService {
  private readonly logger = new Logger(T12ExtractorService.name);

  constructor(private readonly s3Service: S3Service) {}

  async extract(doc: ClassifiedDocument, neededFields?: string[]): Promise<T12Extraction> {
    this.logger.log(`[t12-extractor] Extracting from "${doc.filename}"`);

    const isPdf =
      doc.contentType === 'application/pdf' ||
      doc.filename.toLowerCase().endsWith('.pdf');

    const fieldHint = neededFields?.length
      ? `\n\nThe client's pro forma requires these specific fields: [${neededFields.join(', ')}]. Prioritize extracting these exact values.`
      : '';

    if (isPdf) {
      const buffer = await this.s3Service.downloadDealAttachment(doc.s3Key);
      const content: Array<{ type: string; [key: string]: any }> = [
        { type: 'file', data: buffer, mimeType: 'application/pdf' },
        {
          type: 'text',
          text: `Filename: "${doc.filename}"\n\nExtract all T-12 income and expense figures.${fieldHint}`,
        },
      ];

      const { object } = await generateObject({
        model: anthropic('claude-sonnet-4-6'),
        schema: T12ExtractionSchema,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: content as any }],
      });

      this.logger.log(
        `[t12-extractor] Done: noi=${object.noi} expenseRatio=${object.expenseRatio} confidence=${object.confidence?.toFixed(2)}`,
      );

      return object as T12Extraction;
    }

    // Excel / CSV
    const buffer = await this.s3Service.downloadDealAttachment(doc.s3Key);
    const text = excelToText(buffer);

    const { object } = await generateObject({
      model: anthropic('claude-sonnet-4-6'),
      schema: T12ExtractionSchema,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Filename: "${doc.filename}"\n\n${text}\n\nExtract all T-12 income and expense figures.${fieldHint}`,
        },
      ],
    });

    this.logger.log(
      `[t12-extractor] Done: noi=${object.noi} expenseRatio=${object.expenseRatio} confidence=${object.confidence?.toFixed(2)}`,
    );

    return object as T12Extraction;
  }
}
