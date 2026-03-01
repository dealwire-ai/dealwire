import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { S3Service } from '../../s3/s3.service';
import { ExtractionResults } from '../extractors/extraction-types';
import { FieldMapEntry } from '../proforma.service';
import { NormalizedResult } from './normalizer.service';

// xlsx-populate ships no TypeScript types — use require with any
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XlsxPopulate = require('xlsx-populate') as any;

const MappingSchema = z.object({
  mappings: z.array(
    z.object({
      name: z.string(),
      value: z.union([z.number(), z.string()]).nullable(),
    }),
  ),
});

@Injectable()
export class ProformaFillService {
  private readonly logger = new Logger(ProformaFillService.name);

  constructor(private readonly s3: S3Service) {}

  async fill(
    proformaS3Key: string,
    fieldMap: FieldMapEntry[],
    extraction: ExtractionResults,
    normalized: NormalizedResult,
    dealId: string,
  ): Promise<string> {
    // Download template
    const templateBuffer = await this.s3.downloadDealAttachment(proformaS3Key);

    // Ask Haiku to map field names → best values from extraction data
    const fieldValues = await this.mapFieldsWithAI(fieldMap, extraction, normalized);

    // Write values into the workbook
    const workbook = await XlsxPopulate.fromDataAsync(templateBuffer);
    let filled = 0;
    for (const entry of fieldMap) {
      const mapped = fieldValues.find((m) => m.name === entry.name);
      if (mapped?.value !== null && mapped?.value !== undefined) {
        try {
          workbook.sheet(entry.sheet)?.cell(entry.cell)?.value(mapped.value);
          filled++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`[${dealId}] Could not write ${entry.name} to ${entry.sheet}!${entry.cell}: ${msg}`);
        }
      }
    }

    this.logger.log(`[${dealId}] Filled ${filled}/${fieldMap.length} proforma cells`);

    // Serialize and upload
    const outputBuffer = await workbook.outputAsync();
    const s3Key = await this.s3.uploadFilledProforma(Buffer.from(outputBuffer), dealId);
    this.logger.log(`[${dealId}] Filled proforma uploaded to S3: ${s3Key}`);
    return s3Key;
  }

  private async mapFieldsWithAI(
    fieldMap: FieldMapEntry[],
    extraction: ExtractionResults,
    normalized: NormalizedResult,
  ): Promise<Array<{ name: string; value: number | string | null }>> {
    const fieldList = fieldMap.map((f) => `- ${f.name}: ${f.description}`).join('\n');
    const extractionJson = JSON.stringify({ extraction, normalized }, null, 2);

    try {
      const { object } = await generateObject({
        model: anthropic('claude-haiku-4-5-20251001'),
        schema: MappingSchema,
        system: `You are mapping real estate deal data to pro forma input fields.
For each field, find the best matching value from the extraction data.
Return null if no confident match exists. Use numbers for numeric fields (not strings).
Do not invent values — only use what's present in the extraction data.`,
        messages: [
          {
            role: 'user',
            content: `Pro forma fields:\n${fieldList}\n\nExtraction data:\n${extractionJson}\n\nMap each field to the best available value. Return null for any field without a confident match.`,
          },
        ],
      });

      return object.mappings as Array<{ name: string; value: number | string | null }>;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`[proforma-fill] AI mapping failed: ${msg}`);
      return fieldMap.map((f) => ({ name: f.name, value: null }));
    }
  }
}
