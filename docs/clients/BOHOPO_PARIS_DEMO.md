# Bohopo — Paris Demo

Synthetic-data preview for the Friday call with Stavros / Oren / Minas. Built off the Paris public-data scoping work in `BOUTIQUE_HOTEL_OPPORTUNITY.md`.

**URL:** `/demos/bohopo-paris`

## Why this exists

Stavros asked for a synthetic-data demo showing what the Paris platform would feel like. This is intentionally **basic** — same shell as the original `bohopo` demo, but the columns and scoring are tuned to the French signals we can actually pull from public sources (SIRENE, INPI/RNE, BODACC, DVF, Atout France, Paris urbanisme).

Don't oversell density. Show one screen, the right columns, a coherent score, and an analyst chat that talks like a Paris hotel acquisition associate.

## Context

- Buy box (per BOUTIQUE_HOTEL_OPPORTUNITY.md): 1-3★ classified hotels, 15-50 rooms, anywhere in Paris (1er-20e), family-owned with aging directors / fund-owned past 4y / distressed / operationally weak.
- Worked example from our prior work: CLER HOTEL (75007), family-controlled, multi-generational — the kind of property this system should surface to the top.

## Data model (synthetic, ~160 rows)

| Field                                     | Source we'd pull from in production                    |
| ----------------------------------------- | ------------------------------------------------------ |
| name, arrondissement                      | Atout France (Hébergements Classés)                    |
| stars, rooms                              | Atout France                                           |
| owner_type (family / corporate / fund)    | SIRENE legal form + AMF GECO + INPI beneficial owners  |
| director_age                              | SIRENE `dirigeants[].annee_de_naissance`               |
| years_held                                | DVF transaction history → SIRENE link                  |
| building_year                             | APUR Emprise Bâtie                                     |
| rating, review_count, rating_trend        | booking.com (scraper)                                  |
| distress_flag (tax / legal / péril / ops) | BODACC procédures + tax liens + Paris arrêtés de péril |
| bohopo_score (0-99)                       | Composite across all four pillars                      |
| siren                                     | SIRENE                                                 |

## Scoring pillars (matches what we proposed)

1. **Family + succession** — owner_type=family weighted heavily, then director_age 65+
2. **Hold duration** — 25y+ held adds signal; fund-owned past 4y is forced-timing
3. **Distress** — legal procédure > tax lien > péril > operating
4. **Operational underperformance** — rating ≤ 3.4 and review_count ≥ 200

## Demo flow (5-7 min)

1. **Open the page.** "Every classified hotel in Paris, scored against your buy box. Sorted by Bohopo score, top of list is what your team should approach this week."
2. **Stats bar.** Walk the four KPIs: hotels monitored, priority targets ≥70, succession candidates (family + director ≥65), distress flagged.
3. **Top row.** Pick a top-score row — point out the combination: family-owned + 70+ year old director + 30+ year hold + a distress flag. "This is exactly the CLER HOTEL pattern we walked through last time, but at scale across the whole city."
4. **Filters.** Toggle "Distress: flagged only" — the list collapses to BODACC / péril / tax / ops hits. Then toggle Owner to **fund only** and explain forced-timing (4+ year holds).
5. **Arrondissement filter.** Click 3e and 4e — "if you want to start in the Marais, here's your shortlist for the week."
6. **Analyst chat.** Click "Top 5 succession targets right now" — it reasons over the filtered set in the language of Bohopo's outreach (family entity, aging director, distress flag, what to say in the cold approach). Then ask "Which family hotels are also showing distress signals?" to show compound-pillar reasoning.
7. **Land the pitch.** "This is the v1. In production, those columns are pulled from SIRENE, INPI, BODACC, DVF, and Atout France — every signal links back to the underlying public record. Plug in your final buy-box weights (stars cap, price band, exclusions) and this becomes your weekly outreach queue."

## Anticipated questions

- _"Where does the score come from?"_ — Four pillars: family/succession, hold/fund-timing, distress, operational. Weights are tunable; the ones in the demo are our proposed defaults.
- _"Is this real data?"_ — Synthetic for the preview. Every column maps 1:1 to a free public-data source we've already probed and confirmed has coverage. Director ages and SIRENs would be real on day one — we showed the CLER worked example last time.
- _"How fresh?"_ — SIRENE updates daily, BODACC daily, DVF biannual, Atout France monthly, booking.com on whatever cadence we set. "Synced 6m ago" in the demo is just the badge style.
- _"Can we add criteria?"_ — Yes, every filter you see is a column we have. Want a "pre-1950 buildings only" toggle? One line.
- _"What about the operating company vs. the real estate?"_ — Both. SIRENE has the SAS / SARL running the hotel; INPI/DVF gives us the SCI or family entity that owns the wall. Score is on the property, not just the operator.

## Talking points to have ready

- The `bohopo-paris` demo runs off the same engine as the NYC tax-lien platform we've already shipped — same CRM, list-building, skip-tracing primitives, just retuned for French signals.
- 6-8 week build to production. Tier-1 sources are all verified accessible.
- The signals here aren't speculative — Granola transcript from last call has Minas calling out exactly these patterns (family-owned, aging, underperforming, single-asset).
