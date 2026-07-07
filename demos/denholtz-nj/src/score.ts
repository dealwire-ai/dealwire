/**
 * Developability score (0–99): base 50 with transparent additive adjustments
 * and hard caps for regime blockers. Every adjustment is recorded in
 * score_notes so each row self-explains — the formula is documented verbatim
 * in docs/clients/DENHOLTZ_DEMO.md and the demo chat system prompt; keep all
 * three in sync.
 */

export interface ScoreInput {
  calcAcres: number;
  landVal: number | null;
  wetlandsPct: number | null;
  floodSfha: "yes" | "no" | "no-data";
  floodZone: string;
  highlands: "preservation" | "planning" | "none";
  pinelands: string;
  inSewerServiceArea: boolean;
  preservedPct: number | null;
}

const PINELANDS_RESTRICTIVE = [
  "preservation area district",
  "forest area",
  "agricultural production area",
  "special agricultural production area",
];
const PINELANDS_DEVELOPABLE = [
  "regional growth",
  "pinelands town",
  "pinelands village",
];

export function isPinelandsRestrictive(mgtArea: string): boolean {
  const m = mgtArea.toLowerCase();
  return PINELANDS_RESTRICTIVE.some((r) => m.includes(r));
}

export function computeScore(input: ScoreInput): {
  score: number;
  notes: string;
} {
  let score = 50;
  let cap = 99;
  const notes: string[] = ["base 50"];
  const add = (delta: number, label: string) => {
    score += delta;
    notes.push(`${label} ${delta > 0 ? "+" : ""}${delta}`);
  };

  if (input.inSewerServiceArea) add(25, "sewer service area");

  if (input.wetlandsPct === null) {
    add(-10, "wetlands overlap (pct unknown)");
  } else if (input.wetlandsPct > 0) {
    add(
      -Math.min(40, Math.round(0.4 * input.wetlandsPct)),
      `wetlands ${input.wetlandsPct}%`,
    );
  }

  if (input.floodSfha === "yes") add(-15, "FEMA SFHA");
  else if (input.floodZone === "X-shaded") add(-5, "0.2% flood zone");
  else if (input.floodSfha === "no-data") add(-3, "flood unmapped");

  if (input.highlands === "preservation") {
    cap = Math.min(cap, 15);
    notes.push("Highlands Preservation (cap 15)");
  } else if (input.highlands === "planning") {
    add(-10, "Highlands Planning");
  }

  const pine = input.pinelands.toLowerCase();
  if (input.pinelands !== "none") {
    if (isPinelandsRestrictive(input.pinelands)) {
      cap = Math.min(cap, 15);
      notes.push(`Pinelands ${input.pinelands} (cap 15)`);
    } else if (pine.includes("rural development")) {
      add(-15, "Pinelands Rural Development");
    } else if (PINELANDS_DEVELOPABLE.some((d) => pine.includes(d))) {
      add(5, `Pinelands ${input.pinelands}`);
    }
  }

  if (input.preservedPct === null)
    add(-20, "preserved-land overlap (pct unknown)");
  else if (input.preservedPct >= 5)
    add(-20, `preserved land ${input.preservedPct}%`);

  if (input.calcAcres >= 10 && input.calcAcres <= 40) add(10, "10–40 ac");
  else add(5, "acreage in range");

  if (input.landVal !== null && input.landVal > 0 && input.calcAcres > 0) {
    const perAcre = input.landVal / input.calcAcres;
    if (perAcre < 5_000) add(10, "<$5k/ac assessed");
    else if (perAcre < 15_000) add(6, "$5–15k/ac assessed");
    else if (perAcre < 40_000) add(3, "$15–40k/ac assessed");
  }

  const final = Math.max(0, Math.min(cap, Math.round(score)));
  return { score: final, notes: notes.join("; ") };
}
