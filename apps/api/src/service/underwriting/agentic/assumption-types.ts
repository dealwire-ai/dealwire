import { z } from 'zod';

/**
 * Canonical investor assumptions the pro forma needs from the user.
 * These are NEVER extractable from OM / rent roll / T-12 — they represent
 * the buyer's underwriting parameters.
 *
 * All values use decimal form (0.065 = 6.5%) except where noted.
 */
export const UserAssumptionsSchema = z.object({
  interestRate: z.number().nullable(),
  ltv: z.number().nullable(),
  amortizationYears: z.number().int().nullable(),
  holdPeriodYears: z.number().int().nullable(),
  exitCapRate: z.number().nullable(),
  rentGrowth: z.number().nullable(),
  expenseGrowth: z.number().nullable(),
  renovationBudget: z.number().nullable(),
  acquisitionCostsPct: z.number().nullable(),
});
export type UserAssumptions = z.infer<typeof UserAssumptionsSchema>;

export const AssumptionQuestionSchema = z.object({
  key: UserAssumptionsSchema.keyof(),
  question: z.string(),
  hint: z.string().nullable(),
  priority: z.enum(['required', 'recommended']),
});
export type AssumptionQuestion = z.infer<typeof AssumptionQuestionSchema>;

export const ParsedAssumptionsSchema = z.object({
  values: UserAssumptionsSchema,
  unparseable: z.array(
    z.object({
      key: z.string(),
      raw: z.string(),
      reason: z.string(),
    }),
  ),
});
export type ParsedAssumptions = z.infer<typeof ParsedAssumptionsSchema>;

/**
 * Default question set used as the canonical seed for AssumptionAskerService.
 * The asker may prune items the org's proforma doesn't need or augment with
 * template-specific fields.
 */
export const CANONICAL_ASSUMPTIONS: AssumptionQuestion[] = [
  {
    key: 'interestRate',
    question: 'Interest rate on acquisition debt?',
    hint: 'e.g. 6.5%',
    priority: 'required',
  },
  {
    key: 'ltv',
    question: 'Loan-to-value (LTV)?',
    hint: 'e.g. 70%',
    priority: 'required',
  },
  {
    key: 'amortizationYears',
    question: 'Amortization period (years)?',
    hint: 'e.g. 30',
    priority: 'required',
  },
  {
    key: 'holdPeriodYears',
    question: 'Hold period (years)?',
    hint: 'e.g. 5',
    priority: 'required',
  },
  {
    key: 'exitCapRate',
    question: 'Exit cap rate?',
    hint: 'e.g. 6.5% — often 25–50 bps above entry cap',
    priority: 'required',
  },
  {
    key: 'rentGrowth',
    question: 'Annual rent growth assumption?',
    hint: 'e.g. 3%',
    priority: 'recommended',
  },
  {
    key: 'expenseGrowth',
    question: 'Annual expense growth assumption?',
    hint: 'e.g. 3%',
    priority: 'recommended',
  },
  {
    key: 'renovationBudget',
    question: 'Renovation / CAPEX budget (total $)?',
    hint: 'e.g. $500,000 — enter 0 if no reno planned',
    priority: 'recommended',
  },
  {
    key: 'acquisitionCostsPct',
    question: 'Acquisition costs as % of purchase price?',
    hint: 'e.g. 2% covers closing, legal, DD',
    priority: 'recommended',
  },
];
