import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { CellMappingSchema, CellMappings, DealAnalysis } from './agentic-types';

const SYSTEM_PROMPT = `You are mapping commercial real estate deal data into a pro forma Excel template.

You are given:
1. A structured JSON object containing all extracted deal metrics (property info, income, expenses, unit mix, etc.)
2. The contents of an Excel pro forma template, serialized with cell references. Each cell appears as CELLREF:"value" with annotations:
   - (formula) = computed cell — NEVER overwrite
   - [input] = blue-formatted input cell — these are explicitly designated by the modeler as user inputs. PRIORITIZE filling these.

Your task: for each INPUT cell in the template (not formula cells), determine if the deal data contains a matching value. If so, return a mapping of {sheet, cell, value}.

## CRITICAL: Stale data from prior deals

This template may have been previously used for a DIFFERENT property. You MUST overwrite any cells that contain data from a prior deal. Look for:
- A different property name, address, or location than the current deal
- Unit counts, rents, or financial figures that belong to a different property
- Any data sheets (rent roll detail, T-12 monthly data) populated with a prior deal's data

For cells with stale data: if the current deal has a matching value, map it. If the current deal does NOT have a value for that field (e.g. asking price is null), map the cell to an empty string "" to clear it. Do NOT leave stale data from a prior property in any cell.

## Rules

- ONLY map cells that are clearly INPUT cells — never overwrite formula cells (marked with "(formula)"). Cells marked [input] (blue formatting) are confirmed inputs and should be prioritized.
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
   * Given a deal analysis and an xlsx-populate workbook,
   * produce cell-level mappings via a single AI call.
   * The workbook is serialized with color annotations so the AI
   * can distinguish blue input cells from labels and formulas.
   */
  async mapToTemplate(
    analysis: DealAnalysis,
    workbook: any, // xlsx-populate Workbook
    dealId: string,
  ): Promise<CellMappings> {
    const templateText = this.serializeWorkbook(workbook);

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

  /**
   * Serialize an xlsx-populate workbook to text with cell refs and color annotations.
   * Blue-font cells are marked [input], formula cells are marked (formula).
   * Sheets with only formula cells (no inputs) are skipped to save tokens.
   */
  private serializeWorkbook(workbook: any): string {
    const sheets: string[] = [];

    for (const sheet of workbook.sheets()) {
      const sheetName: string = sheet.name();
      const usedRange = sheet.usedRange();
      if (!usedRange) continue;

      const startRow: number = usedRange.startCell().rowNumber();
      const endRow: number = usedRange.endCell().rowNumber();
      const startCol: number = usedRange.startCell().columnNumber();
      const endCol: number = usedRange.endCell().columnNumber();

      const lines: string[] = [];
      let hasInputCells = false;

      for (let r = startRow; r <= endRow; r++) {
        const rowCells: string[] = [];
        for (let c = startCol; c <= endCol; c++) {
          const cell = sheet.cell(r, c);
          const value = cell.value();
          if (value === undefined || value === null || value === '') continue;

          const formula = cell.formula();
          const ref = cell.address();

          if (formula) {
            rowCells.push(`${ref}(formula):"${value}"`);
          } else {
            hasInputCells = true;
            const tag = this.isInputCell(cell) ? '[input]' : '';
            rowCells.push(`${ref}${tag}:"${value}"`);
          }
        }
        if (rowCells.length > 0) lines.push(rowCells.join('  '));
      }

      // Skip sheets with only formula cells
      if (!hasInputCells) continue;

      sheets.push(`=== Sheet: ${sheetName} ===\n${lines.join('\n')}`);
    }

    return sheets.join('\n\n');
  }

  /**
   * Detect whether a cell is a designated input cell based on styling.
   * CRE convention: blue font and/or light blue fill = user input.
   * Handles explicit RGB colors, theme-based colors, and fill as fallback.
   */
  private isInputCell(cell: any): boolean {
    const fontColor = cell.style('fontColor');
    if (fontColor) {
      // Explicit RGB — check if blue is the dominant channel
      if (fontColor.rgb) {
        if (this.isBlueRgb(fontColor.rgb)) return true;
      }
      // Theme-based — theme 4 is accent1 (blue in standard Office themes)
      if (fontColor.theme === 4) {
        return true;
      }
    }

    // Fallback: check fill color (light blue background = input)
    const fill = cell.style('fill');
    if (fill?.type === 'solid' && fill?.color) {
      if (fill.color.rgb && this.isBlueRgb(fill.color.rgb)) return true;
      if (fill.color.theme === 4) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if an AARRGGBB hex string represents a blue-ish color.
   * Blue-dominant means B channel > R and B channel > G with a minimum intensity.
   */
  private isBlueRgb(argb: string): boolean {
    // Format: "FFRRGGBB" or "RRGGBB"
    const hex = argb.length === 8 ? argb.slice(2) : argb;
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return b > 100 && b > r * 1.5 && b > g * 1.2;
  }
}
