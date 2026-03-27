import { z } from 'zod';
import * as XLSX from 'xlsx';

// ─── Shared helper ────────────────────────────────────────────────────────────

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
export function excelToTextWithCellRefs(buffer: Buffer): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  return workbook.SheetNames.map((sheetName) => {
    const ws = workbook.Sheets[sheetName];
    if (!ws['!ref']) return `=== Sheet: ${sheetName} ===\n(empty)`;

    const range = XLSX.utils.decode_range(ws['!ref']);
    const lines: string[] = [];

    for (let R = range.s.r; R <= range.e.r; R++) {
      const rowCells: string[] = [];
      for (let C = range.s.c; C <= range.e.c; C++) {
        const ref = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[ref];
        if (cell && cell.v !== undefined && cell.v !== '') {
          const tag = cell.f ? '(formula)' : '';
          rowCells.push(`${ref}${tag}:"${cell.v}"`);
        }
      }
      if (rowCells.length > 0) lines.push(rowCells.join('  '));
    }

    return `=== Sheet: ${sheetName} ===\n${lines.join('\n')}`;
  }).join('\n\n');
}

// ─── OM ───────────────────────────────────────────────────────────────────────

/**
 * Canonical extractedField keys: om.*
 * These match the fieldMap entries stored on the Proforma record.
 */
export const OMExtractionSchema = z.object({
  propertyName: z.string().nullable(), // e.g. "Preston Gardens Apartments"
  propertyAddress: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zipCode: z.string().nullable(),
  propertyType: z.string().nullable(), // "multifamily", "office", "retail", etc.
  yearBuilt: z.number().int().nullable(),
  totalUnits: z.number().int().nullable(),
  totalSqFt: z.number().nullable(),
  askingPrice: z.number().nullable(), // dollars
  capRate: z.number().nullable(), // decimal (0.065 = 6.5%)
  noi: z.number().nullable(), // annual, dollars
  occupancyRate: z.number().nullable(), // decimal (0.95 = 95%)
  confidence: z.number().min(0).max(1),
  flags: z.array(z.string()), // e.g. ["NOI not stated — derived from price × cap rate"]
});

export type OMExtraction = z.infer<typeof OMExtractionSchema>;

// ─── Rent Roll ────────────────────────────────────────────────────────────────

/**
 * Canonical extractedField keys: rentRoll.*
 */
export const RentRollUnitSchema = z.object({
  unit: z.string(),
  type: z.string().nullable(), // "1BR", "2BR/1BA", "Studio", etc.
  tenant: z.string().nullable(),
  sqFt: z.number().nullable(),
  monthlyRent: z.number().nullable(), // dollars
  leaseStart: z.string().nullable(), // ISO date string or raw
  leaseEnd: z.string().nullable(),
  isVacant: z.boolean(),
});

export const RentRollExtractionSchema = z.object({
  totalUnits: z.number().int().nullable(),
  occupiedUnits: z.number().int().nullable(),
  vacantUnits: z.number().int().nullable(),
  grossPotentialRent: z.number().nullable(), // monthly, dollars (all units at market)
  effectiveGrossRent: z.number().nullable(), // monthly, dollars (occupied only)
  vacancyRate: z.number().nullable(), // decimal
  averageRentPerUnit: z.number().nullable(), // monthly, dollars
  units: z.array(RentRollUnitSchema),
  confidence: z.number().min(0).max(1),
  flags: z.array(z.string()),
});

export type RentRollExtraction = z.infer<typeof RentRollExtractionSchema>;

// ─── T-12 ─────────────────────────────────────────────────────────────────────

/**
 * Canonical extractedField keys: t12.*
 */
export const T12ExtractionSchema = z.object({
  // Revenue (annual)
  grossRentalIncome: z.number().nullable(),
  otherIncome: z.number().nullable(),
  effectiveGrossIncome: z.number().nullable(),

  // Revenue detail (annual)
  utilityReimbursement: z.number().nullable(), // tenant utility bill-back
  garageRent: z.number().nullable(),
  petRent: z.number().nullable(),
  lateFeesAndAdmin: z.number().nullable(), // late fees, admin fees, lease termination fees

  // Expenses (annual) — totals
  operatingExpenses: z.number().nullable(), // total
  taxes: z.number().nullable(),
  insurance: z.number().nullable(),
  managementFees: z.number().nullable(),

  // Expense detail (annual line items)
  administrative: z.number().nullable(), // office, G&A, payroll, commissions
  wasteDisposal: z.number().nullable(), // trash removal
  waterAndSewer: z.number().nullable(),
  gas: z.number().nullable(),
  electric: z.number().nullable(), // electric / utilities (non-water, non-gas)
  telephone: z.number().nullable(),
  repairsAndMaintenance: z.number().nullable(),
  pestControl: z.number().nullable(),
  landscaping: z.number().nullable(),
  contracts: z.number().nullable(), // contract services
  makeReady: z.number().nullable(), // make-ready / turn costs (painting, carpet, cleaning)
  supplies: z.number().nullable(),
  advertising: z.number().nullable(),
  securityMonitoring: z.number().nullable(),
  otherExpenses: z.number().nullable(),

  // Bottom line (annual)
  noi: z.number().nullable(),
  expenseRatio: z.number().nullable(), // operatingExpenses / effectiveGrossIncome

  confidence: z.number().min(0).max(1),
  flags: z.array(z.string()),
});

export type T12Extraction = z.infer<typeof T12ExtractionSchema>;

// ─── Generic (unclassified docs) ──────────────────────────────────────────────

export interface GenericExtractionField {
  name: string;
  value: number | string | null;
  confidence: number;
}

export interface GenericExtraction {
  fields: GenericExtractionField[];
  flags: string[];
}

// ─── Aggregate ────────────────────────────────────────────────────────────────

export interface ExtractionResults {
  om: OMExtraction | null;
  rentRoll: RentRollExtraction | null;
  t12: T12Extraction | null;
  generic: GenericExtraction[];
}
