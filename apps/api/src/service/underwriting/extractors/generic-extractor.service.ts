import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { z } from 'zod';
import { S3Service } from '../../s3/s3.service';
import { ClassifiedDocument } from './document-classifier.service';
import { excelToText, GenericExtraction } from './extraction-types';
import { extractorModel, pdfExtractorModel } from '../model-config';

const GenericExtractionSchema = z.object({
  fields: z.array(
    z.object({
      name: z.string(),
      value: z.union([z.number(), z.string()]).nullable(),
      confidence: z.number().min(0).max(1),
    }),
  ),
  flags: z.array(z.string()),
});

@Injectable()
export class GenericExtractorService {
  private readonly logger = new Logger(GenericExtractorService.name);

  constructor(private readonly s3Service: S3Service) {}

  async extract(
    doc: ClassifiedDocument,
    neededFields: string[],
  ): Promise<GenericExtraction> {
    this.logger.log(
      `[generic-extractor] Extracting ${neededFields.length} fields from "${doc.filename}"`,
    );

    if (neededFields.length === 0) {
      return {
        fields: [],
        flags: ['No proforma fields configured — nothing to extract'],
      };
    }

    const fieldList = neededFields.map((f) => `- ${f}`).join('\n');

    const system = `You are extracting specific financial and property values from a real estate document.

You will be given a list of field names. Find the value for each field in the document. Return null for any field you cannot find.

Rules:
- Dollar values: return raw numbers without formatting (1,500,000 = 1500000)
- Percentage values: return as decimals (6.5% = 0.065)
- Text values (addresses, names, types): return as strings
- confidence: 0–1 based on how clearly the value was stated (1.0 = explicitly labeled, 0.5 = inferred)
- If a field is not present in the document, return null with confidence 0`;

    const isPdf =
      doc.contentType === 'application/pdf' ||
      doc.filename.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      const buffer = await this.s3Service.downloadDealAttachment(doc.s3Key);
      const content: Array<{ type: string; [key: string]: any }> = [
        { type: 'file', data: buffer, mimeType: 'application/pdf' },
        {
          type: 'text',
          text: `Filename: "${doc.filename}"\n\nExtract values for each of these fields:\n${fieldList}`,
        },
      ];

      const { object } = await generateObject({
        model: pdfExtractorModel(),
        schema: GenericExtractionSchema,
        system,
        messages: [{ role: 'user', content: content as any }],
      });

      this.logger.log(
        `[generic-extractor] Done: ${object.fields.filter((f) => f.value !== null).length}/${neededFields.length} fields found`,
      );
      return object as GenericExtraction;
    }

    // Excel / CSV
    const buffer = await this.s3Service.downloadDealAttachment(doc.s3Key);
    const rawText = excelToText(buffer);
    const MAX_CHARS = 120_000;
    const text =
      rawText.length > MAX_CHARS
        ? rawText.slice(0, MAX_CHARS) + '\n\n[... truncated ...]'
        : rawText;

    const { object } = await generateObject({
      model: extractorModel(),
      schema: GenericExtractionSchema,
      system,
      messages: [
        {
          role: 'user',
          content: `Filename: "${doc.filename}"\n\n${text}\n\nExtract values for each of these fields:\n${fieldList}`,
        },
      ],
    });

    this.logger.log(
      `[generic-extractor] Done: ${object.fields.filter((f) => f.value !== null).length}/${neededFields.length} fields found`,
    );
    return object as GenericExtraction;
  }
}
