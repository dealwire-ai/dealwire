/**
 * Serialize an xlsx-populate workbook to text with cell refs and color annotations.
 * Blue-font cells are marked [input], formula cells are marked (formula).
 * Sheets with only formula cells (no inputs) are skipped to save tokens.
 *
 * This output is consumed by:
 * - TemplateFillerService (decide which cells to fill from extraction)
 * - AssumptionAskerService (decide which canonical assumptions the template needs)
 */
export function serializeWorkbook(workbook: any): string {
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
        const formula = cell.formula();
        const ref = cell.address();
        const isEmpty = value === undefined || value === null || value === '';

        if (formula) {
          if (isEmpty) continue;
          rowCells.push(`${ref}(formula):"${value}"`);
          continue;
        }

        // Surface input cells even when empty — the model can't fill what it can't see.
        // Without this, blank inputs like an empty "Purchase Price" cell get silently skipped
        // and the resulting pro forma has broken downstream calcs (negative IRR, etc.).
        if (isInputCell(cell)) {
          hasInputCells = true;
          const valStr = isEmpty ? '<empty>' : String(value);
          rowCells.push(`${ref}[input]:"${valStr}"`);
          continue;
        }

        if (isEmpty) continue;
        hasInputCells = true;
        rowCells.push(`${ref}:"${value}"`);
      }
      if (rowCells.length > 0) lines.push(rowCells.join('  '));
    }

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
export function isInputCell(cell: any): boolean {
  const fontColor = cell.style('fontColor');
  if (fontColor) {
    if (fontColor.rgb) {
      if (isBlueRgb(fontColor.rgb)) return true;
    }
    if (fontColor.theme === 4) {
      return true;
    }
  }

  const fill = cell.style('fill');
  if (fill?.type === 'solid' && fill?.color) {
    if (fill.color.rgb && isBlueRgb(fill.color.rgb)) return true;
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
export function isBlueRgb(argb: string): boolean {
  const hex = argb.length === 8 ? argb.slice(2) : argb;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return b > 100 && b > r * 1.5 && b > g * 1.2;
}

/**
 * Extract just the [input] cells from a workbook, as a terse list for prompts
 * where the full serialization would be overkill. Returns a list of
 * `Sheet!A1: "label"` style lines for cells that are input-flagged.
 */
export function extractInputCells(workbook: any): string {
  const lines: string[] = [];

  for (const sheet of workbook.sheets()) {
    const sheetName: string = sheet.name();
    const usedRange = sheet.usedRange();
    if (!usedRange) continue;

    const startRow: number = usedRange.startCell().rowNumber();
    const endRow: number = usedRange.endCell().rowNumber();
    const startCol: number = usedRange.startCell().columnNumber();
    const endCol: number = usedRange.endCell().columnNumber();

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const cell = sheet.cell(r, c);
        if (cell.formula()) continue;
        if (!isInputCell(cell)) continue;

        const ref = cell.address();
        const value = cell.value();
        const label = nearbyLabel(sheet, r, c);
        const valueStr =
          value === undefined || value === null ? '' : String(value);
        lines.push(
          `${sheetName}!${ref}  label="${label}"  current="${valueStr}"`,
        );
      }
    }
  }

  return lines.join('\n');
}

export interface EmptyInputAudit {
  sheet: string;
  cell: string;
  label: string;
  wasAttempted: boolean;
}

/**
 * Walk the workbook for [input] cells that are still empty after fill.
 * `attemptedAddresses` is the set of `Sheet!Cell` keys the filler tried to
 * write — anything in that set whose value is now empty was an intentional
 * clear (the model decided to blank it). Anything not in that set was
 * skipped entirely (model didn't try, or no mapping).
 *
 * Use this to triage post-fill problems: empty inputs that were never
 * attempted point at extraction gaps or model misses; empty inputs that
 * WERE attempted point at intentional clears or template-side issues.
 */
export function auditEmptyInputs(
  workbook: any,
  attemptedAddresses: Set<string>,
): EmptyInputAudit[] {
  const out: EmptyInputAudit[] = [];

  for (const sheet of workbook.sheets()) {
    const sheetName: string = sheet.name();
    const usedRange = sheet.usedRange();
    if (!usedRange) continue;

    const startRow: number = usedRange.startCell().rowNumber();
    const endRow: number = usedRange.endCell().rowNumber();
    const startCol: number = usedRange.startCell().columnNumber();
    const endCol: number = usedRange.endCell().columnNumber();

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const cell = sheet.cell(r, c);
        if (cell.formula()) continue;
        if (!isInputCell(cell)) continue;

        const value = cell.value();
        const isEmpty = value === undefined || value === null || value === '';
        if (!isEmpty) continue;

        const ref = cell.address();
        out.push({
          sheet: sheetName,
          cell: ref,
          label: nearbyLabel(sheet, r, c),
          wasAttempted: attemptedAddresses.has(`${sheetName}!${ref}`),
        });
      }
    }
  }

  return out;
}

/**
 * Look left and above for a likely text label describing this input cell.
 * CRE proforma convention: label is usually the nearest non-empty text cell
 * to the left on the same row, falling back to the column header above.
 */
function nearbyLabel(sheet: any, row: number, col: number): string {
  for (let c = col - 1; c >= Math.max(1, col - 5); c--) {
    const v = sheet.cell(row, c).value();
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  for (let r = row - 1; r >= Math.max(1, row - 3); r--) {
    const v = sheet.cell(r, col).value();
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}
