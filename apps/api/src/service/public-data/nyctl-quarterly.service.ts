import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';
import { IngestionResult } from './nyc-ingestion.service';

/** Raw row from the NYCTL quarterly XLSX report */
interface NyctlRow {
  zip: string;
  buildingClass: string; // normalized, e.g. "R4"
  taxClass: string;
  balanceSold: number;
  redemptiveValue: number;
  servicer: string; // "MTAG" or "Tower"
  redeemed: boolean;
  foreclosureStatus: string | null;
  saleDate: string | null;
  trustVintage: string; // e.g. "2025-A"
  currentOwner: string;
}

/** Match key: zip|buildingClass|taxClass */
type MatchKey = string;

function makeMatchKey(
  zip: string,
  buildingClass: string,
  taxClass: string,
): MatchKey {
  return `${zip}|${buildingClass}|${taxClass}`;
}

/**
 * Normalize building class from XLSX format like "R4: Condominiums" → "R4"
 */
function normalizeBuildingClass(raw: string | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  // Take everything before the colon, or the whole string if no colon
  const prefix = trimmed.split(':')[0].trim();
  return prefix.toUpperCase();
}

/**
 * Parse a numeric value from XLSX cell (could be number or string)
 */
function parseAmount(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[$,\s]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return 0;
}

/**
 * Determine trust vintage from the file/sheet name.
 * Examples: "2025-A", "1998-2"
 */
function parseTrustVintage(sheetName: string): string {
  // Sheet names like "NYCTL 2025-A", "NYCTL 1998-2", etc.
  const match = sheetName.match(/(\d{4}-[A-Za-z0-9]+)/);
  return match ? match[1] : sheetName;
}

/**
 * Detect the servicer from sheet/report data.
 * MTAG and Tower are the two NYCTL servicers.
 */
function detectServicer(row: Record<string, unknown>): string {
  const servicerField =
    (row['Servicer'] as string) ||
    (row['servicer'] as string) ||
    (row['SERVICER'] as string) ||
    '';
  if (servicerField) return servicerField.trim();

  // Try to detect from other fields
  const currentOwner =
    (row['Current Owner'] as string) || (row['current_owner'] as string) || '';
  if (currentOwner.toLowerCase().includes('tower')) return 'Tower';
  if (currentOwner.toLowerCase().includes('mtag')) return 'MTAG';
  return '';
}

@Injectable()
export class NyctlQuarterlyService {
  private readonly logger = new Logger(NyctlQuarterlyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Main entry point: download XLSX, parse, crosswalk match, and write to DB.
   * @param reportDate - Date string like "9-30-2025" matching the DOF URL format
   */
  async ingestNyctlQuarterly(reportDate: string): Promise<IngestionResult> {
    const start = Date.now();
    this.logger.log(
      `Starting NYCTL quarterly ingestion for report date: ${reportDate}`,
    );

    // 1. Download + parse XLSX
    const nyctlRows = await this.downloadAndParse(reportDate);
    this.logger.log(
      `Parsed ${nyctlRows.length} NYCTL rows from quarterly report`,
    );

    if (nyctlRows.length === 0) {
      return {
        source: 'nyctl_quarterly',
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        durationMs: Date.now() - start,
      };
    }

    // 2. Filter to active liens only (exclude resolved)
    const activeRows = nyctlRows.filter(
      (r) => !r.currentOwner.toLowerCase().includes('resolved'),
    );
    this.logger.log(
      `${activeRows.length} active rows after filtering (${nyctlRows.length - activeRows.length} resolved)`,
    );

    // 3. Load parcels with active liens
    const parcels = await this.prisma.parcel.findMany({
      where: { hasActiveLien: true },
      select: {
        bbl: true,
        zipCode: true,
        buildingClass: true,
        taxClass: true,
      },
    });
    this.logger.log(`Loaded ${parcels.length} parcels with active liens`);

    // 4. Build match indices
    const parcelsByKey = new Map<MatchKey, string[]>(); // key → bbl[]
    for (const p of parcels) {
      if (!p.zipCode || !p.buildingClass || !p.taxClass) continue;
      const key = makeMatchKey(p.zipCode, p.buildingClass, p.taxClass);
      if (!parcelsByKey.has(key)) parcelsByKey.set(key, []);
      parcelsByKey.get(key)!.push(p.bbl);
    }

    const nyctlByKey = new Map<MatchKey, NyctlRow[]>();
    for (const row of activeRows) {
      if (!row.zip || !row.buildingClass || !row.taxClass) continue;
      const key = makeMatchKey(row.zip, row.buildingClass, row.taxClass);
      if (!nyctlByKey.has(key)) nyctlByKey.set(key, []);
      nyctlByKey.get(key)!.push(row);
    }

    // 5. Tiered matching
    const bblUpdates = new Map<
      string,
      {
        lienSaleAmount: number;
        lienRedemptiveValue: number;
        lienServicer: string | null;
        lienRedeemed: boolean | null;
        lienForeclosureStatus: string | null;
        lienSaleDate: string | null;
        lienTrustVintage: string | null;
        lienMatchConfidence: string;
        lienMatchGroupSize: number;
      }
    >();

    const tierCounts = {
      exact: 0,
      group_small: 0,
      group_large: 0,
      estimated: 0,
      unmatched: 0,
    };

    for (const [key, bbls] of parcelsByKey) {
      const rows = nyctlByKey.get(key);
      if (!rows || rows.length === 0) {
        tierCounts.unmatched += bbls.length;
        continue;
      }

      const parcelCount = bbls.length;
      const rowCount = rows.length;

      let confidence: string;
      let amounts: number[];
      let redemptiveValues: number[];

      if (parcelCount === 1 && rowCount === 1) {
        // Tier 1: Exact match
        confidence = 'exact';
        amounts = [rows[0].balanceSold];
        redemptiveValues = [rows[0].redemptiveValue];
        tierCounts.exact++;
      } else if (parcelCount === rowCount && parcelCount <= 3) {
        // Tier 2: Small group (N=N, N<=3) — use average
        confidence = 'group_small';
        amounts = rows.map((r) => r.balanceSold);
        redemptiveValues = rows.map((r) => r.redemptiveValue);
        tierCounts.group_small += parcelCount;
      } else if (parcelCount === rowCount) {
        // Tier 3: Large group (N=N, N>3) — use average
        confidence = 'group_large';
        amounts = rows.map((r) => r.balanceSold);
        redemptiveValues = rows.map((r) => r.redemptiveValue);
        tierCounts.group_large += parcelCount;
      } else {
        // Tier 4: Mismatched counts — use median
        confidence = 'estimated';
        amounts = rows.map((r) => r.balanceSold);
        redemptiveValues = rows.map((r) => r.redemptiveValue);
        tierCounts.estimated += parcelCount;
      }

      const avgAmount =
        confidence === 'estimated'
          ? median(amounts)
          : amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const avgRedemptive =
        confidence === 'estimated'
          ? median(redemptiveValues)
          : redemptiveValues.reduce((a, b) => a + b, 0) /
            redemptiveValues.length;

      // Servicer: only set if all rows agree
      const servicers = [
        ...new Set(rows.map((r) => r.servicer).filter(Boolean)),
      ];
      const servicer = servicers.length === 1 ? servicers[0] : null;

      // Redeemed: if ANY row is redeemed, flag as uncertain
      const anyRedeemed = rows.some((r) => r.redeemed);
      const allRedeemed = rows.every((r) => r.redeemed);
      const redeemed =
        confidence === 'exact'
          ? rows[0].redeemed
          : allRedeemed
            ? true
            : anyRedeemed
              ? null
              : false;

      // Foreclosure status: only for exact matches
      const foreclosureStatus =
        confidence === 'exact' ? rows[0].foreclosureStatus : null;

      // Sale date: use latest
      const saleDate = rows[0].saleDate;

      // Trust vintage: use latest
      const trustVintage = rows[0].trustVintage;

      const groupSize = Math.max(parcelCount, rowCount);

      for (const bbl of bbls) {
        const existing = bblUpdates.get(bbl);
        if (existing) {
          // Multi-trust merging: sum amounts, keep latest vintage
          existing.lienSaleAmount += avgAmount;
          existing.lienRedemptiveValue += avgRedemptive;
          if (trustVintage) existing.lienTrustVintage = trustVintage;
        } else {
          bblUpdates.set(bbl, {
            lienSaleAmount: Math.round(avgAmount * 100) / 100,
            lienRedemptiveValue: Math.round(avgRedemptive * 100) / 100,
            lienServicer: servicer,
            lienRedeemed: redeemed,
            lienForeclosureStatus: foreclosureStatus,
            lienSaleDate: saleDate,
            lienTrustVintage: trustVintage,
            lienMatchConfidence: confidence,
            lienMatchGroupSize: groupSize,
          });
        }
      }
    }

    this.logger.log(
      `Match tier distribution: exact=${tierCounts.exact}, group_small=${tierCounts.group_small}, group_large=${tierCounts.group_large}, estimated=${tierCounts.estimated}, unmatched=${tierCounts.unmatched}`,
    );

    // 6. Reset NYCTL fields for all active-lien parcels, then write matches
    const now = new Date();
    await this.prisma.parcel.updateMany({
      where: { hasActiveLien: true },
      data: {
        lienSaleAmount: null,
        lienRedemptiveValue: null,
        lienServicer: null,
        lienRedeemed: null,
        lienForeclosureStatus: null,
        lienSaleDate: null,
        lienTrustVintage: null,
        lienMatchConfidence: null,
        lienMatchGroupSize: null,
        nyctlSyncedAt: now,
      },
    });

    let updated = 0;
    for (const [bbl, data] of bblUpdates) {
      await this.prisma.parcel.updateMany({
        where: { bbl },
        data: {
          ...data,
          lienSaleAmount: Math.round(data.lienSaleAmount * 100) / 100,
          lienRedemptiveValue: Math.round(data.lienRedemptiveValue * 100) / 100,
          nyctlSyncedAt: now,
        },
      });
      updated++;
    }

    const duration = Date.now() - start;
    this.logger.log(
      `NYCTL quarterly ingestion complete: ${updated} parcels updated in ${duration}ms`,
    );

    return {
      source: 'nyctl_quarterly',
      recordsProcessed: activeRows.length,
      recordsCreated: 0,
      recordsUpdated: updated,
      durationMs: duration,
    };
  }

  /**
   * Download the quarterly XLSX report from NYC DOF and parse all sheets.
   */
  private async downloadAndParse(reportDate: string): Promise<NyctlRow[]> {
    // URL format: https://www.nyc.gov/assets/finance/downloads/pdf/lien_sale/quarterly_status_reports/{YEAR}/nyctl-city-council-quarterly-status-report-{M-DD-YYYY}.xlsx
    const parts = reportDate.split('-');
    const year = parts[parts.length - 1]; // last part is year
    const url = `https://www.nyc.gov/assets/finance/downloads/pdf/lien_sale/quarterly_status_reports/${year}/nyctl-city-council-quarterly-status-report-${reportDate}.xlsx`;

    this.logger.log(`Downloading NYCTL report from: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to download NYCTL report: ${response.status} ${response.statusText} (URL: ${url})`,
      );
    }

    const buffer = await response.arrayBuffer();
    const workbook = XLSX.read(Buffer.from(buffer), { type: 'buffer' });

    const allRows: NyctlRow[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const trustVintage = parseTrustVintage(sheetName);
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      for (const row of jsonData) {
        // Try various column name patterns
        const zip = String(
          row['Zip Code'] ??
            row['ZipCode'] ??
            row['zip_code'] ??
            row['ZIP CODE'] ??
            row['Zip'] ??
            '',
        ).trim();
        const rawBuildingClass = String(
          row['Building Class'] ??
            row['Bldg Class'] ??
            row['building_class'] ??
            row['BUILDING CLASS'] ??
            '',
        );
        const taxClass = String(
          row['Tax Class'] ??
            row['TaxClass'] ??
            row['tax_class'] ??
            row['TAX CLASS'] ??
            '',
        ).trim();

        const buildingClass = normalizeBuildingClass(rawBuildingClass);
        if (!zip || !buildingClass || !taxClass) continue;

        const balanceSold = parseAmount(
          row['Balance Sold'] ??
            row['Bal Sold'] ??
            row['balance_sold'] ??
            row['BALANCE SOLD'] ??
            0,
        );
        const redemptiveValue = parseAmount(
          row['Redemptive Value'] ??
            row['Redemptive Amount'] ??
            row['redemptive_value'] ??
            row['REDEMPTIVE VALUE'] ??
            0,
        );
        const currentOwner = String(
          row['Current Owner'] ??
            row['current_owner'] ??
            row['CURRENT OWNER'] ??
            '',
        ).trim();

        const servicer = detectServicer(row);

        const redeemedRaw = String(
          row['Redeemed'] ?? row['redeemed'] ?? row['REDEEMED'] ?? '',
        )
          .trim()
          .toLowerCase();
        const redeemed =
          redeemedRaw === 'yes' ||
          redeemedRaw === 'y' ||
          redeemedRaw === 'true';

        const foreclosureStatus =
          String(
            row['Foreclosure Status'] ??
              row['foreclosure_status'] ??
              row['FORECLOSURE STATUS'] ??
              '',
          ).trim() || null;

        const saleDate =
          String(
            row['Sale Date'] ?? row['sale_date'] ?? row['SALE DATE'] ?? '',
          ).trim() || null;

        allRows.push({
          zip,
          buildingClass,
          taxClass,
          balanceSold,
          redemptiveValue,
          servicer,
          redeemed,
          foreclosureStatus,
          saleDate,
          trustVintage,
          currentOwner,
        });
      }
    }

    return allRows;
  }
}

/** Compute median of a number array */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}
