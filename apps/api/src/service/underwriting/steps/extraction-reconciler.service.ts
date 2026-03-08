import { Injectable, Logger } from '@nestjs/common';
import { ExtractionResults } from '../extractors/extraction-types';

/**
 * Canonical resolved deal data — produced from raw multi-doc extraction.
 *
 * The snapshot's job: take what was extracted from deal documents, derive
 * everything that can be mathematically computed, flag genuine data gaps,
 * and hand off a clean object that downstream steps (pro forma fill, delivery
 * email) can work from without touching raw extraction results again.
 */
export interface ResolvedMetrics {
  // Income
  annualGrossRent: number | null; // GPR or effective gross rent × 12
  effectiveGrossIncome: number | null; // annualGrossRent × (1 - vacancyRate)

  // Expenses / returns
  reconciledNoi: number | null; // T-12 preferred; OM fallback
  capRate: number | null; // From OM if stated; derived from NOI/price otherwise
  expenseRatio: number | null; // operatingExpenses / EGI

  // Property facts
  reconciledOccupancyRate: number | null;
  reconciledTotalUnits: number | null;

  // Reconciliation + data quality
  flags: string[]; // Cross-document conflicts + derivation notes
  missingDocs: string[]; // Doc types not provided (e.g. 't12', 'rent-roll')
}

@Injectable()
export class ExtractionReconcilerService {
  private readonly logger = new Logger(ExtractionReconcilerService.name);

  resolve(extraction: ExtractionResults): ResolvedMetrics {
    const { om, rentRoll, t12 } = extraction;
    const flags: string[] = [];
    const missingDocs: string[] = [];

    // ── Flag missing documents ─────────────────────────────────────────────────
    if (!t12) missingDocs.push('t12');
    if (!rentRoll) missingDocs.push('rent-roll');
    if (!om) missingDocs.push('om');

    if (!t12) {
      flags.push(
        'No T-12 provided — expense data unavailable. Re-send with T-12 for operating expenses and expense ratio.',
      );
    }

    // ── Vacancy rate ───────────────────────────────────────────────────────────
    let vacancyRate = rentRoll?.vacancyRate ?? null;
    if (
      vacancyRate === null &&
      rentRoll?.totalUnits &&
      rentRoll.vacantUnits !== null
    ) {
      vacancyRate = rentRoll.vacantUnits / rentRoll.totalUnits;
    }

    // ── Annual gross rent ──────────────────────────────────────────────────────
    // Prefer grossPotentialRent (market rate); fall back to effectiveGrossRent
    // (actual rents) when market rate isn't stated — common when occupancy is 100%
    // and there's no separate market rent column.
    let annualGrossRent: number | null = null;
    if (rentRoll?.grossPotentialRent != null) {
      annualGrossRent = rentRoll.grossPotentialRent * 12;
    } else if (rentRoll?.effectiveGrossRent != null) {
      annualGrossRent = rentRoll.effectiveGrossRent * 12;
      flags.push(
        'Annual gross rent derived from effective gross rent (no market rent column in rent roll).',
      );
    } else if (t12?.grossRentalIncome != null) {
      annualGrossRent = t12.grossRentalIncome;
    }

    // ── Effective gross income ─────────────────────────────────────────────────
    let effectiveGrossIncome: number | null = null;
    if (t12?.effectiveGrossIncome != null) {
      effectiveGrossIncome = t12.effectiveGrossIncome;
    } else if (annualGrossRent != null && vacancyRate != null) {
      effectiveGrossIncome = annualGrossRent * (1 - vacancyRate);
    } else if (annualGrossRent != null && vacancyRate === null) {
      // No vacancy data — assume fully occupied (conservative)
      effectiveGrossIncome = annualGrossRent;
      flags.push(
        'EGI assumed equal to gross rent — no vacancy rate available.',
      );
    }

    // ── Expense ratio ──────────────────────────────────────────────────────────
    let expenseRatio: number | null = null;
    if (t12?.expenseRatio != null) {
      expenseRatio = t12.expenseRatio;
    } else if (t12?.operatingExpenses != null && effectiveGrossIncome) {
      expenseRatio = t12.operatingExpenses / effectiveGrossIncome;
    }

    // ── NOI ───────────────────────────────────────────────────────────────────
    // Prefer T-12 when high confidence; OM as fallback.
    // Also try to back into NOI from EGI - expenses if T-12 has line items.
    let reconciledNoi: number | null = null;
    if (t12?.noi != null && t12.confidence > 0.7) {
      reconciledNoi = t12.noi;
    } else if (om?.noi != null) {
      reconciledNoi = om.noi;
    } else if (effectiveGrossIncome != null && t12?.operatingExpenses != null) {
      reconciledNoi = effectiveGrossIncome - t12.operatingExpenses;
      flags.push(
        'NOI derived from EGI minus operating expenses (T-12 line items).',
      );
    }

    // ── Cap rate ──────────────────────────────────────────────────────────────
    // Use OM stated cap rate first; derive from NOI / price when not stated.
    let capRate: number | null = om?.capRate ?? null;
    if (
      capRate === null &&
      reconciledNoi != null &&
      om?.askingPrice != null &&
      om.askingPrice > 0
    ) {
      capRate = reconciledNoi / om.askingPrice;
      flags.push(
        `Cap rate derived: ${(capRate * 100).toFixed(2)}% (NOI $${reconciledNoi.toLocaleString()} ÷ asking price $${om.askingPrice.toLocaleString()}).`,
      );
    }

    // ── Cross-document reconciliation ──────────────────────────────────────────
    if (om?.totalUnits && rentRoll?.totalUnits) {
      const delta =
        Math.abs(om.totalUnits - rentRoll.totalUnits) / om.totalUnits;
      if (delta > 0.05) {
        flags.push(
          `Unit count mismatch: OM says ${om.totalUnits}, rent roll shows ${rentRoll.totalUnits}`,
        );
      }
    }

    if (om?.noi && t12?.noi) {
      const delta = Math.abs(om.noi - t12.noi) / om.noi;
      if (delta > 0.1) {
        flags.push(
          `NOI conflict: OM $${om.noi.toLocaleString()} vs T-12 $${t12.noi.toLocaleString()}`,
        );
      }
    }

    const rentRollOccupancy =
      vacancyRate !== null
        ? 1 - vacancyRate
        : rentRoll?.occupiedUnits && rentRoll?.totalUnits
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

    const reconciledOccupancyRate =
      rentRollOccupancy ?? om?.occupancyRate ?? null;
    const reconciledTotalUnits = rentRoll?.totalUnits ?? om?.totalUnits ?? null;

    if (flags.length > 0) {
      this.logger.log(
        `[deal-snapshot] ${flags.length} flag(s): ${flags.join(' | ')}`,
      );
    }

    return {
      annualGrossRent,
      effectiveGrossIncome,
      reconciledNoi,
      capRate,
      expenseRatio,
      reconciledOccupancyRate,
      reconciledTotalUnits,
      flags,
      missingDocs,
    };
  }
}
