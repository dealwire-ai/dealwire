import * as XLSX from 'xlsx';

/**
 * Convert an Excel buffer to a readable text representation for Claude.
 * Each sheet becomes a labelled CSV block.
 */
export function excelToText(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  return workbook.SheetNames.map((name) => {
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name]);
    return `=== Sheet: ${name} ===\n${csv}`;
  }).join('\n\n');
}

/**
 * Convert an Excel buffer to a cell-reference-aware text representation.
 * Each non-empty cell is output as `REF: "value"` (formula cells marked).
 * Use this for template field scanning — CSV loses row numbers, causing
 * Claude to misidentify cell addresses.
 */
export function excelToTextWithCellRefs(
  buffer: Buffer,
  options?: { inputSheetsOnly?: boolean },
): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const filterInputOnly = options?.inputSheetsOnly ?? false;

  const sheets: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName];
    if (!ws['!ref']) {
      if (!filterInputOnly) sheets.push(`=== Sheet: ${sheetName} ===\n(empty)`);
      continue;
    }

    const range = XLSX.utils.decode_range(ws['!ref']);
    const lines: string[] = [];
    let hasInputCells = false;

    for (let R = range.s.r; R <= range.e.r; R++) {
      const rowCells: string[] = [];
      for (let C = range.s.c; C <= range.e.c; C++) {
        const ref = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[ref];
        if (cell && cell.v !== undefined && cell.v !== '') {
          const isFormula = !!cell.f;
          if (!isFormula) hasInputCells = true;
          const tag = isFormula ? '(formula)' : '';
          rowCells.push(`${ref}${tag}:"${cell.v}"`);
        }
      }
      if (rowCells.length > 0) lines.push(rowCells.join('  '));
    }

    if (filterInputOnly && !hasInputCells) continue;

    sheets.push(`=== Sheet: ${sheetName} ===\n${lines.join('\n')}`);
  }

  return sheets.join('\n\n');
}
