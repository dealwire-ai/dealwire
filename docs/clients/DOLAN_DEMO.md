# DD|HA Demo — Forever Wild Guest Intelligence

**Client:** Thomas Dolan, DD|HA (thomas@ddha.com)
**Meeting:** April 7, 2026 @ 10:00 AM EDT
**Format:** Live screen share walkthrough
**URL:** `/demos/ddha`

---

## Client Context

- Thomas Dolan founded DD|HA in 2018 after 18 years as partner at HVS (hospitality valuation/consulting)
- Currently rebranding **Emerson Resort** (Catskill Mountains) to **"Forever Wild"** — adventure/energy focus targeting 20s-40s
- Property was losing $2.5M EBITDA before debt service — operational turnaround in progress
- PMS is **Stay N Touch** — stores name, phone, booking dates only. No guest intelligence.
- Old PMS database (10+ years of records) completely isolated from new system
- He researched competitors but couldn't find one that does what he needs
- Budget: 4-5 figures. Knows hundreds of hotel owners — distribution opportunity.
- He sent a real spreadsheet: 3,212 reservations, 2,855 unique guests, 255 repeat guests

## Demo Thesis

**"I need this before my next arrival."** Show Thomas that basic PMS data (name + phone) can be transformed into actionable guest intelligence — occupation, company, age, social presence, VIP scoring — all available to front desk staff before a guest walks in.

---

## Walkthrough Script

### 1. Open with the header (30 sec)

> "Thomas, what you're looking at is a guest intelligence dashboard we built for Forever Wild. We ingested guest records — names and phone numbers — and ran them through our enrichment pipeline."

Point out: **120 guests enriched, 68% enrichment rate** in the live indicator.

### 2. Stats bar (30 sec)

Walk through the 4 KPIs:

- **Guests in View** — total after filters
- **VIP Guests** — algorithmically scored based on revenue + loyalty + enrichment
- **Enrichment Rate** — percentage with meaningful public data found
- **Repeat Guests** — identified across stays with average revenue

> "Right now your front desk sees a name and a phone number. This is what they could see instead."

### 3. Guest table — the money shot (2 min)

Scroll through the table. Call out specific guests:

- **Harrington, Claire** — Managing Director at Blackstone, 6 stays, $8,940 revenue, VIP 94. "Your reservationist currently has no idea this person is a VIP. We do."
- **Tanaka, Yuki** — Head of Product at Peloton, 34 years old, impulse booker. "This is your Forever Wild target demographic. She's booked 3 times with 2-day lead time — spontaneous weekend trips."
- **Russo, Anthony** — Auto mechanic, 6 stays, VIP 88, enrichment score 42. "This is a loyalist your system would miss — no LinkedIn, low social presence, but one of your most valuable guests by revenue."

Click column headers to sort by VIP score, then by arrival date.

### 4. Filters (1 min)

- Filter to **Impulse** segment only: "These are your upsell opportunities — last-minute bookers who are spontaneous spenders."
- Filter to **VIP Score ≥ 60**: "This is your VIP list. Every one of these guests should get recognized by name at check-in."
- Filter to **Next 7d arrivals**: "This is your pre-arrival briefing for the week."

### 5. AI Analyst (2 min)

Click suggestion: **"Who are the VIPs arriving this weekend?"**

Wait for response. Then ask: **"Show me high-value guests under 40 for Forever Wild targeting"**

> "This is the intelligence layer. Your staff can ask natural language questions and get actionable answers about who's coming and how to prepare."

### 6. Close (1 min)

> "This is what guest intelligence looks like. Right now you have names and phone numbers. We turn that into profiles, VIP scores, and pre-arrival briefings — automatically. No PMS integration required to start. We can run this from a spreadsheet export today and build toward a live Stay N Touch integration."

---

## Key Talking Points

- **No PMS integration needed to start** — works from spreadsheet exports. Integration comes later.
- **68% enrichment rate from just name + phone** — imagine what we get with email addresses too
- **Repeat guest detection** — cross-references across stays, catches guests the PMS migration lost
- **Demographic insights** — ages, occupations, companies. Critical for the Forever Wild rebrand targeting.
- **Booking behavior analysis** — impulse vs. planner segmentation enables different service strategies
- **Scalable** — works for 120 guests or 12,000. Every hotel Thomas consults for could use this.

## Anticipated Questions & Answers

**Q: Where does the enrichment data come from?**

> Public sources — LinkedIn, business registrations, professional directories. Everything is publicly available information. We don't scrape private databases.

**Q: What about privacy / GDPR?**

> All data is publicly available. We recommend a transparency-first approach — you mentioned that yourself: "We'd love to know who you are but want to make it convenient." This is that.

**Q: How accurate is the enrichment?**

> The enrichment score reflects our confidence. 80+ means multiple corroborating sources. Below 50 means limited data — we flag it rather than guess. For the demo, ~68% of guests had meaningful enrichment.

**Q: Can this integrate with Stay N Touch?**

> Yes, long-term. But we don't need that to start. A weekly spreadsheet export gives us everything we need. The integration adds real-time updates and direct PMS profile enrichment.

**Q: What does it cost?**

> We're looking at a pilot engagement — let's prove the value with Emerson/Forever Wild first, then talk about pricing for broader rollout. The pilot would be in the range we discussed.

**Q: How long to set up with my real data?**

> Days, not weeks. You already sent the spreadsheet. A production enrichment run on your 2,855 guests would take a few hours to process.

**Q: What about the software you found that does something similar?**

> Happy to look at whatever you found. Our differentiator is the AI analyst layer — it's not just a data table, it's an intelligence system your staff can query. Plus we'll build to your exact spec rather than fitting you into a generic product.

## Lines to Have Ready

- "Your PMS is a filing cabinet. We're building the analyst that reads the files."
- "The guest who books a $449 suite on 2 days notice from a Manhattan phone number — that's your Forever Wild demographic. We identify them before they arrive."
- "You said the success metric is recognizing a returning guest without them telling you. That's exactly what this does."
- "This is a proof of concept from a spreadsheet. Imagine it running live on every arrival."
