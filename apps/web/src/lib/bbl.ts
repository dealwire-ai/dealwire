const BOROUGH_NAMES: Record<string, string> = {
  "1": "Manhattan",
  "2": "Bronx",
  "3": "Brooklyn",
  "4": "Queens",
  "5": "Staten Island",
};

export interface BblParts {
  borough: string;
  boroughName: string;
  block: string;
  lot: string;
  formatted: string;
}

export function parseBbl(bbl: string): BblParts {
  const digits = bbl.replace(/\D/g, "");
  if (digits.length !== 10) {
    return {
      borough: "",
      boroughName: "",
      block: "",
      lot: "",
      formatted: bbl,
    };
  }
  const borough = digits.slice(0, 1);
  const block = digits.slice(1, 6);
  const lot = digits.slice(6, 10);
  return {
    borough,
    boroughName: BOROUGH_NAMES[borough] ?? "",
    block,
    lot,
    formatted: `${borough}-${block}-${lot}`,
  };
}

export function formatBbl(bbl: string): string {
  return parseBbl(bbl).formatted;
}
