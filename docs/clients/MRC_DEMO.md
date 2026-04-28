# Madison Realty Capital — Demo Script

**Audience:** Marc Schwartz, MD of Originations & Acquisitions, Madison Realty Capital · w/ David Shorenstein
**Date:** Thursday, 1:00 PM
**Format:** Live walkthrough
**URL:** `/demos/mrc`

---

## Context (from Granola — Apr 24 intro)

Marc previously ran a manual sourcing playbook: interns and cold-callers scoured business journals in LA, Miami, and West Palm Beach for newly-approved development sites, identified the developer, and cold-called them with a construction loan pitch. That process landed him a **$95M Seattle deal**.

He wants to replicate this at scale via automation. Internal constraint: a partner at MRC is "paranoid" about AI on company systems, so he may start with a personal implementation before pitching it internally — that's relevant to how we frame this.

Three things were on the table from the intro: (1) business journal automation, (2) deal screener for inbox, (3) contact tracking. **This demo is just #1.**

## Demo Thesis (one-liner)

> "We've productized your interns. The platform monitors business journals, permit feeds, and news APIs across your stated markets every day, identifies the developer + project + loan need, scores it against your origination criteria, and drafts personalized outreach — same playbook that landed your Seattle deal, but running daily across every market you care about."

## What's in the Demo

**Markets:** LA, Miami, West Palm Beach, Seattle (his stated geography)
**Asset classes:** Multifamily, Mixed-Use, Condo, Hospitality, Office Conversion
**Data:** 80+ synthetic projects with realistic developers (Onni, Related, Crescent Heights, Holland Partner, Greystar, Lendlease, Two Roads, PMG, 13th Floor, Vulcan, Bosa, Witkoff, Mast Capital, Frisbie, etc.) and realistic source attribution (LA Business Journal, Urbanize LA, The Real Deal, Puget Sound Business Journal, Palm Beach Daily News, etc.)
**Action layer:** Each project has a drafted outreach email, signed by Marc, referencing the project specifics + MRC's lending profile

---

## Walkthrough Script

### 1. Open `/demos/mrc` (15 sec)

> "Marc, this is what your sourcing engine looks like. Header up top — Madison Realty Capital. Live indicator showing 47 sources monitored, last sync 6 minutes ago. In production this would be running every morning."

### 2. Stats bar (30 sec)

Walk through the four KPIs:

- **Projects Monitored** — "every newly-announced or approved site we've picked up"
- **Priority Targets** — "score ≥ 80, the ones we'd put in front of you each morning"
- **Avg Loan Need** — "sized to your sweet spot of $50M-$300M"
- **Outreach Drafted** — "ready to send"

### 3. Filter to LA + Multifamily (45 sec)

Click LA in the markets bar, deselect everything else. Then deselect all asset classes except Multifamily. Watch the table narrow.

> "This is what your LA multifamily pipeline would look like this morning — 9 projects across Koreatown, Hollywood, DTLA, Pasadena, Westwood, Long Beach, Inglewood. Permit-approved, cost in the right range, sponsors with track record."

### 4. Click a row — Onni Group "1500 Vermont" (60 sec)

The outreach modal opens.

> "Onni Group — 312-unit Koreatown tower, $138M loan need, permits approved 6 days ago. Their existing relationship is Bank OZK, which is exactly the type of bank-debt sponsor we'd want to peel away. Sponsor track record score 88, eleven active projects. The platform extracted Beau Jarvis, Onni's president, and his email."

Read the drafted email.

> "Note the email is specific — references Koreatown supply dynamics, mentions Madison's product, mentions speed of execution. Same letter your interns would have written, drafted in seconds."

### 5. Show another category — DTLA Crescent Heights (30 sec)

Click DTLA Grand. Discuss why an existing JPMorgan relationship is _more_ interesting, not less, because rate cycle is shifting where sponsors are willing to look.

### 6. Reset filters, switch to chat (60 sec)

Reset everything. Scroll to analyst.

Click suggestion: **"Top 5 LA opportunities to reach out to this week"**

> "This is the part that becomes a daily morning briefing. Today the data is filtered by what you're looking at. In production you'd get this in your inbox at 7am, pre-filtered to your criteria."

When the response comes back, walk through the reasoning. Point out it's referencing specific developers, basis dynamics, and the angle for outreach.

### 7. One more chat query (45 sec)

Click: **"Which developers have multiple projects across our markets?"**

> "This is where it gets interesting — the platform sees across markets, so when Crescent Heights or Greystar shows up in three markets, you know you're talking to one decision-maker about three deals."

### 8. The pitch (60 sec)

> "Marc, what you saw here is **synthetic** — but the architecture is production. To go live, we plug in:
>
> - LA Business Journal, South Florida Business Journal, Palm Beach Daily News, Puget Sound Business Journal — RSS, scrapers, or paid API where available
> - Urbanize LA, The Real Deal, Bisnow — same
> - City permit feeds (LA Department of Building & Safety, Miami Planning, Seattle SDCI) — public APIs
> - News APIs (Bloomberg/Apollo/etc.) — for the broader sponsor signal layer
>
> All of it scored against your origination criteria, with the email drafted in your voice. You're getting the morning brief at 7am, not at 7pm.
>
> On the AI-on-company-systems concern — this can run entirely on your personal infrastructure. Nothing has to touch MRC's stack until you're ready to pitch it internally. Most efficient way to start is exactly that — you running it solo for a few weeks, then bringing the partners proof of pipeline."

### 9. Close (30 sec)

> "If this is the direction, the actual build is 4-6 weeks to a personal version. We'd want to spend about 30 minutes calibrating the score against the deals you've actually wanted to do this year, and dialing in the email voice. Want to set that up next week?"

**Total walkthrough:** ~5-6 minutes.

---

## Talking Points by Persona

### For Marc (the operator)

- **Speed:** "This is what your interns did, but it runs every morning at 7am instead of one batch a quarter."
- **Voice:** The drafted email reads like he wrote it. That's the bar.
- **Volume:** "80 projects in this view today — your interns hit maybe 8 in a week."

### For David Shorenstein (capital allocator perspective)

- **Lending discipline:** Score reflects MRC's criteria, not generic. Configurable.
- **Pipeline quality:** Surface area = priority signal, not noise. The 80+ score band is small for a reason.
- **Defensibility:** Same architecture extends to the inbox screener and the contact tracker — this isn't one-trick.

---

## Anticipated Questions

| Q                                            | A                                                                                                                                                                                |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Where's the data actually coming from?"     | "Today: synthetic. Production: business journal RSS + scrapers, city permit feeds, news APIs. Path is well-trodden — same pattern we run for [other clients in the data space]." |
| "How accurate is the contact extraction?"    | "We pull from press releases + LinkedIn + company sites. Confidence-weighted — high-confidence contacts get drafted, low-confidence get flagged for human review."               |
| "Can the score be tuned to my actual deals?" | "Yes — that 30-minute calibration session is to back-test it against the deals you've wanted to do, not just hypothetical criteria."                                             |
| "What about deals that DON'T hit the news?"  | "That's the inbox screener — option #2 from our intro. Different surface area. We'd build that next."                                                                            |
| "How do we keep this off MRC systems?"       | "Runs as a personal Slack/email/dashboard for you. Zero MRC infrastructure required until you decide to bring it in-house."                                                      |
| "What if we want to add a new market?"       | "Adding a market = adding the relevant business journal sources + permit feed for that city. Usually 1-2 days of integration."                                                   |

---

## Lines to Have Ready

- _"Same playbook that landed your $95M Seattle deal — but running daily across every market."_
- _"You're getting the morning brief at 7am, not at 7pm."_
- _"Nothing has to touch MRC's stack until you're ready to pitch it internally."_
- _"The score reflects your criteria, not generic ones. Configurable."_
- _"This is option one of three — same architecture extends to the inbox screener and the contact tracker."_

---

## Post-Demo Follow-Up

1. Email Marc + David same day with the demo URL (`/demos/mrc`) and a one-pager summarizing the three workstreams from the intro (business journal automation, inbox screener, contact tracker).
2. Propose a 30-min calibration session next week to back-test the score against actual deals.
3. Send a short scoping memo on what Phase 1 (personal version) looks like — timeline, sources, deliverable.
