export interface Demo {
  slug: string;
  client: string;
  domain: string;
  description: string;
  status: "active" | "archived";
  createdAt: string;
}

export const demos: Demo[] = [
  {
    slug: "bohopo",
    client: "Bohopo",
    domain: "Boutique Hotel Acquisition",
    description: "EU city center hotel acquisition intelligence",
    status: "active",
    createdAt: "2025-03-01",
  },
  {
    slug: "ddha",
    client: "DD|HA",
    domain: "Guest Intelligence",
    description:
      "Pre-arrival guest enrichment for Forever Wild / Emerson Resort",
    status: "active",
    createdAt: "2026-03-27",
  },
  {
    slug: "froggy",
    client: "Froggy Companies",
    domain: "Land Development Intelligence",
    description:
      "Parcel & zoning intelligence for Belknap & Carroll County, NH",
    status: "active",
    createdAt: "2026-04-06",
  },
  {
    slug: "mrc",
    client: "Madison Realty Capital",
    domain: "Construction Loan Origination",
    description:
      "Business journal automation for new development sites in LA, Miami, WPB, Seattle",
    status: "active",
    createdAt: "2026-04-28",
  },
];
