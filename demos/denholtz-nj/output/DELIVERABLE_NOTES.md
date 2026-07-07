# New Jersey Land Screen — Notes on the Data

**What this is:** every New Jersey tax parcel classified as vacant land (property class 1)
between 5 and 100 acres, statewide — 13,751 parcels — screened
against the public development-blocker layers below. 3,450 parcels
score 70+ ("priority targets"). Built entirely from public records; no licensed data.

**How to read the score (0–99):** every parcel starts at 50. Sewer service adds 25.
Wetlands coverage subtracts up to 40 (0.4 × percent covered). FEMA flood zones subtract
15 (1%-annual-chance) or 5 (0.2%). Highlands Preservation Area and restrictive Pinelands
management areas cap the score at 15 — greenfield development in those regimes is
effectively off the table. Moderate adjustments for acreage sweet spot (10–40 ac) and
assessed land value per acre. The `score_notes` column shows the exact arithmetic for
each parcel.

**Caveats — please read before acting on any parcel:**

- **Screening-grade, not survey-grade.** Wetlands come from NJDEP's 2020 land-use/land-cover
  mapping (photo-interpreted, 0.25-acre minimum unit) — not a field delineation. A formal
  determination requires an NJDEP Letter of Interpretation. Treat the flags as "where to
  spend diligence dollars," not as regulatory conclusions.
- **Flood "no-data" is not "no risk."** FEMA's digital flood layer has coverage gaps in
  parts of NJ. Parcels marked `no-data` are unmapped, not clear.
- **Tax figure is prior-year billed tax** (MOD-IV `LAST_YR_TX`), with current assessed
  values. Delinquency and tax-sale status are only public per-municipality in NJ — no
  statewide feed exists; we can pull specific municipalities on request.
- **No owner information.** New Jersey redacts owner names from its published parcel data
  (Daniel's Law). Ownership for specific targets can be pulled from county deed records.
- **Preserved land excluded.** Parcels more than half covered by mapped open space or
  farmland-preservation easements were removed; partial overlaps (5–50%) are flagged in
  `preserved_pct`.
- **Farms excluded by class.** Farmland-assessed parcels (class 3B) are intentionally out
  of scope per our agreed criteria.
- **Vintage:** Parcel/MOD-IV composite pulled 2026-07-07 from NJ Office of GIS. MOD-IV attributes can lag reality by up to a tax year.

**Column dictionary:** `pams_pin` is NJ's statewide parcel ID (county-municipality _
block _ lot). Assessed values are the municipal assessor's figures, not market value.
`flood_zone` is the most severe FEMA zone touching the parcel. `pinelands_mgt_area`
names the Pinelands management area; "Regional Growth Area" and Towns/Villages are the
developable ones. Blank cells mean the source had no value; "unknown" means the parcel
touches the layer but the overlap percentage could not be computed.
