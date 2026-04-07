# Froggy Companies Demo — April 10, 2026

## Client Context

**Jim Froehlich** — Founder & Manager, Froggy Companies (Froggy Funding). Based in Laconia, NH. Former intel officer, systems engineer background. Real estate development in NH/Maine — sends direct mail letters to vacant lot owners to source development deals.

**Also on call:** Aidan (Jim's son), Jake (Maxfield Real Estate — focuses on development deals), possibly Isaac.

**Relationship:** Warm lead. Initial call was March 25. Jim asked for Belknap and Carroll County specifically.

## What Jim Told Us (March 25 Call)

- Uses **Land ID** to find parcels — extremely labor-intensive, requires clicking individual parcels one by one
- Wants: "For this county, give me every lot that meets certain criteria" — bulk query instead of click-by-click
- Sends letters to vacant lot owners in NH/Maine as part of his deal sourcing
- Deal screener was interesting but not a clear $100/mo sell — his NH deal volume is manageable (15-20/week)
- **Land development parcel lookup is the bigger pain point and opportunity**
- Security-conscious (former intel) — raised concerns about data running on our servers vs local

## Demo Thesis

**"These guys can build me the parcel tool I need."** We wrangled public data from NH GRANIT (statewide parcels) and the NH Zoning Atlas (statewide zoning regulations) into a single filterable view across all towns in both counties — something Land ID can't do.

## Demo Flow

### 1. Open with the pain (30 sec)

"Last time you described the Land ID problem — clicking parcels one by one. We went and pulled the actual public data for Belknap and Carroll County to show you what's possible."

### 2. Show the full table unfiltered (1 min)

- Point out the stats bar: total parcels, priority targets, total acreage, avg $/acre
- "This is every parcel across both counties in one view"
- Scroll through — note the address, town, acreage, zoning, assessed value, owner name, and development score

### 3. Filter down to development targets (2 min)

- Click **Vacant** only in land use filter → "Now we're looking at just vacant land"
- Set min acreage to **2** → "At least 2 acres"
- Point out how priority targets count updates in real time
- Toggle **Belknap only** → then **Carroll only** → "Compare the two counties side by side"
- Click **Multifamily Only** → "Now only parcels where the zoning allows multi-family"
- Hover over a zoning code → show the tooltip with min lot size, max height, residential/MF/ADU flags

### 4. Talk about the data sources (1 min)

- "This pulls from NH GRANIT — the state's parcel database — and the NH Zoning Atlas which has 200+ regulatory attributes per zoning district"
- "We joined them so each parcel has its zoning rules attached — min lot size, what's allowed by right, setbacks, height limits"
- "For a production tool, this would refresh automatically as the state updates their data"

### 5. AI Analyst demo (2 min)

- Click: "What are the top development opportunities in Belknap County?"
- Let it respond with ranked parcels and reasoning
- Then ask: "Find parcels over 5 acres under $100k assessed value"
- "You can ask it anything about the data — compare towns, find patterns, identify clusters"

### 6. Vision / what comes next (1-2 min)

- "This is a demo with sample data. A production version would have:"
  - Real parcel boundaries on a map (PostGIS)
  - Owner mailing addresses for direct mail campaigns
  - Automated mail merge / letter generation
  - Tax delinquency data layered in
  - Environmental overlays (wetlands, flood zones, conservation)
  - Alert system: "new vacant parcel listed in your target zone"
- "The data infrastructure already exists — we built this for NYC tax liens. NH is a new geography but the same adapter pattern."

## Anticipated Questions & Answers

**"Is this real data?"**
"This demo uses sample data with real town names, real zoning districts from the NH Zoning Atlas, and realistic value distributions. A production version would pull directly from NH GRANIT's ArcGIS API — same source Land ID and town assessors use."

**"How often does the data update?"**
"NH GRANIT updates annually. We'd set up automated refresh — same pattern we use for our NYC data which refreshes weekly."

**"Can you add a map?"**
"Yes — the parcel data includes boundaries as polygons. We'd render them on a map with color-coding by development score. Click a parcel on the map → see all the details."

**"Can you do Maine too?"**
"Maine has a similar state GIS portal. The adapter pattern means adding a new state is configuration, not engineering. We'd scope that as a follow-on."

**"How much would this cost?"**
(Don't bring up pricing — if asked, deflect to value conversation.) "Let's first make sure the tool solves the right problem for you. We can talk about pricing once we've nailed the feature set."

**"What about the deal screener?"**
"Still progressing — happy to show you updates on that separately. Today is about the parcel tool since that seemed like the bigger pain point."

**"Where does the data live? Security concerns."**
"We run on AWS/Railway with standard encryption. For a development tool like this, the data is all public records — no proprietary deal data involved. Happy to discuss security architecture in detail."

## Lines to Have Ready

- "What you described — 'give me every lot that meets these criteria' — that's exactly what this does."
- "Land ID is great for looking at individual parcels. This is for finding which parcels to look at."
- "The zoning data is the secret weapon — most tools show you the parcel but not what you can build on it."
- "We built this in a week with public data. Imagine what it looks like with 6 months of development."
