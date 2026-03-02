/**
 * NYC DOF building classification code labels.
 * Source: https://www.nyc.gov/assets/finance/jump/hlpbldgcode.html
 */

export const BUILDING_CLASS_LABELS: Record<string, string> = {
  // A — One Family Dwellings
  A: "One family dwellings",
  A0: "Cape Cod",
  A1: "Two stories, detached",
  A2: "One story, permanent living quarter",
  A3: "Large suburban residence",
  A4: "City residence, one family",
  A5: "One family attached or semi-detached",
  A6: "Summer cottage",
  A7: "Mansion type or town house",
  A8: "Bungalow colony, cooperatively owned land",
  A9: "Miscellaneous one family",

  // B — Two Family Dwellings
  B: "Two family dwellings",
  B1: "Two family, brick",
  B2: "Two family, frame",
  B3: "Two family, converted from one family",
  B9: "Miscellaneous two family",

  // C — Walk-up Apartments
  C: "Walk-up apartments",
  C0: "Three families",
  C1: "Over six families without stores",
  C2: "Five to six families",
  C3: "Four families",
  C4: "Old law tenement",
  C5: "Converted dwelling or rooming house",
  C6: "Walk-up cooperative",
  C7: "Walk-up apt over six families with stores",
  C8: "Walk-up co-op, conversion from loft/warehouse",
  C9: "Garden apartments",
  CB: "Walk-up apt less than 11 units residential",
  CC: "Walk-up co-op apt less than 11 units residential",
  CM: "Mobile homes / trailer parks",

  // D — Elevator Apartments
  D: "Elevator apartments",
  D0: "Elevator co-op, conversion from loft/warehouse",
  D1: "Elevator apt, semi-fireproof without stores",
  D2: "Elevator apt, artists in residence",
  D3: "Elevator apt, fireproof without stores",
  D4: "Elevator cooperative",
  D5: "Elevator apt, converted",
  D6: "Elevator apt, fireproof with stores",
  D7: "Elevator apt, semi-fireproof with stores",
  D8: "Elevator apt, luxury type",
  D9: "Elevator apt, miscellaneous",
  DB: "Elevator apt less than 11 units residential",
  DC: "Elevator co-op apt less than 11 units residential",

  // E — Warehouses
  E: "Warehouses",
  E1: "General warehouse",
  E2: "Contractors warehouse",
  E7: "Self-storage warehouses",
  E9: "Miscellaneous warehouse",

  // F — Factories
  F: "Factories and industrial buildings",
  F1: "Factory, heavy manufacturing, fireproof",
  F2: "Factory, special construction, fireproof",
  F4: "Factory, industrial semi-fireproof",
  F5: "Factory, light manufacturing",
  F8: "Factory, tank farm",
  F9: "Factory, industrial miscellaneous",

  // G — Garages
  G: "Garages",
  G0: "Garage, residential tax class 1",
  G1: "All parking garages",
  G2: "Auto body / collision or auto repair",
  G3: "Gas station with retail store",
  G4: "Gas station with service / auto repair",
  G5: "Gas station only with/without small kiosk",
  G6: "Licensed parking lot",
  G7: "Unlicensed parking lot",
  G8: "Car sales/rental with showroom",
  G9: "Miscellaneous garage",
  GU: "Car sales or rental lots without showroom",
  GW: "Car wash or lubritorium facility",

  // H — Hotels
  H: "Hotels",
  HB: "Boutique hotel (10–100 rooms, luxury)",
  HH: "Hostels",
  HR: "SRO, affordable housing",
  HS: "Extended stay / suite hotel",
  H1: "Luxury hotel",
  H2: "Full service hotel",
  H3: "Limited service hotel",
  H4: "Motel",
  H5: "Hotel, private club, luxury type",
  H6: "Apartment hotel",
  H7: "Apartment hotel, cooperatively owned",
  H8: "Dormitory",
  H9: "Miscellaneous hotel",

  // I — Hospitals
  I: "Hospitals and health facilities",
  I1: "Hospital, sanitarium, mental institution",
  I2: "Infirmary",
  I3: "Dispensary",
  I4: "Hospital staff facility",
  I5: "Health center, child center, clinic",
  I6: "Nursing home",
  I7: "Adult care facility",
  I9: "Miscellaneous hospital, health care",

  // J — Theatres
  J: "Theatres",
  J1: "Theatre, art type less than 400 seats",
  J2: "Theatre, art type more than 400 seats",
  J3: "Motion picture theatre with balcony",
  J4: "Legitimate theatre, sole use",
  J5: "Theatre in mixed-use building",
  J6: "Television studio",
  J7: "Off Broadway type theatre",
  J8: "Multiplex picture theatre",
  J9: "Miscellaneous theatre",

  // K — Store Buildings
  K: "Store buildings",
  K1: "One story retail building",
  K2: "Multi-story retail (2 or more)",
  K3: "Multi-story department store",
  K4: "Predominant retail with other uses",
  K5: "Stand-alone food establishment",
  K6: "Shopping center with or without parking",
  K7: "Banking facilities with or without parking",
  K8: "Big box retail",
  K9: "Miscellaneous store building",

  // L — Lofts
  L: "Lofts",
  L1: "Loft, over 8 stories",
  L2: "Loft, fireproof and storage type",
  L3: "Loft, semi-fireproof",
  L8: "Loft with retail stores",
  L9: "Miscellaneous loft",

  // M — Religious Facilities
  M: "Religious facilities",
  M1: "Church, synagogue, chapel",
  M2: "Mission house (non-residential)",
  M3: "Parsonage, rectory",
  M4: "Convent",
  M9: "Miscellaneous religious facility",

  // N — Asylums and Homes
  N: "Asylums and homes",
  N1: "Asylum",
  N2: "Home for indigent children, aged, homeless",
  N3: "Orphanage",
  N4: "Detention house",
  N9: "Miscellaneous asylum, home",

  // O — Office Buildings
  O: "Office buildings",
  O1: "Office only, 1 story",
  O2: "Office only, 2–6 stories",
  O3: "Office only, 7–19 stories",
  O4: "Office only, 20+ stories",
  O5: "Office with commercial, 1–6 stories",
  O6: "Office with commercial, 7–19 stories",
  O7: "Professional buildings / funeral homes",
  O8: "Office with apartments only",
  O9: "Miscellaneous and old style bank buildings",

  // P — Indoor Public Assembly
  P: "Indoor public assembly and cultural facilities",
  P1: "Concert hall",
  P2: "Lodge room",
  P3: "YWCA, YMCA, YWHA, YMHA, PAL",
  P4: "Beach club",
  P5: "Community center",
  P6: "Amusement place, bath house, boat house",
  P7: "Museum",
  P8: "Library",
  P9: "Miscellaneous indoor public assembly",

  // Q — Outdoor Recreational
  Q: "Outdoor recreational facilities",
  Q1: "Parks / recreation facility",
  Q2: "Playground",
  Q3: "Outdoor pool",
  Q4: "Beach",
  Q5: "Golf course",
  Q6: "Stadium, race track, baseball field",
  Q7: "Tennis court",
  Q8: "Marina, yacht club",
  Q9: "Miscellaneous outdoor recreational",

  // R — Condominiums
  R: "Condominiums",
  RA: "Cultural, medical, educational, etc.",
  RB: "Office space",
  RG: "Indoor parking",
  RH: "Hotel / boatel",
  RK: "Retail space",
  RP: "Outdoor parking",
  RR: "Condominium rentals",
  RS: "Non-business storage space",
  RT: "Terraces, gardens, cabanas",
  RW: "Warehouse / factory / industrial",
  R0: "Special condominium billing lot",
  R1: "Condo, residential unit in 2–10 unit bldg",
  R2: "Condo, residential unit in walk-up bldg",
  R3: "Condo, residential unit in 1–3 story bldg",
  R4: "Condo, residential unit in elevator bldg",
  R5: "Miscellaneous commercial",
  R6: "Condo, resid. unit of 1–3 unit bldg, orig class 1",
  R7: "Condo, comml. unit of 1–3 unit bldg, orig class 1",
  R8: "Condo, comml. unit of 2–10 unit bldg",
  R9: "Co-op within a condominium",

  // S — Primarily Residential, Mixed Use
  S: "Primarily residential, mixed use",
  S0: "Primarily 1 family with 2 stores or offices",
  S1: "Primarily 1 family with 1 store or office",
  S2: "Primarily 2 family with 1 store or office",
  S3: "Primarily 3 family with 1 store or office",
  S4: "Primarily 4 family with 1 store or office",
  S5: "Primarily 5–6 family with 1 store or office",
  S9: "Single or multiple dwelling with stores or offices",

  // T — Transportation
  T: "Transportation facilities",
  T1: "Airport, airfield, terminal",
  T2: "Pier, dock, bulkhead",
  T9: "Miscellaneous transportation facility",

  // U — Utility Bureau Properties
  U: "Utility bureau properties",
  U0: "Utility company land and building",
  U1: "Bridge, tunnel, highway",
  U2: "Gas or electric utility",
  U3: "Ceiling railroad",
  U4: "Telephone utility",
  U5: "Communication facility other than telephone",
  U6: "Railroad, private ownership",
  U7: "Transportation, public ownership",
  U8: "Revocable consent",
  U9: "Miscellaneous utility property",
  UR: "Utility revocable consent",

  // V — Vacant Land
  V: "Vacant land",
  V0: "Zoned residential, not Manhattan",
  V1: "Zoned commercial or Manhattan residential",
  V2: "Zoned commercial adjacent to class 1 dwelling",
  V3: "Zoned primarily residential, not Manhattan",
  V4: "Police or fire department",
  V5: "School site or yard",
  V6: "Library, hospital or museum",
  V7: "Port Authority of NY and NJ",
  V8: "New York State or US government",
  V9: "Miscellaneous vacant land",
  VG: "Community garden, zoned residential",
  VC: "Community garden, zoned commercial or Manhattan",

  // W — Educational
  W: "Educational facilities",
  W1: "Public elementary, junior or senior high",
  W2: "Parochial school, yeshiva",
  W3: "School or academy",
  W4: "Training school",
  W5: "City University",
  W6: "Other college and university",
  W7: "Theological seminary",
  W8: "Other private school",
  W9: "Miscellaneous educational facility",

  // Y — Government
  Y: "Government / city departments",
  Y1: "Fire department",
  Y2: "Police department",
  Y3: "Prison, jail, house of detention",
  Y4: "Military and naval installation",
  Y5: "Department of real estate",
  Y6: "Department of sanitation",
  Y7: "Department of ports and terminals",
  Y8: "Department of public works",
  Y9: "Department of environmental protection",

  // Z — Miscellaneous
  Z: "Misc. building classifications",
  Z0: "Tennis court, pool, shed, etc.",
  Z1: "Court house",
  Z2: "Public parking area",
  Z3: "Post office",
  Z4: "Foreign government",
  Z5: "United Nations",
  Z7: "Easement",
  Z8: "Cemetery",
  Z9: "Other miscellaneous",
};

export function formatBuildingClass(code: string | null | undefined): string {
  if (!code) return "-";
  const label = BUILDING_CLASS_LABELS[code.trim().toUpperCase()];
  return label ? `${code} — ${label}` : code;
}
