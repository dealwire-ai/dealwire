import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { CellMappingSchema, CellMappings, DealAnalysis } from './agentic-types';
import { excelToTextWithCellRefs } from '../extractors/extraction-types';

const SYSTEM_PROMPT = `You are mapping commercial real estate deal data into a pro forma Excel template.

You are given:
1. A structured JSON object containing all extracted deal metrics (property info, income, expenses, unit mix, etc.)
2. The contents of an Excel pro forma template, serialized with cell references. Each cell appears as CELLREF:"value", with (formula) marking computed cells.

Your task: for each INPUT cell in the template (not formula cells), determine if the deal data contains a matching value. If so, return a mapping of {sheet, cell, value}.

## CRITICAL: Stale data from prior deals

This template may have been previously used for a DIFFERENT property. You MUST overwrite any cells that contain data from a prior deal. Look for:
- A different property name, address, or location than the current deal
- Unit counts, rents, or financial figures that belong to a different property
- Any data sheets (rent roll detail, T-12 monthly data) populated with a prior deal's data

For cells with stale data: if the current deal has a matching value, map it. If the current deal does NOT have a value for that field (e.g. asking price is null), map the cell to an empty string "" to clear it. Do NOT leave stale data from a prior property in any cell.

## Rules

- ONLY map cells that are clearly INPUT cells — never overwrite formula cells (marked with "(formula)").
- Copy the sheet name and cell address EXACTLY as shown in the template data. Case-sensitive, verbatim.
- Use numbers for numeric values, not strings. For percentages stored as decimals in the deal data (e.g. 0.065 for 6.5%), check the template context: if the cell seems to expect a whole number percentage (e.g. nearby cells show "6.5" or the label says "%"), multiply by 100. If the cell expects a decimal, keep as-is.
- Do NOT map investor assumption fields (loan terms, interest rates, renovation budgets, exit cap rates, growth rates, hold period, discount rates, disposition timeline, CAPEX reserves). These are user inputs — leave them alone.
- DO map: property info (name, address, city, state, zip, units, sqft, year built), purchase price, income line items, expense line items, NOI, cap rate, occupancy, vacancy, unit mix data.
- For unit mix sheets: map bed/bath types, unit counts, average sqft, and average rents into the appropriate rows. If the template has more unit type rows than the deal data needs, clear the extra rows by mapping their cells to "" or 0.
- If a field in the deal data is null AND the cell is empty or has no stale data, skip it.
- If a field in the deal data is null BUT the cell has stale data from a prior deal, map it to "" to clear it.`;

@Injectable()
export class TemplateFillerService {
  private readonly logger = new Logger(TemplateFillerService.name);

  /**
   * Given a deal analysis and the raw proforma template buffer,
   * produce cell-level mappings via a single AI call.
   */
  async mapToTemplate(
    analysis: DealAnalysis,
    templateBuffer: Buffer,
    dealId: string,
  ): Promise<CellMappings> {
    const templateText = excelToTextWithCellRefs(templateBuffer, {
      inputSheetsOnly: true,
    });

    this.logger.log(
      `[${dealId}] Template serialized: ${templateText.length.toLocaleString()} chars`,
    );

    const analysisJson = JSON.stringify(analysis, null, 2);

    const { object } = await generateObject({
      model: anthropic('claude-sonnet-4-6'),
      schema: CellMappingSchema,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `## Deal Analysis Data\n\n\`\`\`json\n${analysisJson}\n\`\`\`\n\n## Pro Forma Template\n\n${templateText}\n\nMap the deal data to the appropriate input cells in this template. Return only cells where you have a confident match.`,
        },
      ],
      maxRetries: 2,
    });

    this.logger.log(
      `[${dealId}] Template fill: ${object.mappings.length} cell mappings produced`,
    );

    return object;
  }
}
