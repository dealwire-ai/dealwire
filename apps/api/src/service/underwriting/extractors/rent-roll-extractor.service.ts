import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { S3Service } from '../../s3/s3.service';
import { extractorModel } from '../model-config';
import { ClassifiedDocument } from './document-classifier.service';
import {
  RentRollExtractionSchema,
  RentRollExtraction,
  excelToText,
} from './extraction-types';

const SYSTEM_PROMPT = `You are an expert real estate underwriter extracting data from a Rent Roll (Schedule of Rent).

Rules:
- Extract every unit row into the units array. Do not skip rows.
- unit: the unit identifier (e.g. "101", "A1", "PH2"). Required.
- type: unit type as written ("1BR", "2BR/1BA", "Studio", "Commercial", etc.). Null if not stated.
- tenant: tenant name. Null if vacant or not listed.
- sqFt: rentable square feet. Null if not stated.
- monthlyRent: current monthly rent in dollars. Null if vacant. Do NOT use market rent for vacant units.
- leaseStart / leaseEnd: as written (ISO date preferred, raw string otherwise). Null if not stated.
- isVacant: true if unit has no tenant or rent is 0.

Summary fields:
- totalUnits: total unit count (occupied + vacant).
- occupiedUnits: count of non-vacant units.
- vacantUnits: count of vacant units.
- grossPotentialRent: monthly sum of all units at market rate (if stated). Null if not available.
- effectiveGrossRent: monthly sum of actual rents for occupied units only.
- vacancyRate: vacantUnits / totalUnits as a decimal.
- averageRentPerUnit: effectiveGrossRent / occupiedUnits.

If the document uses annual figures, divide by 12. Add a flag.
Set confidence (0–1) based on completeness. Flag data quality issues.`;

@Injectable()
export class RentRollExtractorService {
  private readonly logger = new Logger(RentRollExtractorService.name);

  constructor(private readonly s3Service: S3Service) {}

  async extract(
    doc: ClassifiedDocument,
    neededFields?: string[],
  ): Promise<RentRollExtraction> {
    this.logger.log(`[rent-roll-extractor] Extracting from "${doc.filename}"`);

    const isPdf =
      doc.contentType === 'application/pdf' ||
      doc.filename.toLowerCase().endsWith('.pdf');

    const fieldHint = neededFields?.length
      ? `\n\nThe client's pro forma requires these specific fields: [${neededFields.join(', ')}]. Prioritize extracting these exact values.`
      : '';

    let userText: string;

    if (isPdf) {
      // PDF rent rolls are rare but possible — pass as native doc block
      const buffer = await this.s3Service.downloadDealAttachment(doc.s3Key);
      const content: Array<{ type: string; [key: string]: any }> = [
        { type: 'file', data: buffer, mimeType: 'application/pdf' },
        {
          type: 'text',
          text: `Filename: "${doc.filename}"\n\nExtract every unit from this Rent Roll.${fieldHint}`,
        },
      ];

      const { object } = await generateObject({
        model: extractorModel(),
        schema: RentRollExtractionSchema,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: content as any }],
        maxTokens: 16000,
      });

      this.logger.log(
        `[rent-roll-extractor] Done: totalUnits=${object.totalUnits} vacancyRate=${object.vacancyRate} confidence=${object.confidence?.toFixed(2)}`,
      );

      return object as RentRollExtraction;
    }

    // Excel / CSV — convert sheets to CSV text
    const buffer = await this.s3Service.downloadDealAttachment(doc.s3Key);
    const text = excelToText(buffer);
    userText = `Filename: "${doc.filename}"\n\n${text}\n\nExtract every unit from this Rent Roll.${fieldHint}`;

    const { object } = await generateObject({
      model: extractorModel(),
      schema: RentRollExtractionSchema,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userText }],
      maxTokens: 16000,
    });

    this.logger.log(
      `[rent-roll-extractor] Done: totalUnits=${object.totalUnits} vacancyRate=${object.vacancyRate} confidence=${object.confidence?.toFixed(2)}`,
    );

    return object as RentRollExtraction;
  }
}
