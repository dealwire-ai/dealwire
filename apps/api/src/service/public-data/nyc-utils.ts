/**
 * NYC-specific utilities for public data ingestion.
 * Borough mappings, BBL normalization, market value estimation.
 */

// Borough code ↔ abbreviation mapping
// Tax liens + HPD use numeric ("1"-"5"), PLUTO uses abbreviations
export const BOROUGH_NUMERIC_TO_ABBR: Record<string, string> = {
  '1': 'MN', // Manhattan
  '2': 'BX', // Bronx
  '3': 'BK', // Brooklyn
  '4': 'QN', // Queens
  '5': 'SI', // Staten Island
};

export const BOROUGH_ABBR_TO_NUMERIC: Record<string, string> = {
  MN: '1',
  BX: '2',
  BK: '3',
  QN: '4',
  SI: '5',
};

export const BOROUGH_NAMES: Record<string, string> = {
  '1': 'Manhattan',
  '2': 'Bronx',
  '3': 'Brooklyn',
  '4': 'Queens',
  '5': 'Staten Island',
};

// Building classes that indicate co-ops (should be excluded from distress analysis)
export const COOP_BUILDING_CLASSES = [
  'A8', 'C6', 'C8', 'CC', 'D0', 'D4', 'DC', 'H7', 'R9',
];

/**
 * Normalize borough, block, lot into a 10-character BBL string.
 * Format: borough(1) + block(5, zero-padded) + lot(4, zero-padded)
 */
export function normalizeBbl(borough: string, block: string, lot: string): string {
  const b = borough.trim();
  const bl = block.trim().padStart(5, '0');
  const lt = lot.trim().padStart(4, '0');
  return `${b}${bl}${lt}`;
}

/**
 * Parse a 10-char BBL into its components.
 */
export function parseBbl(bbl: string): { borough: string; block: string; lot: string } {
  return {
    borough: bbl.substring(0, 1),
    block: bbl.substring(1, 6),
    lot: bbl.substring(6, 10),
  };
}

/**
 * Estimate market value from assessed total value and tax class.
 * NYC assessment ratios:
 *   Tax class 1 (1-3 family residential): assessed at 6% of market value
 *   Tax class 2-4 (multi-family, commercial, utility): assessed at 45% of market value
 */
export function estimateMarketValue(
  assessTotal: number | null | undefined,
  taxClass: string | null | undefined,
): number | null {
  if (!assessTotal || assessTotal <= 0) return null;
  if (!taxClass) return null;

  const tc = taxClass.trim();
  if (tc === '1' || tc.startsWith('1')) {
    return Math.round(assessTotal / 0.06);
  }
  // Tax classes 2, 2a, 2b, 2c, 3, 4
  return Math.round(assessTotal / 0.45);
}

/**
 * Check if a building class indicates a co-op.
 */
export function isCoopBuildingClass(buildingClass: string | null | undefined): boolean {
  if (!buildingClass) return false;
  return COOP_BUILDING_CLASSES.includes(buildingClass.trim().toUpperCase());
}
