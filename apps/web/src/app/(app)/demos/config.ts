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
];
