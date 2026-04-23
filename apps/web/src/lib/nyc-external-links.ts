import { parseBbl } from "@/lib/bbl";

const DOB_NOW_SEARCH_URL =
  "https://a810-dobnow.nyc.gov/Publish/Index.html#!/search";

export function parseNycAddress(
  address: string | null,
): { houseNumber: string; streetName: string } | null {
  if (!address) return null;
  const trimmed = address.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\S+)\s+(.+)$/);
  if (!match) return null;
  const houseNumber = match[1].trim();
  const streetName = match[2].trim();
  if (!houseNumber || !streetName) return null;
  if (!/\d/.test(houseNumber)) return null;
  return { houseNumber, streetName };
}

export function buildDobBisUrl(
  borough: string,
  address: string | null,
): string | null {
  const parsed = parseNycAddress(address);
  if (!parsed) return null;
  const params = new URLSearchParams({
    boro: borough,
    houseno: parsed.houseNumber,
    street: parsed.streetName,
  });
  return `https://a810-bisweb.nyc.gov/bisweb/PropertyProfileOverviewServlet?${params.toString()}`;
}

export function getDobNowSearchUrl(): string {
  return DOB_NOW_SEARCH_URL;
}

// ACRIS legacy BBL search — auto-submits and returns the document index
// (deeds, mortgages, transfers, satisfactions) for the given parcel.
export function buildAcrisUrl(bbl: string): string | null {
  const parts = parseBbl(bbl);
  if (!parts.borough || !parts.block || !parts.lot) return null;
  const params = new URLSearchParams({
    borough: parts.borough,
    block: String(Number(parts.block)),
    lot: String(Number(parts.lot)),
  });
  return `https://a836-acris.nyc.gov/bblsearch/bblsearch.asp?${params.toString()}`;
}
