import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { S3Service } from '../../s3/s3.service';
import { ClassifiedDocument } from './document-classifier.service';
import { OMExtractionSchema, OMExtraction, excelToText } from './extraction-types';

const SYSTEM_PROMPT = `You are an expert real estate underwriter extracting key metrics from an Offering Memorandum (OM).

Extract all values exactly as stated in the document. If a value is not present, return null. Do not infer or calculate values unless you explicitly flag the derivation in the flags array.

Percentage values: return as decimals (6.5% = 0.065, 95% = 0.95).
Dollar values: return raw numbers without formatting (1,500,000 = 1500000).
Cap rate: always decimal form.
If NOI is not stated but price and cap rate are, you may compute NOI = price × capRate and add a flag.

Set confidence (0–1) based on how complete and unambiguous the document is.
Add descriptive flags for any assumptions, derivations, or data quality issues.`;

@Injectable()
export class OMExtractorService {
  private readonly logger = new Logger(OMExtractorService.name);

  constructor(private readonly s3Service: S3Service) {}

  async extract(doc: ClassifiedDocument, neededFields?: string[]): Promise<OMExtraction> {
    this.logger.log(`[om-extractor] Extracting from "${doc.filename}"`);

    const isPdf =
      doc.contentType === 'application/pdf' ||
      doc.filename.toLowerCase().endsWith('.pdf');

    const fieldHint = neededFields?.length
      ? `\n\nThe client's pro forma requires these specific fields: [${neededFields.join(', ')}]. Prioritize extracting these exact values.`
      : '';

    const content: Array<{ type: string; [key: string]: any }> = [
      {
        type: 'text',
        text: `Filename: "${doc.filename}"\n\nExtract all OM fields from this Offering Memorandum.${fieldHint}`,
      },
    ];

    if (isPdf) {
      const buffer = await this.s3Service.downloadDealAttachment(doc.s3Key);
      content.unshift({ type: 'file', data: buffer, mimeType: 'application/pdf' });
    } else {
      // Excel / CSV — convert to text
      const buffer = await this.s3Service.downloadDealAttachment(doc.s3Key);
      const text = excelToText(buffer);
      content[0] = {
        type: 'text',
        text: `Filename: "${doc.filename}"\n\n${text}\n\nExtract all OM fields from this document.`,
      };
    }

    const { object } = await generateObject({
      model: anthropic('claude-sonnet-4-6'),
      schema: OMExtractionSchema,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: content as any }],
    });

    this.logger.log(
      `[om-extractor] Done: askingPrice=${object.askingPrice} capRate=${object.capRate} noi=${object.noi} confidence=${object.confidence?.toFixed(2)}`,
    );

    return object as OMExtraction;
  }
}
