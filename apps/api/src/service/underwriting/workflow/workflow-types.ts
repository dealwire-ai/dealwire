import { z } from 'zod';

// ─── Call 1: Deal Analysis ───────────────────────────────────────────────────

/**
 * Flat schema for the deal analysis output.
 * The model reads ALL deal documents in one pass and produces a single
 * structured object — no separate classification or per-doc-type extraction.
 */
export const DealAnalysisSchema = z.object({
  // Property info
  propertyName: z.string().nullable(),
  propertyAddress: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zipCode: z.string().nullable(),
  propertyType: z.string().nullable(),
  yearBuilt: z.number().int().nullable(),
  totalUnits: z.number().int().nullable(),
  totalSqFt: z.number().nullable(),

  // Pricing
  askingPrice: z.number().nullable(),
  capRate: z.number().nullable(), // decimal (0.065 = 6.5%)
  pricePerUnit: z.number().nullable(),
  pricePerSqFt: z.number().nullable(),

  // Income (annual)
  grossPotentialRent: z.number().nullable(),
  effectiveGrossIncome: z.number().nullable(),
  otherIncome: z.number().nullable(),
  utilityReimbursement: z.number().nullable(),
  garageRent: z.number().nullable(),
  petRent: z.number().nullable(),
  lateFeesAndAdmin: z.number().nullable(),
  grossRentalIncome: z.number().nullable(),

  // Expenses (annual)
  operatingExpenses: z.number().nullable(),
  taxes: z.number().nullable(),
  insurance: z.number().nullable(),
  managementFees: z.number().nullable(),
  administrative: z.number().nullable(),
  wasteDisposal: z.number().nullable(),
  waterAndSewer: z.number().nullable(),
  gas: z.number().nullable(),
  electric: z.number().nullable(),
  telephone: z.number().nullable(),
  repairsAndMaintenance: z.number().nullable(),
  pestControl: z.number().nullable(),
  landscaping: z.number().nullable(),
  contracts: z.number().nullable(),
  makeReady: z.number().nullable(),
  supplies: z.number().nullable(),
  advertising: z.number().nullable(),
  securityMonitoring: z.number().nullable(),
  otherExpenses: z.number().nullable(),

  // Bottom line
  noi: z.number().nullable(),
  expenseRatio: z.number().nullable(), // decimal

  // Occupancy & rent
  occupancyRate: z.number().nullable(), // decimal (0.95 = 95%)
  vacancyRate: z.number().nullable(), // decimal
  averageRentPerUnit: z.number().nullable(), // monthly

  // Unit mix — aggregated by bed/bath type
  unitMix: z.array(
    z.object({
      beds: z.number().int(),
      baths: z.number(),
      unitCount: z.number().int(),
      avgSqFt: z.number().nullable(),
      avgMonthlyRent: z.number().nullable(),
    }),
  ),

  // Analyst output
  analystNotes: z.string(), // brief narrative about the deal
  missingDocs: z.array(z.string()), // e.g. ["T-12", "Rent Roll"]
  flags: z.array(z.string()), // reconciliation issues, red flags
  confidence: z.number().min(0).max(1),
});

export type DealAnalysis = z.infer<typeof DealAnalysisSchema>;

// ─── Call 2: Template Cell Mappings ──────────────────────────────────────────

export const CellMappingSchema = z.object({
  mappings: z.array(
    z.object({
      sheet: z.string(),
      cell: z.string(),
      value: z.union([z.number(), z.string()]),
    }),
  ),
});

export type CellMappings = z.infer<typeof CellMappingSchema>;

// ─── Call 3: Proforma Validation ─────────────────────────────────────────────

export const ValidationIssueSchema = z.object({
  severity: z.enum(['error', 'warning', 'info']),
  sheet: z.string().optional(),
  cell: z.string().optional(),
  description: z.string(),
});

export const ValidationCorrectionSchema = z.object({
  sheet: z.string(),
  cell: z.string(),
  currentValue: z.union([z.number(), z.string()]),
  correctValue: z.union([z.number(), z.string()]).nullable(),
  reason: z.string(),
});

export const ValidationResultSchema = z.object({
  verdict: z.enum(['pass', 'pass_with_warnings', 'fail']),
  issues: z.array(ValidationIssueSchema),
  corrections: z.array(ValidationCorrectionSchema),
});

export type ValidationResult = z.infer<typeof ValidationResultSchema>;
