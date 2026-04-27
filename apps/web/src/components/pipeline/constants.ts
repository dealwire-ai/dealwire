// Borough codes per NYC convention. Mirrors apps/api/src/service/public-data/nyc-utils.ts
// — no shared types package between web and api yet, so keep aligned by hand.
export const BOROUGH_LABELS: Record<string, string> = {
  "1": "Manhattan",
  "2": "Bronx",
  "3": "Brooklyn",
  "4": "Queens",
  "5": "Staten Island",
};
