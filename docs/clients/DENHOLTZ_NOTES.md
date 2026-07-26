# Steven Denholtz — NJ Land Pilot

## Who

**Steven Denholtz** — Chairman, Denholtz Properties (Ocean Port, NJ). Introduced by Jordan Karlik (JK Equities) on Jun 16, 2026. Being bought out of his ~$2B AUM firm by junior partners (Invesco-backed) after ~10 years; restarting lean: ~12 people, ~25 properties (multifamily, industrial, some office). Geography narrowing to **New Jersey + Florida** (Nashville a maybe). No longer accumulating assets — only selective transactions he likes.

**Contacts:**

- Steven Denholtz — stevendenholtz@denholtz.com, D 917-455-9404
- Kris Hurlbut — khurlbut@denholtz.com, SVP Leasing (CoStar license contact)

## Relationship status & strategy

- Intro call **Jun 24, 2026** (Granola: "Noah/Steven Intro (Dealwire)"). He asked for "the absolute smallest task" to test working together → NJ land parcel screen.
- Pilot is **free** — deliberate relationship-builder toward a Foxfield-style **$10k/mo embedded-engineering retainer**. Do not charge for the pilot; a one-time fee makes it transactional (Noah, Jun 25 email).
- He has **no "number two" hired yet** — that's the blocker for a fuller engagement. Reconnect **mid-to-late July 2026** once hiring lands.
- His data today: property docs in SharePoint (not a database), ~1,500 investor contacts in Juniper Square. Heavy personal AI user (partner memos; "work of six people").
- Deal screener (JK-style) is a poor fit for him: he can't access OMs without NDAs, and his deal flow is relationship-driven, not inbox-flooded.

## Agreed pilot scope (email Jun 24, Steven confirmed "Let's start")

- Statewide NJ land parcels, **public records only**, 5–100 acres
- Vacant land suitable for residential/commercial development; **no farms**
- Per parcel: location, acreage, assessed value, tax history
- Flags: wetlands, FEMA flood zones, Highlands/Pinelands restrictions
- **No owner/contact info** (NJ redacts owner names under Daniel's Law anyway)
- Florida is the likely follow-on geography (there he wants parcels within 20–30 mi of a city; for NJ "anywhere is fine")

## Scope nuances (decided Jul 7)

- **"Tax history" = current assessed values + prior-year billed tax** (`LAST_YR_TX`) + deed/sale info. Statewide delinquency/tax-sale status is not public in bulk (per-municipality only) — say so if asked. Multi-year assessed history is available via Rutgers MOD-IV Historical DB as a follow-on.
- **Class 1 (vacant) only.** Class 3B farmland-assessed parcels are excluded per "no farms" — but 23,711 of them at 5–100 ac exist statewide and many are developer land banks (5 ac + $1k/yr ag sales qualifies for farmland assessment). This is a **verbal talking point**, not shipped data.
- All blocker flags are **screening-grade** (NJDEP wetlands = photo-interpreted 2020 land cover, not delineations; FEMA NFHL has digitization gaps — "no data" ≠ "no risk").

## CoStar layer (delivered Jul 2026)

- Kris's CoStar access came through as three "all columns" exports (Jul 24, 2026): 1,139 NJ land listings — 242 at 0.25–1 ac, 423 at 1–5 ac, 474 at 5–100 ac; 1,010 actively for sale. Joined onto the screen by `demos/denholtz-nj/scripts/join-costar.py` (issue #431).
- **What it added:** asking prices (69% fill), broker + phone (94%), CoStar-reported owner names (~65% — fills the Daniel's Law gap on matched parcels), zoning (89%), days on market, proposed use. 231 screened parcels carry a listing; the full 1,139 render as a map overlay.
- **Demo-ready stats:** median asking ≈ 5.7× assessed on matched parcels; median 444 days on market; ~96% of parcels scoring 80+ have no active listing (the off-market pitch).
- **Not in the export:** submarket rents/vacancy/pipeline, land sale comps (only 141 last-sale rows). Follow-up ask for Kris: a sold-comps export + submarket stats export.
- Snapshot only — listings may close/reprice; data stays confined to the Denholtz demo + deliverable (their license).

## Pending / open

- Kris's other database suggestions (unused by them): CommercialEdge, Crexi, Reonomy, LightBox Vision, LandApp.
- Steven asked about **GSA website + broker sites** as sources — unaddressed so far.
- CoStar follow-up exports worth requesting: sold land comps, submarket stats.

## Deliverables (epic #419)

- Internal demo page: `/demos/denholtz-nj` (real ETL data, Froggy-pattern)
- Client CSV + caveats: `demos/denholtz-nj/output/` (`DELIVERABLE_NOTES.md` text doubles as the email body)
- ETL: `demos/denholtz-nj/` workspace package — 3 stages, resumable; re-run instructions in its README
- Walkthrough script: `docs/clients/DENHOLTZ_DEMO.md`

## Data source inventory (verified Jul 2026)

| Source                           | Access                                                                                        | Vintage/cadence                         |
| -------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------- |
| NJGIN Parcels + MOD-IV composite | `maps.nj.gov/arcgis/rest/services/Framework/Cadastral/MapServer/0` (bulk FGDB also available) | MOD-IV annual; geometry rolling 2–4×/yr |
| NJDEP Wetlands 2020              | `services1.arcgis.com/QWdNfRs7lkPq4g4Q/.../Wetlands_2020/FeatureServer/14`                    | 2020 LULC, 0.25-ac MMU                  |
| FEMA NFHL (NJ mirror)            | `mapsdep.nj.gov/.../Hydrography/MapServer/43` (fallback: hazards.fema.gov layer 28)           | refreshed monthly                       |
| Highlands Preservation/Planning  | `maps.nj.gov/.../Government_Boundaries/MapServer/6`                                           | statutory, stable                       |
| Pinelands Management Areas       | `services1.arcgis.com/nCm6SZaiGMuGX35l/.../Pinelands_ManagementAreas/FeatureServer/0`         | CMP, edited Jan 2026                    |
| Sewer Service Areas              | `mapsdep.nj.gov/.../Utilities/MapServer/8`                                                    | updated with WQMP amendments            |
| NJDEP Open Space                 | `services1.arcgis.com/QWdNfRs7lkPq4g4Q/.../Open_Space/FeatureServer/66`                       | ongoing                                 |
| SADC Preserved Farmland          | `services.arcgis.com/gzSkSfQGxyX6dicF/.../NJFPP_Preserved_Farms/FeatureServer/0`              | ongoing                                 |

Universe (live counts, Jul 7 2026): 3,478,727 NJ parcels; 155,325 class-1 vacant; **13,980 class-1 at 5–100 CALC_ACRE**.
