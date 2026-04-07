export interface Parcel {
  parcel_id: string;
  address: string;
  town: string;
  county: "Belknap" | "Carroll";
  owner: string;
  acreage: number;
  land_use:
    | "Vacant"
    | "Residential"
    | "Commercial"
    | "Agricultural"
    | "Industrial";
  assessed_land: number;
  assessed_total: number;
  last_sale_date: string;
  last_sale_price: number | null;
  zoning_district: string;
  zoning_description: string;
  min_lot_size_sf: number;
  max_building_height: number;
  allows_residential: boolean;
  allows_multifamily: boolean;
  allows_adu: boolean;
  development_score: number;
}

// Real towns in Belknap and Carroll County, NH
const BELKNAP_TOWNS = [
  "Alton",
  "Barnstead",
  "Belmont",
  "Center Harbor",
  "Gilford",
  "Gilmanton",
  "Laconia",
  "Meredith",
  "New Hampton",
  "Sanbornton",
  "Tilton",
];

const CARROLL_TOWNS = [
  "Albany",
  "Bartlett",
  "Brookfield",
  "Chatham",
  "Conway",
  "Eaton",
  "Effingham",
  "Freedom",
  "Hart's Location",
  "Jackson",
  "Madison",
  "Moultonborough",
  "Ossipee",
  "Sandwich",
  "Tamworth",
  "Tuftonboro",
  "Wakefield",
  "Wolfeboro",
];

// Real zoning districts from NH Zoning Atlas for these counties
const ZONING_DISTRICTS: Record<
  string,
  {
    description: string;
    min_lot_sf: number;
    max_height: number;
    allows_res: boolean;
    allows_mf: boolean;
    allows_adu: boolean;
  }
> = {
  "R-1": {
    description: "Single-Family Residential",
    min_lot_sf: 40000,
    max_height: 35,
    allows_res: true,
    allows_mf: false,
    allows_adu: true,
  },
  "R-2": {
    description: "General Residential",
    min_lot_sf: 20000,
    max_height: 35,
    allows_res: true,
    allows_mf: true,
    allows_adu: true,
  },
  RR: {
    description: "Rural Residential",
    min_lot_sf: 87120,
    max_height: 35,
    allows_res: true,
    allows_mf: false,
    allows_adu: true,
  },
  AG: {
    description: "Agricultural",
    min_lot_sf: 130680,
    max_height: 40,
    allows_res: true,
    allows_mf: false,
    allows_adu: false,
  },
  "C-1": {
    description: "Commercial",
    min_lot_sf: 20000,
    max_height: 45,
    allows_res: false,
    allows_mf: false,
    allows_adu: false,
  },
  "C-2": {
    description: "Highway Commercial",
    min_lot_sf: 30000,
    max_height: 40,
    allows_res: false,
    allows_mf: false,
    allows_adu: false,
  },
  MU: {
    description: "Mixed Use",
    min_lot_sf: 15000,
    max_height: 45,
    allows_res: true,
    allows_mf: true,
    allows_adu: true,
  },
  VC: {
    description: "Village Center",
    min_lot_sf: 10000,
    max_height: 40,
    allows_res: true,
    allows_mf: true,
    allows_adu: true,
  },
  LR: {
    description: "Lakefront Residential",
    min_lot_sf: 60000,
    max_height: 30,
    allows_res: true,
    allows_mf: false,
    allows_adu: false,
  },
  CR: {
    description: "Conservation / Recreation",
    min_lot_sf: 217800,
    max_height: 25,
    allows_res: false,
    allows_mf: false,
    allows_adu: false,
  },
  "I-1": {
    description: "Light Industrial",
    min_lot_sf: 43560,
    max_height: 50,
    allows_res: false,
    allows_mf: false,
    allows_adu: false,
  },
  SR: {
    description: "Shorefront Residential",
    min_lot_sf: 40000,
    max_height: 30,
    allows_res: true,
    allows_mf: false,
    allows_adu: true,
  },
};

// NH-realistic street names and owner names
const STREETS = [
  "Route 3",
  "Route 11",
  "Route 16",
  "Route 25",
  "Route 28",
  "Route 113",
  "Route 109",
  "Route 153",
  "Route 171",
  "Main St",
  "Elm St",
  "Depot St",
  "Church St",
  "School St",
  "Pleasant St",
  "Union Ave",
  "Court St",
  "Province Rd",
  "Bay Hill Rd",
  "Durrell Mountain Rd",
  "Peaked Hill Rd",
  "Shaker Rd",
  "Parade Rd",
  "Lakeshore Dr",
  "Mountain View Dr",
  "Ossipee Lake Rd",
  "White Mountain Hwy",
  "Whittier Hwy",
  "Daniel Webster Hwy",
  "Laconia Rd",
  "Meredith Center Rd",
  "Gilford Ave",
  "Old Province Rd",
  "Governor Wentworth Hwy",
  "Pine Hill Rd",
  "Berry Hill Rd",
  "Town House Rd",
  "Severance Rd",
  "Stage Rd",
  "Center St",
  "North Main St",
  "South Main St",
  "Meeting House Rd",
  "Lang Pond Rd",
  "Black Cat Island Rd",
  "Ledge Hill Rd",
  "Intervale Rd",
  "South Rd",
  "East Side Dr",
  "West Side Rd",
];

const OWNERS = [
  "Laconia Land Holdings LLC",
  "Lakes Region Properties Inc",
  "Belknap Mountain Trust",
  "Carroll County Development Corp",
  "Winnipesaukee Realty LLC",
  "White Mountain Land Co",
  "Squam Holdings LLC",
  "Baker Valley Trust",
  "Ossipee Valley Properties",
  "Great Bay Timberlands LLC",
  "Richard & Margaret Sullivan",
  "James & Carol Thompson",
  "Robert A. Morrison",
  "Linda M. Patterson",
  "Michael & Susan Carter",
  "David & Nancy Adams",
  "Thomas P. Richardson",
  "Karen L. Mitchell",
  "George & Helen Burnham",
  "Patricia A. Wheeler",
  "Donald & Ruth Prescott",
  "William H. Colby Jr",
  "Stanley & Agnes Philbrick",
  "Martha E. Dodge",
  "Frederick J. Kimball",
  "Edward & Donna Tuckerman",
  "Kevin & Lisa Mooney",
  "Stephen R. Webster",
  "Diane C. Gilman",
  "Charles & Mary Sanborn",
  "Joseph & Barbara Whiting",
  "NH Division of Forests & Lands",
  "Town of Laconia",
  "Town of Meredith",
  "Town of Wolfeboro",
  "Town of Conway",
  "Meredith Village Savings Bank",
  "Squam Lake Conservation Society",
  "Lakes Region Conservation Trust",
  "Society for Protection of NH Forests",
];

// Deterministic seed-based pseudo-random
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function generateParcels(): Parcel[] {
  const rand = seededRandom(42);
  const parcels: Parcel[] = [];
  const zoneKeys = Object.keys(ZONING_DISTRICTS);

  const allTowns = [
    ...BELKNAP_TOWNS.map((t) => ({ town: t, county: "Belknap" as const })),
    ...CARROLL_TOWNS.map((t) => ({ town: t, county: "Carroll" as const })),
  ];

  for (let i = 0; i < 200; i++) {
    const townInfo = allTowns[Math.floor(rand() * allTowns.length)];
    const zoneKey = zoneKeys[Math.floor(rand() * zoneKeys.length)];
    const zone = ZONING_DISTRICTS[zoneKey];
    const street = STREETS[Math.floor(rand() * STREETS.length)];
    const owner = OWNERS[Math.floor(rand() * OWNERS.length)];

    // Land use distribution: ~35% vacant, ~40% residential, ~15% commercial, ~5% ag, ~5% industrial
    const luRoll = rand();
    const land_use: Parcel["land_use"] =
      luRoll < 0.35
        ? "Vacant"
        : luRoll < 0.75
          ? "Residential"
          : luRoll < 0.9
            ? "Commercial"
            : luRoll < 0.95
              ? "Agricultural"
              : "Industrial";

    // Acreage: varies widely in rural NH (0.25 to 150 acres)
    const acreageBase = rand();
    const acreage =
      acreageBase < 0.15
        ? +(0.25 + rand() * 1.75).toFixed(2) // small lots
        : acreageBase < 0.4
          ? +(2 + rand() * 8).toFixed(2) // medium
          : acreageBase < 0.7
            ? +(10 + rand() * 40).toFixed(2) // large
            : acreageBase < 0.9
              ? +(50 + rand() * 50).toFixed(2) // very large
              : +(100 + rand() * 80).toFixed(2); // huge

    // Assessed values - NH rural land: $2k-$20k/acre depending on location
    const perAcreValue =
      land_use === "Vacant"
        ? 2000 + rand() * 15000
        : land_use === "Agricultural"
          ? 1000 + rand() * 5000
          : 5000 + rand() * 25000;
    const assessed_land = Math.round(acreage * perAcreValue);
    const buildingValue =
      land_use === "Vacant" || land_use === "Agricultural"
        ? 0
        : Math.round(50000 + rand() * 300000);
    const assessed_total = assessed_land + buildingValue;

    // Sale history
    const yearsSinceLastSale = Math.floor(rand() * 20);
    const saleYear = 2024 - yearsSinceLastSale;
    const saleMonth = 1 + Math.floor(rand() * 12);
    const last_sale_date = `${saleYear}-${String(saleMonth).padStart(2, "0")}-15`;
    const hadSalePrice = rand() > 0.3;
    const last_sale_price = hadSalePrice
      ? Math.round(assessed_total * (0.7 + rand() * 0.8))
      : null;

    // Street number
    const streetNum = Math.floor(10 + rand() * 990);
    const address = `${streetNum} ${street}`;
    const mapNum = Math.floor(100 + rand() * 900);
    const lotNum = Math.floor(1 + rand() * 200);
    const parcel_id = `${townInfo.town.substring(0, 3).toUpperCase()}-${mapNum}-${lotNum}`;

    // Development score
    let score = 0;
    if (land_use === "Vacant") score += 30;
    else if (land_use === "Agricultural") score += 15;
    if (acreage >= 2 && acreage <= 10) score += 20;
    else if (acreage > 10 && acreage <= 50) score += 15;
    else if (acreage > 50) score += 10;
    else score += 5;
    if (zone.allows_res) score += 15;
    if (zone.allows_mf) score += 10;
    const valuePerAcre = assessed_land / Math.max(acreage, 0.1);
    if (valuePerAcre < 10000) score += 15;
    else if (valuePerAcre < 20000) score += 8;
    if (yearsSinceLastSale <= 3) score += 10;
    score = Math.min(score, 100);

    parcels.push({
      parcel_id,
      address,
      town: townInfo.town,
      county: townInfo.county,
      owner,
      acreage,
      land_use,
      assessed_land,
      assessed_total,
      last_sale_date,
      last_sale_price,
      zoning_district: zoneKey,
      zoning_description: zone.description,
      min_lot_size_sf: zone.min_lot_sf,
      max_building_height: zone.max_height,
      allows_residential: zone.allows_res,
      allows_multifamily: zone.allows_mf,
      allows_adu: zone.allows_adu,
      development_score: score,
    });
  }

  return parcels.sort((a, b) => b.development_score - a.development_score);
}

export const parcels = generateParcels();
