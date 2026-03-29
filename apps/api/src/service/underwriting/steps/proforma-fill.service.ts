import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { z } from 'zod';
import { mapperModel } from '../model-config';
import { S3Service } from '../../s3/s3.service';
import {
  ExtractionResults,
  RentRollExtraction,
} from '../extractors/extraction-types';
import { FieldMapEntry } from '../proforma.service';
import { ResolvedMetrics } from './extraction-reconciler.service';

// xlsx-populate ships no TypeScript types — use require with any
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XlsxPopulate = require('xlsx-populate') as any;

const MappingSchema = z.object({
  mappings: z.array(
    z.object({
      name: z.string(),
      value: z.union([z.number(), z.string()]).nullable(),
    }),
  ),
});

/** Aggregated unit mix row for proforma Unit Mix sheet. */
interface UnitMixRow {
  beds: number;
  baths: number;
  label: string; // "1 Bed(s)"
  sqFt: number; // avg sqft
  units: number;
  totalSqFt: number;
  avgRent: number; // avg monthly rent
}

@Injectable()
export class ProformaFillService {
  private readonly logger = new Logger(ProformaFillService.name);

  constructor(private readonly s3: S3Service) {}

  async fill(
    proformaS3Key: string,
    fieldMap: FieldMapEntry[],
    extraction: ExtractionResults,
    normalized: ResolvedMetrics,
    dealId: string,
  ): Promise<string> {
    // Download template
    const templateBuffer = await this.s3.downloadDealAttachment(proformaS3Key);

    // Step A: Build direct mappings from extraction (no AI needed)
    const directMappings = this.buildDirectMappings(
      fieldMap,
      extraction,
      normalized,
    );

    // Step B: Ask AI to map remaining fields.
    // Exclude investor-assumption fields — these should never be filled from
    // deal documents. They represent the buyer's underwriting parameters.
    const INVESTOR_ASSUMPTION_PATTERNS =
      /growth|discount rate|exit cap|capex|deficit reserve|reno|closing cost|loan|ltv|amortization|interest rate|refinance|stabiliz|disposition|sale cost|concession|bad debt|vacancy.*(?:rate|loss)|fee.*%|loan fee|acq.*fee/i;

    const unmappedFields = fieldMap.filter(
      (f) =>
        !directMappings.has(f.name) &&
        !INVESTOR_ASSUMPTION_PATTERNS.test(f.name),
    );
    const aiMappings =
      unmappedFields.length > 0
        ? await this.mapFieldsWithAI(unmappedFields, extraction, normalized)
        : [];

    // Merge: direct takes priority over AI
    const allMappings = new Map<string, number | string | null>();
    for (const m of aiMappings) {
      allMappings.set(m.name, m.value);
    }
    for (const [name, value] of directMappings) {
      allMappings.set(name, value);
    }

    // Write values into the workbook
    const workbook = await XlsxPopulate.fromDataAsync(templateBuffer);

    // Step C: Clear all mapped cells first (prevent stale template data)
    for (const entry of fieldMap) {
      try {
        const sheet = workbook.sheet(entry.sheet);
        if (sheet) {
          const cell = sheet.cell(entry.cell);
          if (cell) cell.value('');
        }
      } catch {
        // ignore — cell may not exist in template
      }
    }

    // Step D: Write mapped values
    let filled = 0;
    for (const entry of fieldMap) {
      const value = allMappings.get(entry.name);
      if (value !== null && value !== undefined && value !== '') {
        try {
          workbook.sheet(entry.sheet)?.cell(entry.cell)?.value(value);
          filled++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `[${dealId}] Could not write ${entry.name} to ${entry.sheet}!${entry.cell}: ${msg}`,
          );
        }
      }
    }

    // Step E: Fill unit mix rows if rent roll data exists
    if (extraction.rentRoll) {
      const unitMixFilled = this.fillUnitMix(
        workbook,
        extraction.rentRoll,
        dealId,
      );
      filled += unitMixFilled;
    }

    this.logger.log(
      `[${dealId}] Filled ${filled}/${fieldMap.length} proforma cells (${directMappings.size} direct, ${filled - directMappings.size} AI/unit-mix)`,
    );

    // Serialize and upload
    const outputBuffer = await workbook.outputAsync();
    const s3Key = await this.s3.uploadFilledProforma(
      Buffer.from(outputBuffer),
      dealId,
    );
    this.logger.log(`[${dealId}] Filled proforma uploaded to S3: ${s3Key}`);
    return s3Key;
  }

  /**
   * Build deterministic field→value mappings from extraction data.
   * These bypass the AI mapper for fields that have clear 1:1 matches.
   */
  private buildDirectMappings(
    fieldMap: FieldMapEntry[],
    extraction: ExtractionResults,
    normalized: ResolvedMetrics,
  ): Map<string, number | string> {
    const map = new Map<string, number | string>();
    const { om, t12, rentRoll } = extraction;

    // Build a lookup of field names (lowercase) to actual field names
    const fieldNameLookup = new Map<string, string>();
    for (const f of fieldMap) {
      fieldNameLookup.set(f.name.toLowerCase(), f.name);
    }

    // Helper to set a mapping if the field exists in the field map.
    // Uses boundary-aware matching to avoid cross-contamination
    // (e.g. 'state' matching "Real Estate", 'city' matching "Electricity").
    // Uses (?<![a-zA-Z]) / (?![a-zA-Z]) instead of \b to handle patterns
    // starting with non-word chars like "# of units".
    // Tolerates trailing plural 's' (e.g. "contract" matches "contracts").
    const trySet = (
      patterns: string[],
      value: number | string | null,
      exclude?: RegExp,
    ) => {
      if (value === null || value === undefined) return;
      for (const pattern of patterns) {
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(?<![a-zA-Z])${escaped}s?(?![a-zA-Z])`, 'i');
        for (const [lower, actual] of fieldNameLookup) {
          if (re.test(lower) && (!exclude || !exclude.test(lower))) {
            map.set(actual, value);
            return;
          }
        }
      }
    };

    // Property info from OM
    if (om) {
      trySet(
        ['property name', 'name'],
        om.propertyName ?? om.propertyAddress?.split(',')[0]?.trim() ?? null,
      );
      trySet(['address'], om.propertyAddress);
      trySet(['city'], om.city);
      trySet(['state'], om.state);
      trySet(
        ['zip'],
        om.zipCode ??
          (om.propertyAddress ? this.extractZip(om.propertyAddress) : null),
      );
      trySet(
        ['units unrenovated', 'total units', 'number of units', '# of units'],
        om.totalUnits,
      );
      trySet(['rentable sf', 'total sf', 'rentable square'], om.totalSqFt);
      trySet(['year built'], om.yearBuilt);
      trySet(
        ['purchase price', 'asking price', 'acquisition price'],
        om.askingPrice,
      );
      trySet(['cap rate'], om.capRate);
    }

    // Rent roll data
    if (rentRoll) {
      if (!om?.totalUnits && rentRoll.totalUnits) {
        trySet(
          ['units unrenovated', 'total units', 'number of units'],
          rentRoll.totalUnits,
        );
      }
      trySet(['physical vacancy'], rentRoll.vacancyRate);
    }

    // T-12 income and expenses
    // Exclude pattern prevents dollar amounts from matching growth-rate /
    // percentage fields that happen to share keywords (e.g. "Property Tax
    // Growth Year 1" vs "Property Taxes Annual").
    const notGrowthRate = /growth|rate|year\s*[0-9]|percentage|%/i;

    if (t12) {
      trySet(
        ['property tax', 'real estate tax', 'taxes'],
        t12.taxes,
        notGrowthRate,
      );
      trySet(['property insurance', 'insurance'], t12.insurance, notGrowthRate);
      // Management fee as dollar amount for expense fields
      trySet(
        ['management fee annual', 'property management annual'],
        t12.managementFees,
        notGrowthRate,
      );
      // Management fee as percentage for percentage fields
      if (t12.managementFees && t12.effectiveGrossIncome) {
        const mgmtPct = t12.managementFees / t12.effectiveGrossIncome;
        trySet(['management fee percentage'], mgmtPct);
      }
      trySet(['administrative', 'admin'], t12.administrative, notGrowthRate);
      trySet(['waste', 'trash'], t12.wasteDisposal, notGrowthRate);
      trySet(
        ['water and sewer', 'water & sewer', 'water/sewer'],
        t12.waterAndSewer,
        notGrowthRate,
      );
      trySet(['gas'], t12.gas, notGrowthRate);
      trySet(['electric'], t12.electric, notGrowthRate);
      trySet(['telephone', 'telecom'], t12.telephone, notGrowthRate);
      trySet(
        ['repair', 'r&m', 'repairs and maintenance'],
        t12.repairsAndMaintenance,
        notGrowthRate,
      );
      trySet(['pest control'], t12.pestControl, notGrowthRate);
      trySet(['landscaping', 'lawn'], t12.landscaping, notGrowthRate);
      trySet(['contract'], t12.contracts, notGrowthRate);
      trySet(
        ['make ready', 'make-ready', 'turn cost'],
        t12.makeReady,
        notGrowthRate,
      );
      trySet(['supplies'], t12.supplies, notGrowthRate);
      trySet(['advertising', 'marketing'], t12.advertising, notGrowthRate);
      trySet(['security'], t12.securityMonitoring, notGrowthRate);
      trySet(
        ['tenant reimbursement', 'utility reimbursement', 'utility income'],
        t12.utilityReimbursement,
        notGrowthRate,
      );
      trySet(['garage rent', 'parking income'], t12.garageRent, notGrowthRate);
      trySet(['pet rent'], t12.petRent, notGrowthRate);
      trySet(['other income'], t12.otherIncome, notGrowthRate);
      trySet(
        ['gross rental income', 'gross potential rent'],
        t12.grossRentalIncome,
        notGrowthRate,
      );
      trySet(
        ['effective gross income', 'egi'],
        t12.effectiveGrossIncome,
        notGrowthRate,
      );
    }

    // Normalized / reconciled
    if (normalized.reconciledNoi) {
      trySet(['noi', 'net operating income'], normalized.reconciledNoi);
    }
    if (normalized.effectiveGrossIncome) {
      trySet(
        ['effective gross income', 'egi'],
        normalized.effectiveGrossIncome,
      );
    }
    if (normalized.reconciledOccupancyRate) {
      trySet(['occupancy'], normalized.reconciledOccupancyRate);
    }

    return map;
  }

  /** Extract zip code from an address string. */
  private extractZip(address: string): string | null {
    const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
    return match?.[1] ?? null;
  }

  /**
   * Aggregate rent roll units by bed/bath type and fill the Unit Mix sheet.
   * Returns the number of cells written.
   */
  private fillUnitMix(
    workbook: any,
    rentRoll: RentRollExtraction,
    dealId: string,
  ): number {
    const sheet = workbook.sheet('Unit Mix');
    if (!sheet) {
      this.logger.warn(
        `[${dealId}] No "Unit Mix" sheet found — skipping unit mix fill`,
      );
      return 0;
    }

    const unitMix = this.aggregateUnitMix(rentRoll);
    if (unitMix.length === 0) return 0;

    // Template layout (Fern Forest): rows 2-3 are headers, data in rows 4-31.
    // Row 32 = Totals (SUM formulas), Row 33 = Averages.
    // Columns: B=Unit Name, D=Beds, E=Baths, G=SF/Unit, H=Units, J=Rent/Unit
    // Columns I (Total SF), K (Total Rent) are formulas — don't overwrite.
    const startRow = 4; // first data row (rows 2-3 are headers)
    const maxRows = 28; // rows 4-31
    const clearCols = ['B', 'C', 'D', 'E', 'G', 'H', 'J'];

    // Clear existing data rows to prevent stale template data
    for (let i = 0; i < maxRows; i++) {
      const row = startRow + i;
      for (const col of clearCols) {
        try {
          sheet.cell(`${col}${row}`).value('');
        } catch {
          // cell may not exist
        }
      }
    }

    let cellsWritten = 0;

    for (let i = 0; i < unitMix.length && i < maxRows; i++) {
      const row = startRow + i;
      const mix = unitMix[i];
      try {
        sheet.cell(`B${row}`).value(`${mix.beds}BR/${mix.baths}BA`);
        sheet.cell(`D${row}`).value(mix.beds);
        sheet.cell(`E${row}`).value(mix.baths);
        sheet.cell(`G${row}`).value(Math.round(mix.sqFt));
        sheet.cell(`H${row}`).value(mix.units);
        sheet.cell(`J${row}`).value(Math.round(mix.avgRent));
        cellsWritten += 6;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `[${dealId}] Could not write unit mix row ${row}: ${msg}`,
        );
      }
    }

    this.logger.log(
      `[${dealId}] Filled ${unitMix.length} unit mix rows (${cellsWritten} cells)`,
    );
    return cellsWritten;
  }

  /** Group rent roll units by bed/bath type and compute averages. */
  private aggregateUnitMix(rentRoll: RentRollExtraction): UnitMixRow[] {
    const groups = new Map<
      string,
      {
        beds: number;
        baths: number;
        sqFts: number[];
        rents: number[];
        count: number;
      }
    >();

    for (const unit of rentRoll.units) {
      if (!unit.type) continue;

      // Parse bed/bath from type string (e.g. "1/1.00", "2/2.00", "1BR/1BA")
      const parsed = this.parseBedBath(unit.type);
      if (!parsed) continue;

      const key = `${parsed.beds}/${parsed.baths}`;
      const group = groups.get(key) ?? {
        beds: parsed.beds,
        baths: parsed.baths,
        sqFts: [],
        rents: [],
        count: 0,
      };
      group.count++;
      if (unit.sqFt) group.sqFts.push(unit.sqFt);
      if (unit.monthlyRent && !unit.isVacant)
        group.rents.push(unit.monthlyRent);
      groups.set(key, group);
    }

    return Array.from(groups.values())
      .map((g) => ({
        beds: g.beds,
        baths: g.baths,
        label: `${g.beds} Bed(s)`,
        sqFt:
          g.sqFts.length > 0
            ? g.sqFts.reduce((a, b) => a + b, 0) / g.sqFts.length
            : 0,
        units: g.count,
        totalSqFt: g.sqFts.reduce((a, b) => a + b, 0),
        avgRent:
          g.rents.length > 0
            ? g.rents.reduce((a, b) => a + b, 0) / g.rents.length
            : 0,
      }))
      .sort((a, b) => a.beds - b.beds || a.baths - b.baths);
  }

  /** Parse bed/bath from various formats: "1/1.00", "2/2", "1BR/1.5BA", "1 Bed / 1.5 Bath" */
  private parseBedBath(type: string): { beds: number; baths: number } | null {
    // Try "N/N" or "N/N.00" format
    const slashMatch = type.match(/^(\d+)\s*\/\s*(\d+(?:\.\d+)?)/);
    if (slashMatch) {
      return {
        beds: parseInt(slashMatch[1]),
        baths: parseFloat(slashMatch[2]),
      };
    }
    // Try "1BR/1.5BA" or "1 Bed / 1.5 Bath" format
    const brMatch = type.match(/(\d+)\s*(?:BR|Bed)/i);
    const baMatch = type.match(/(\d+(?:\.\d+)?)\s*(?:BA|Bath)/i);
    if (brMatch) {
      return {
        beds: parseInt(brMatch[1]),
        baths: baMatch ? parseFloat(baMatch[1]) : 1,
      };
    }
    return null;
  }

  private async mapFieldsWithAI(
    fieldMap: FieldMapEntry[],
    extraction: ExtractionResults,
    normalized: ResolvedMetrics,
  ): Promise<Array<{ name: string; value: number | string | null }>> {
    const fieldList = fieldMap
      .map((f) => `- ${f.name}: ${f.description}`)
      .join('\n');
    const extractionJson = JSON.stringify({ extraction, normalized }, null, 2);

    const MAX_ATTEMPTS = 3;
    const RATE_LIMIT_WAITS_MS = [65_000, 90_000];

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const { object } = await generateObject({
          model: mapperModel(),
          maxRetries: 0,
          schema: MappingSchema,
          system: `You are mapping real estate deal data to pro forma input fields.
For each field, find the best matching value from the extraction data.
Return null if no confident match exists. Use numbers for numeric fields (not strings).
Do not invent values — only use what's present in the extraction data.
For percentage fields (vacancy, cap rate, expense ratios), return as decimals (e.g. 0.05 for 5%).

IMPORTANT: Return null for fields that are investor assumptions or projections, NOT extractable
from deal documents. These include: loan terms (interest rates, amortization, LTV), renovation costs,
closing costs, fee percentages, growth rates, discount rates, exit cap rates, stabilization timelines,
disposition years, CAPEX reserves, and any field about future projections. Only map fields where the
extraction data contains a clear, factual match.`,
          messages: [
            {
              role: 'user',
              content: `Pro forma fields:\n${fieldList}\n\nExtraction data:\n${extractionJson}\n\nMap each field to the best available value. Return null for any field without a confident match.`,
            },
          ],
        });

        return object.mappings as Array<{
          name: string;
          value: number | string | null;
        }>;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isRateLimit =
          msg.toLowerCase().includes('rate limit') || msg.includes('429');

        if (isRateLimit && attempt < MAX_ATTEMPTS) {
          const waitMs = RATE_LIMIT_WAITS_MS[attempt - 1] ?? 90_000;
          this.logger.warn(
            `[proforma-fill] Rate limit hit (attempt ${attempt}/${MAX_ATTEMPTS}) — waiting ${waitMs / 1000}s before retry`,
          );
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }

        this.logger.error(
          `[proforma-fill] AI mapping failed after ${attempt} attempt(s): ${msg}`,
        );
        return fieldMap.map((f) => ({ name: f.name, value: null }));
      }
    }

    return fieldMap.map((f) => ({ name: f.name, value: null }));
  }
}
