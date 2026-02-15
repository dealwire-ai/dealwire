export interface RealEstateExtractedData {
  askingPrice?: number | null;
  description?: string | null;
  propertyType?: string | null; // "multifamily", "office", "retail", "industrial", etc.
  capRate?: number | null; // decimal, e.g. 0.065
  noi?: number | null;
  occupancy?: number | null; // decimal, e.g. 0.95
  units?: number | null;
  squareFeet?: number | null;
  yearBuilt?: number | null;
  pricePerUnit?: number | null;
  pricePerSqFt?: number | null;
}

export type DealType = 'real_estate' | 'debt' | 'business' | 'unknown';

// ExtractedData is just RealEstateExtractedData for now.
// When we add debt/business support, this becomes a union type.
export type ExtractedData = RealEstateExtractedData;
