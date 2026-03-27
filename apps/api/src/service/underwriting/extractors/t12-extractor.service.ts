import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { S3Service } from '../../s3/s3.service';
import { extractorModel, pdfExtractorModel } from '../model-config';
import { ClassifiedDocument } from './document-classifier.service';
import {
  T12ExtractionSchema,
  T12Extraction,
  excelToText,
} from './extraction-types';

const SYSTEM_PROMPT = `You are an expert real estate underwriter extracting annual income and expense figures from a T-12 (Trailing 12-Month) financial statement.

Rules:
- All values must be ANNUAL totals in dollars. If the document shows monthly columns, sum them. Add a flag if you summed monthly figures.
- Use the most recent 12-month period available.

INCOME FIELDS:
- grossRentalIncome: total scheduled / actual rent collected annually.
- otherIncome: everything that is not base rent (utility reimbursement, garage, pet rent, fees, etc.).
- effectiveGrossIncome: grossRentalIncome + otherIncome (net of vacancy if stated). Null if not derivable.
- utilityReimbursement: tenant utility bill-back / utility income. Null if not stated.
- garageRent: garage/parking income. Null if not stated.
- petRent: pet rent income. Null if not stated.
- lateFeesAndAdmin: late fees, admin fees, lease termination fees combined. Null if not stated.

EXPENSE FIELDS (all annual, exclude debt service / mortgage / interest / owner expenses):
- operatingExpenses: total of all operating expense line items.
- taxes: real estate / property taxes.
- insurance: property insurance.
- managementFees: property management fees.
- administrative: office expense, G&A, payroll, salaries, commissions combined.
- wasteDisposal: trash removal / waste collection.
- waterAndSewer: water & sewer combined.
- gas: natural gas. Null if not separately stated.
- electric: electric utilities. If "utilities" is a single line item that is NOT water/sewer/gas, put it here.
- telephone: telephone/telecom. Null if not stated.
- repairsAndMaintenance: repairs & maintenance.
- pestControl: pest control.
- landscaping: lawn & landscaping.
- contracts: contract services (not maintenance).
- makeReady: make-ready / unit turn costs — painting, carpet replacement, cleaning combined.
- supplies: supplies/materials.
- advertising: marketing & advertising.
- securityMonitoring: security monitoring. Null if not stated.
- otherExpenses: catch-all for any operating expense not in the above categories.

BOTTOM LINE:
- noi: effectiveGrossIncome - operatingExpenses. If explicitly stated, use stated value; if derived, add a flag.
- expenseRatio: operatingExpenses / effectiveGrossIncome as a decimal. Null if either is null.

Do NOT include debt service (mortgage, interest), owner expenses, or capital expenditures in operating expenses.
Set confidence (0–1) based on completeness. Flag assumptions and derivations.`;

@Injectable()
export class T12ExtractorService {
  private readonly logger = new Logger(T12ExtractorService.name);

  constructor(private readonly s3Service: S3Service) {}

  async extract(
    doc: ClassifiedDocument,
    neededFields?: string[],
  ): Promise<T12Extraction> {
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
        model: pdfExtractorModel(),
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
      model: extractorModel(),
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
