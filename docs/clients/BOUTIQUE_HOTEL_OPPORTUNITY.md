# Boutique Hotel Acquisition — New Vertical Opportunity

## Overview

A potential new use case for Analyzer: automated deal sourcing and market intelligence for boutique hotel acquisitions in Europe. This extends the platform's agentic deal-sourcing model from CRE email screening into proactive opportunity identification.

## Lead: Minas Terlidis / Bohopo

**Granola meeting recording (Feb 17, 2026):** https://notes.granola.ai/d/357252d5-a531-4e88-a662-047d99bd06d0
Use `mcp__claude_ai_Granola__query_granola_meetings` with this document ID (`357252d5-a531-4e88-a662-047d99bd06d0`) to ask follow-up questions about the conversation.

**Meeting:** Noah ↔ Minas, Feb 17 2026 at 5:00 PM
**Follow-up meeting:** ~March 3 2026, same time slot
**Action item:** Noah was supposed to email Minas for specific criteria (target cities, hotel characteristics, rating thresholds). Status unknown — check Outlook.

### Business Model

- **Bohopo** acquires old/underperforming hotels in EU secondary city centers
- Converts them into ~20-room boutique hotels
- Targets secondary/smaller cities (Marseille, Thessaloniki) — not major capitals
- Current deal sourcing: search booking.com for worst-rated hotels, send team to approach owners directly (old-fashioned relationship building)

### Pain Points

1. **Deal sourcing is manual and inefficient**
   - Searching booking.com by hand for low-rated hotels
   - No automated pipeline for identifying acquisition targets
   - Wants an AI agent to automate identification of underperforming hotels

2. **City selection / market intelligence**
   - Tourist visitation data limited for secondary cities
   - Residential pricing info scattered across sources
   - Country-level data exists but city-specific insights are lacking
   - Needs aggregated city characteristics data

3. **Hotel pricing & operations** (lower priority for us)
   - Uses Perseus management system — falling short
   - Pricing team struggling with effectiveness
   - Historical occupancy data available but underutilized
   - Expedia/booking platforms provide basic pricing but insufficient

### Specific Criteria Still Needed

Noah's follow-up email should capture:
- Complete list of target cities
- Hotel characteristics criteria (size range, star rating, age, etc.)
- Exact rating thresholds on booking.com (what counts as "worst-rated"?)
- Budget/price range per acquisition
- Geographic scope (which EU countries?)

## Second Lead: Eric Doroski

- Interested in an internal pricing tool for potential acquisition of boutique hotels
- Source: cold call notes from sales reps
- No Granola recording available — predates the recording window or happened outside meetings
- Less context available; needs follow-up to understand his use case

## How This Maps to Analyzer

### Natural fit (deal sourcing)

This is structurally identical to CRE deal screening, but **proactive instead of reactive**:
- CRE: emails arrive → screen against buy box → surface good deals
- Hotels: scrape booking.com/similar sources → filter by criteria (rating, city, size) → surface acquisition targets

Same pattern: data in → AI analysis → actionable intelligence delivered through integrations.

### Data signals (different from CRE)

| CRE Signals | Hotel Signals |
|-------------|---------------|
| Cap rate, NOI, price/unit | Review scores, star rating, room count |
| Occupancy, rent roll | Historical occupancy, ADR, RevPAR |
| Location, zoning, year built | City center location, building age/condition |
| Market comps, submarket stats | Tourism data, city-level demand, seasonality |
| Broker relationships | Owner contact info, willingness to sell |

### What a prototype could look like

1. **Booking.com scraper/monitor** — Identify hotels below a rating threshold in target cities
2. **City intelligence layer** — Tourism stats, residential pricing, demand indicators for secondary EU cities
3. **Automated target list** — Ranked list of acquisition candidates matching Minas's criteria, delivered via email or dashboard
4. **Enrichment** — Property details, ownership info, recent reviews analysis, pricing trends

### Open Questions

- Is booking.com scraping feasible/legal at scale? (TOS considerations)
- Are there hotel data APIs (STR, OTAInsight, etc.) that could replace scraping?
- How does this fit product-wise — separate product, or a "hospitality" vertical within Analyzer?
- Pricing model for this use case — per-city? per-lead? subscription?
