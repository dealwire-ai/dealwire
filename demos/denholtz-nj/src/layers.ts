/**
 * Blocker-layer registry. Every endpoint was verified live on 2026-07-07
 * (layer index, field names, pagination support). See README.md for the
 * data-source inventory and vintages.
 */

export type LayerMode = "area" | "categorical" | "boolean";

export interface BlockerLayer {
  key: string;
  name: string;
  url: string;
  /** area = compute % of parcel covered; categorical/boolean = attributes only */
  mode: LayerMode;
  outFields: string[];
  /** Secondary endpoint tried when the primary fails hard. */
  fallbackUrl?: string;
}

export const PARCELS_LAYER =
  "https://maps.nj.gov/arcgis/rest/services/Framework/Cadastral/MapServer/0";

export const PARCEL_OUT_FIELDS = [
  "PAMS_PIN",
  "COUNTY",
  "MUN_NAME",
  "PROP_CLASS",
  // PROP_LOC is the parcel's situs address. Do NOT fetch ST_ADDRESS /
  // CITY_STATE / ZIP_CODE — those are the OWNER's mailing address block,
  // which this deliverable explicitly excludes.
  "PROP_LOC",
  "LAND_VAL",
  "IMPRVT_VAL",
  "NET_VALUE",
  "LAST_YR_TX",
  "LAND_DESC",
  "CALC_ACRE",
  "DEED_BOOK",
  "DEED_PAGE",
  "DEED_DATE",
  "SALES_CODE",
  "SALE_PRICE",
];

export const PARCEL_WHERE =
  "PROP_CLASS = '1' AND CALC_ACRE >= 5 AND CALC_ACRE <= 100";

export const BLOCKER_LAYERS: BlockerLayer[] = [
  {
    key: "wetlands",
    name: "NJDEP Wetlands 2020 (LULC-derived, screening-grade)",
    url: "https://services1.arcgis.com/QWdNfRs7lkPq4g4Q/arcgis/rest/services/Wetlands_2020/FeatureServer/14",
    mode: "area",
    outFields: ["TYPE20"],
  },
  {
    key: "flood",
    name: "FEMA NFHL flood zones (NJDEP monthly mirror)",
    url: "https://mapsdep.nj.gov/arcgis/rest/services/Features/Hydrography/MapServer/43",
    fallbackUrl:
      "https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28",
    mode: "categorical",
    outFields: ["FLD_ZONE", "ZONE_SUBTY"],
  },
  {
    key: "highlands",
    name: "NJ Highlands Preservation and Planning Areas",
    url: "https://maps.nj.gov/arcgis/rest/services/Framework/Government_Boundaries/MapServer/6",
    mode: "categorical",
    outFields: ["REGION"],
  },
  {
    key: "pinelands",
    name: "Pinelands Management Areas",
    url: "https://services1.arcgis.com/nCm6SZaiGMuGX35l/arcgis/rest/services/Pinelands_ManagementAreas/FeatureServer/0",
    mode: "categorical",
    outFields: ["MGT_NAME", "MGT_CODE"],
  },
  {
    key: "sewer",
    name: "Statewide Sewer Service Areas",
    url: "https://mapsdep.nj.gov/arcgis/rest/services/Features/Utilities/MapServer/8",
    mode: "boolean",
    outFields: ["TYPE"],
  },
  {
    key: "openspace",
    name: "NJDEP State/Local/Nonprofit Open Space",
    url: "https://services1.arcgis.com/QWdNfRs7lkPq4g4Q/arcgis/rest/services/Open_Space/FeatureServer/66",
    mode: "area",
    outFields: ["STATCODE"],
  },
  {
    key: "sadc",
    name: "SADC Preserved Farmland easements",
    url: "https://services.arcgis.com/gzSkSfQGxyX6dicF/arcgis/rest/services/NJFPP_Preserved_Farms/FeatureServer/0",
    mode: "area",
    outFields: ["COUNTY"],
  },
];
