/**
 * NYC DOF building classification code labels.
 * Reference: docs/product/TAX_LIEN_PLATFORM.md
 */

export const BUILDING_CLASS_LABELS: Record<string, string> = {
  A0: "Cape Cod",
  A1: "Two stories, detached",
  A5: "Attached or semi-detached",
  A8: "Bungalow colony / coop",
  B1: "Two family, brick",
  B2: "Two family, frame",
  B3: "Two family, converted",
  C0: "Three families",
  C2: "Five-six family walk-up",
  C5: "Converted dwelling",
  C6: "Walk-up cooperative",
  C8: "Walk-up co-op, loft conversion",
  CC: "Walk-up co-op, <11 units",
  D0: "Elevator co-op, loft conversion",
  D4: "Elevator cooperative",
  DC: "Elevator co-op apt, <11 units",
  H7: "Hotel (coop)",
  K4: "Store building (1 story)",
  R9: "Co-op within condominium",
  S1: "Primarily 1 family with store",
  S2: "Primarily 2 family with store",
  V1: "Vacant land (residential)",
  Z7: "Vacant land (commercial)",
};

export function formatBuildingClass(code: string | null | undefined): string {
  if (!code) return "-";
  const label = BUILDING_CLASS_LABELS[code.trim().toUpperCase()];
  return label ? `${code} — ${label}` : code;
}
