import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import {
  DealAnalysis,
  ValidationResultSchema,
  ValidationResult,
} from './agentic-types';
import { excelToTextWithCellRefs } from '../excel-utils';
import { validatorModel } from '../model-config';
import { trackLlm } from '../../llm/tracked-llm';

const SYSTEM_PROMPT = `You are a QA reviewer for commercial real estate pro forma models. You are given:

1. A structured deal analysis JSON (the "source of truth" for this deal's metrics)
2. The filled pro forma Excel template, serialized with cell references

Your job is to validate the filled pro forma against the deal analysis and catch errors.

## What to check

### Stale data from a prior deal
The template may have been previously used for a DIFFERENT property. Look for cells containing:
- A different property name, address, city, or state than the deal analysis
- Unit counts, rents, or financial figures that don't match the deal analysis and appear to be leftover from a prior use
- Entire sheets of data (rent rolls, T-12s) for a different property

For any stale data found, add a CORRECTION to clear or replace it.

### Value accuracy
- Do filled income/expense values match the deal analysis? Flag discrepancies > 1%.
- Are percentages in the right format? (Some cells expect 6.5, others expect 0.065)
- Were unit counts filled correctly? Do they sum to the total?

### Missing fills
- Are there obvious input cells that should have been filled but weren't? (e.g. property name is blank but we have it in the analysis)
- Note: investor assumptions (loan terms, growth rates, cap rates, hold period, etc.) should NOT be filled — don't flag those as missing.

### Internal consistency
- Does unit count in the unit mix sum to totalUnits?
- Is NOI approximately equal to EGI minus operating expenses?
- Do expense line items roughly sum to total operating expenses?

### Hallucinations
- Are there any filled values that don't correspond to ANY field in the deal analysis? These may be hallucinated.
- Check unit mix carefully — are bed/bath counts, sqft, and rents plausible given the deal analysis?

## Output rules

- verdict: "pass" if no errors, "pass_with_warnings" if only warnings/info, "fail" if any errors
- For corrections: set correctValue to the right value from the analysis, or null to clear a stale cell
- Be specific in descriptions — include the actual values you're comparing
- Don't flag investor assumption fields as issues`;

@Injectable()
export class ProformaValidatorService {
  private readonly logger = new Logger(ProformaValidatorService.name);

  async validate(
    filledTemplateBuffer: Buffer,
    analysis: DealAnalysis,
    dealId: string,
  ): Promise<ValidationResult> {
    const templateText = excelToTextWithCellRefs(filledTemplateBuffer);

    this.logger.log(
      `[${dealId}] Validating filled proforma: ${templateText.length.toLocaleString()} chars`,
    );

    const analysisJson = JSON.stringify(analysis, null, 2);

    const { object } = await trackLlm('agentic.validation', () =>
      generateObject({
        model: validatorModel(),
        schema: ValidationResultSchema,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `## Deal Analysis (source of truth)\n\n\`\`\`json\n${analysisJson}\n\`\`\`\n\n## Filled Pro Forma Template\n\n${templateText}\n\nValidate this filled pro forma against the deal analysis. Check for stale data from prior deals, incorrect values, hallucinations, and missing fills. Return corrections for anything that needs fixing.`,
          },
        ],
        maxRetries: 2,
      }),
    );

    const errorCount = object.issues.filter(
      (i) => i.severity === 'error',
    ).length;
    const warnCount = object.issues.filter(
      (i) => i.severity === 'warning',
    ).length;

    this.logger.log(
      `[${dealId}] Validation complete: verdict=${object.verdict} errors=${errorCount} warnings=${warnCount} corrections=${object.corrections.length}`,
    );

    return object;
  }
}
