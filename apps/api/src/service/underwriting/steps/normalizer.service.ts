import { Injectable, Logger } from '@nestjs/common';
import { ExtractionResults } from '../extractors/extraction-types';

export interface NormalizedResult {
  reconciledNoi: number | null;
  reconciledOccupancyRate: number | null;
  reconciledTotalUnits: number | null;
  annualGrossRent: number | null;
  effectiveGrossIncome: number | null;
  expenseRatio: number | null;
  flags: string[];
}

@Injectable()
export class NormalizerService {
  private readonly logger = new Logger(NormalizerService.name);

  normalize(extraction: ExtractionResults): NormalizedResult {
    const { om, rentRoll, t12 } = extraction;
    const flags: string[] = [];

    // ── Step 3: Derive missing fields ──────────────────────────────────────────

    // Vacancy rate from unit counts if not stated
    let vacancyRate = rentRoll?.vacancyRate ?? null;
    if (vacancyRate === null && rentRoll?.totalUnits && rentRoll.vacantUnits !== null) {
      vacancyRate = rentRoll.vacantUnits / rentRoll.totalUnits;
    }

    // Annual gross rental income from rent roll monthly × 12
    let annualGrossRent: number | null = null;
    if (rentRoll?.grossPotentialRent !== null && rentRoll?.grossPotentialRent !== undefined) {
      annualGrossRent = rentRoll.grossPotentialRent * 12;
    } else if (t12?.grossRentalIncome !== null && t12?.grossRentalIncome !== undefined) {
      annualGrossRent = t12.grossRentalIncome;
    }

    // Effective gross income
    let effectiveGrossIncome: number | null = null;
    if (t12?.effectiveGrossIncome !== null && t12?.effectiveGrossIncome !== undefined) {
      effectiveGrossIncome = t12.effectiveGrossIncome;
    } else if (annualGrossRent !== null && vacancyRate !== null) {
      effectiveGrossIncome = annualGrossRent * (1 - vacancyRate);
    }

    // Expense ratio from T-12 if not stated
    let expenseRatio: number | null = null;
    if (t12?.expenseRatio !== null && t12?.expenseRatio !== undefined) {
      expenseRatio = t12.expenseRatio;
    } else if (
      t12?.operatingExpenses !== null &&
      t12?.operatingExpenses !== undefined &&
      effectiveGrossIncome
    ) {
      expenseRatio = t12.operatingExpenses / effectiveGrossIncome;
    }

    // ── Step 4: Reconcile cross-document conflicts ──────────────────────────────

    // Unit count: OM vs rent roll
    if (om?.totalUnits && rentRoll?.totalUnits) {
      const delta = Math.abs(om.totalUnits - rentRoll.totalUnits) / om.totalUnits;
      if (delta > 0.05) {
        flags.push(
          `Unit count mismatch: OM says ${om.totalUnits}, rent roll shows ${rentRoll.totalUnits}`,
        );
      }
    }

    // NOI: OM vs T-12
    if (om?.noi && t12?.noi) {
      const delta = Math.abs(om.noi - t12.noi) / om.noi;
      if (delta > 0.1) {
        flags.push(
          `NOI conflict: OM $${om.noi.toLocaleString()} vs T-12 $${t12.noi.toLocaleString()}`,
        );
      }
    }

    // Occupancy: OM vs rent roll
    const rentRollOccupancy =
      vacancyRate !== null ? 1 - vacancyRate : rentRoll?.occupiedUnits && rentRoll?.totalUnits
        ? rentRoll.occupiedUnits / rentRoll.totalUnits
        : null;

    if (om?.occupancyRate && rentRollOccupancy !== null) {
      const delta = Math.abs(om.occupancyRate - rentRollOccupancy);
      if (delta > 0.05) {
        flags.push(
          `Occupancy mismatch: OM ${(om.occupancyRate * 100).toFixed(1)}% vs rent roll ${(rentRollOccupancy * 100).toFixed(1)}%`,
        );
      }
    }

    // Prefer T-12 NOI if available and high-confidence, else fall back to OM
    let reconciledNoi: number | null = null;
    if (t12?.noi !== null && t12?.noi !== undefined && t12.confidence > 0.7) {
      reconciledNoi = t12.noi;
    } else if (om?.noi !== null && om?.noi !== undefined) {
      reconciledNoi = om.noi;
    }

    const reconciledOccupancyRate =
      rentRollOccupancy ?? om?.occupancyRate ?? null;

    const reconciledTotalUnits =
      rentRoll?.totalUnits ?? om?.totalUnits ?? null;

    if (flags.length > 0) {
      this.logger.warn(`[normalizer] ${flags.length} reconciliation flag(s): ${flags.join(' | ')}`);
    }

    return {
      reconciledNoi,
      reconciledOccupancyRate,
      reconciledTotalUnits,
      annualGrossRent,
      effectiveGrossIncome,
      expenseRatio,
      flags,
    };
  }
}
