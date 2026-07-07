# Denholtz NJ Land Screen — Demo Walkthrough

**Page:** `/demos/denholtz-nj` (internal-gated; screen-share only)
**Deliverable:** CSV + notes in `demos/denholtz-nj/output/` — email after the call
**Audience:** Steven Denholtz, reconnect call mid-to-late July 2026
**Thesis:** "Every buildable 5–100 acre vacant parcel in New Jersey, screened for the blockers that kill deals — from public records, in one view."

## Walkthrough script

1. **Open statewide — let the map land.** All counties selected, no filters. New Jersey is drawn entirely from the 13,751 screened parcels, colored by score (bright = high). "This is every class-1 vacant parcel in New Jersey between 5 and 100 acres, from public records — the full universe is ~14,000, minus majority-preserved land. Every dot is a real parcel."
2. **The screen in action — the map moment.** Toggle **Sewer Only** + **Hide HL/PL Restricted**. Narrate the map dimming: "Watch the Pinelands and the Highlands switch off." Count drops 13,751 → ~6,000; median $/acre jumps ~$4,900 → ~$13,400 ("sewer-served land costs more for a reason — it's buildable"). The histogram shifts right and the county leaderboard reorders live.
3. **Narrate the score on one parcel.** Click a bright dot (or a table row) — the detail sheet shows the arithmetic line by line. Say the formula out loud: "Everything starts at 50. Sewer service adds 25. Wetlands subtract proportionally. A Highlands Preservation or restrictive Pinelands parcel is capped at 15 — the regime kills it no matter how nice the land is." The satellite-view button jumps straight to Google aerial imagery.
4. **Caveat framing (do this proactively — it builds trust):** "These flags are screening-grade. The wetlands layer is the state's 2020 aerial mapping, not a delineation — a formal call needs an NJDEP Letter of Interpretation. The flags tell you which parcels deserve diligence dollars; they are not regulatory conclusions. Same with flood: 'unmapped' means FEMA hasn't digitized there, not that it's clear."
5. **The AI analyst.** Click "Top targets in sewer service areas over 20 acres." Let it stream. Point out it cites real PAMS_PINs and the score arithmetic.
6. **The 3B land-bank talking point (verbal only — not in the data):** "One thing we found building this: you said no farms, and we honored that. But New Jersey has ~24,000 farmland-assessed parcels at 5–100 acres, and a chunk of those are developers parking land — 5 acres and $1,000 a year in hay sales qualifies. If you ever want that layer as a labeled second tier, it's a config change, not a rebuild."
7. **CSV handoff.** "The full screened list is in your inbox as a spreadsheet — every column you see here plus deed references and the exact score arithmetic per parcel."
8. **The bridge to the retainer:** "This took us about four days because we'd already built the engine for NYC tax liens. Florida is the same pattern — new geography, same machine. And this is the shape of what an embedded engagement looks like: you describe the screen, we build it against real data."

## Anticipated Q&A

| Question                           | Answer                                                                                                                                                                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Why no owner names?                | NJ redacts owner names from published parcel data under Daniel's Law. For specific targets we pull ownership from county deed records — normal diligence step.                       |
| Is this delinquency/tax-sale data? | No — that's only public per-municipality in NJ; no statewide feed exists. The tax column is prior-year billed tax. We can pull specific municipalities on request.                   |
| How current is it?                 | Parcel geometry updates rolling through the year; MOD-IV assessment attributes are the latest annual tax list and can lag up to a tax year.                                          |
| Can you add CoStar?                | Yes — if Kris gets us access under your license, listings/market data layer on top of this same table.                                                                               |
| What about Florida?                | Same engine, new geography. Florida parcels + FEMA + wetlands layers are equally public; the city-radius filter you wanted is straightforward with the centroids we already compute. |
| What did this cost you to build?   | It's free — it's how we show what working with us looks like.                                                                                                                        |

## Score formula (keep in sync with `demos/denholtz-nj/src/score.ts` and the page's system prompt)

Base 50 → sewer +25 · wetlands −0.4×pct (max −40, unknown −10) · SFHA −15 / 0.2% −5 / unmapped −3 · Highlands Preservation **cap 15** / Planning −10 · Pinelands restrictive **cap 15** / Rural Dev −15 / Growth +5 · preserved 5–50% −20 · 10–40 ac +10 (else +5) · <$5k/ac +10, $5–15k +6, $15–40k +3 · clamp 0–99.
