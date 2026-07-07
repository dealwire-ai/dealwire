# Denholtz NJ Land Screen ETL

One-off ETL for the Denholtz Properties NJ land pilot (epic #419): statewide
NJ class-1 vacant land, 5–100 CALC_ACRE, screened against public
development-blocker layers. Feeds the internal demo at `/demos/denholtz-nj`
and the client CSV. Client context: `docs/clients/DENHOLTZ_NOTES.md`.

## Run

```bash
pnpm --filter @dealwire/denholtz-nj-etl fetch-parcels    # Stage A: ~14k parcels w/ geometry (~5 min)
pnpm --filter @dealwire/denholtz-nj-etl screen-blockers  # Stage B: 7-layer intersect screen (~1-3 h, resumable)
pnpm --filter @dealwire/denholtz-nj-etl build-outputs    # Stage C: score + parcels.json + CSV + notes
```

- Stage B checkpoints one NDJSON line per parcel to `data/checkpoints/blockers.ndjson`
  and skips completed PINs on restart — just re-run it after any failure.
  `LIMIT=n` screens only the first n unscreened parcels (smoke testing).
- Stage C exits non-zero if the hard sanity thresholds fail (universe count,
  county coverage, Pinelands/Highlands geography, wetlands distribution,
  sewer hit-rate). Do not ship outputs from a failing run.
- `data/` (raw pulls + checkpoints) is gitignored; `output/` (CSV + notes)
  and the demo's `parcels.json` are committed.

## Layers

All endpoints verified live 2026-07-07 — see `src/layers.ts` for URLs and
`docs/clients/DENHOLTZ_NOTES.md` for the source inventory with vintages.
Flood uses the NJDEP-hosted NFHL mirror first (FEMA's server throttles) and
derives SFHA from `FLD_ZONE` since the mirror lacks `SFHA_TF`. Wetlands /
open-space / preserved-farm coverage percentages are computed locally with
turf from returned intersecting geometries; failures degrade to
`null` ("touches, pct unknown") — never a silent 0.

## Scoring

`src/score.ts` — 0–99, base 50, additive with hard caps for Highlands
Preservation and restrictive Pinelands. The formula is documented for the
client in `docs/clients/DENHOLTZ_DEMO.md` and embedded in the demo page's
chat system prompt. Change all three together.
