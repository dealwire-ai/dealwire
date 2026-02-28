# Bohopo Demo Script

**Audience:** Minas Terlidis (Co-Founder & CEO), possibly Oren Saada (Head of Acquisitions)
**Format:** ~45–60 second screen recording, or live walkthrough on the March 3 call
**Goal:** Get Minas excited enough to sign a project — show him something his team clearly can't do manually

---

## Context on Minas

- PE/infrastructure background — Dubai Palm Island, BlackRock, Macquarie. Understands data and process rigor.
- Currently sourcing via relationships and manual desk research. No proprietary data stack.
- Targeting 650–700 rooms in 2–4 years (doubling current portfolio). That volume of deal flow can't be handled manually.
- Existing cities: Athens (2 hotels), Brussels (2), Porto (2 in development). Demo cities map directly to his portfolio.
- Oren Saada runs acquisitions — he's the one who benefits most operationally. Worth mentioning in the pitch.

---

## The Core Hook

> "This does in 2 seconds what your team does manually for hours — and it runs every week without anyone touching it."

The pain to hit: Booking.com + Google Maps + spreadsheets + broker calls to find the worst-rated hotels in a city. Bohopo's team is doing this by hand. The demo shows the automated version.

---

## Demo Flow (~50 seconds)

### 1. Open on full dashboard (5 sec)
> "This is a live acquisition intelligence dashboard tracking 200 hotels across five of your target markets — Athens, Thessaloniki, Marseille, Brussels, Porto."

Point to: stats bar (200 properties, ~11 priority targets, avg score).

---

### 2. Filter to Thessaloniki, max rating 3.7 (10 sec)
> "Let's say Oren wants to focus on Thessaloniki this week. One filter — nine properties surface immediately with strong acquisition signals."

Point to: the red-badged rows jump to the top. The filter takes 1 second.

---

### 3. Zoom in on top row (10 sec)
> "Top result: 2.1 stars, over 1,000 reviews. That's not a new hotel having a rough month — that's a consistently bad operator who's been failing guests for years. High review volume is what gives us confidence in the signal."

Explain the score: rating signal × review confidence. The more reviews, the more certain the dysfunction is real.

**Why this impresses Minas specifically:** He has a PE mindset — he'll immediately understand why confidence-weighted signals beat raw ratings. This is the same logic as conviction-weighted portfolio construction.

---

### 4. AI chat — ask about Athens targets (15 sec)
Type: *"What are the top 3 hotels I should approach in Athens?"*

> "This is the analyst layer. It knows your acquisition criteria — 20 to 50 rooms, city center, mid-range pricing. It's not just listing hotels; it's reasoning about operator quality and what the data implies about each property."

Wait for response, point to the ranked list with reasoning per hotel.

**Why this impresses Minas:** He won't be impressed by a table — he'll be impressed by judgment. The AI articulates *why* a property is interesting, not just that it has a low score.

---

### 5. Pull back to the full view (5 sec)
> "This runs automatically every week. Instead of Oren spending half a day on Booking.com, he gets a ranked shortlist in his inbox — with the reasoning already written. Your team's time goes to owner outreach and relationship-building, not research."

---

## Things That Will Specifically Impress Minas

| What to show | Why it lands |
|---|---|
| Score = rating × review confidence | PE logic — conviction-weighted, not raw sentiment |
| 1,000+ reviews on a 2.1-star hotel | Makes the dysfunction feel real and persistent, not noise |
| Filters snap to his specific cities | The product already knows his world |
| AI explains reasoning, not just data | He's a decision-maker — he wants judgment, not dashboards |
| "Runs every week automatically" | The agentic pitch: this replaces hours of manual work per week |
| Thessaloniki as a city | He's likely considering Greek expansion beyond Athens — this shows the platform can scale geographically before he even has to ask |

---

## Lines to Have Ready

**On the data:**
> "Review volume is the key signal most people miss. A 2.5-star hotel with 50 reviews might just be new. A 2.5-star hotel with 900 reviews is a structurally broken operation."

**On the agentic angle:**
> "The dashboard is just the visibility layer. The real version of this monitors your target cities continuously and surfaces new signals to Oren the moment something shifts — a hotel's rating drops, a property goes quiet on Booking.com, a new listing appears."

**On the opportunity framing:**
> "Right now your team finds maybe 5–10 targets a month through networks and manual search. With this running, you're scanning every hotel in every city you care about, every week. The edge is coverage."

**On Minas's growth targets:**
> "You're trying to get to 650 rooms in the next few years. That's a lot of deal flow to generate. The only way to do that at scale is systematic sourcing, not just relationships."

---

## Potential Questions & Answers

**"Is this real data?"**
> "The demo uses synthetic data so we could move fast without API keys. The real version pulls from Google Places, Booking.com, and open property records — same signals, live and updated weekly."

**"What does it cost to build?"**
> "We're scoping a Phase 1 that gets you live data for your five target cities, automated weekly refreshes, and the AI analyst layer. I'll send you numbers before the call."

**"Can it do [X city]?"**
> "Yes — any city with sufficient hotel review data on Google or Booking.com. EU secondary cities work well. We'd prioritize your expansion markets."

**"How is this different from just using Booking.com?"**
> "Booking.com shows you one city at a time, in their interface, sorted by their criteria. This gives you a ranked cross-city shortlist, scored by your acquisition criteria, delivered to you — rather than requiring someone to go dig for it."

---

## Show During the Call: JK's Digest Email

Pull up one of Jordan Karlik's actual digest emails as a live example of what the agentic output looks like in practice.

> "Here's a real example of what we already deliver to another client — this is a weekly digest that hits their inbox automatically. Different asset class, but same idea: the agent does the research, ranks the opportunities, and surfaces them in the format you actually work in. For Bohopo, this would be your target hotel shortlist with Oren's name on it every Monday morning."

**Why show this:**
- Moves it from "cool demo" to "this is real and already running for someone"
- The email format is instantly familiar — no learning curve, no new tool to open
- Gives Minas a concrete sense of what the deliverable looks like, not just the dashboard
- Builds trust that we've shipped this, not just prototyped it

**Note:** JK's digest is for a different client (CRE deal screening, not hotel acquisition sourcing). Acknowledge that briefly if asked — the underlying capability is the same, the content would be tuned to Bohopo's criteria.

---

## What to Build Before the Real Demo (if he wants to go deeper)

1. **Live data for Athens** — pull actual Google Places ratings for real Athens hotels (SerpApi, free tier). Show real hotel names he might recognize.
2. **Email delivery mockup** — show what the weekly digest email looks like (ranked shortlist, click to see full analysis).
3. **Owner lookup angle** — mention that the next layer is cross-referencing distressed properties with ownership records to enable direct outreach.
