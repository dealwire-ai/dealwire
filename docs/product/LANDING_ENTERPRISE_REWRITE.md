# Landing Page Rewrite — Enterprise / Bespoke Firm Positioning

**Ticket:** [#272](https://github.com/dealwire-ai/dealwire/issues/272)
**Status:** Draft v1 — copy for review
**Branch target:** rewrite `apps/web/src/app/page.tsx`

---

## Positioning brief

- **Shape:** Bespoke services firm. Palantir-coded, not SaaS-coded. Engagements, not subscriptions. Founder-led sales.
- **Market:** Institutional private real estate and adjacent sophisticated allocators — institutional CRE owner/operators, real estate PE, real estate credit, family offices, multi-strategy allocators. Not generalist PE.
- **Wedge:** Every institutional firm has decades of deal flow, memos, broker relationships, rent rolls, and IC discussions trapped across Outlook, PDFs, SharePoint, and people's heads. Plugging AI into any one of those systems produces toy answers. Dealwire builds the private intelligence layer that activates the whole corpus.
- **Voice:** Firm, not platform. "We build." "We deploy." No seats, no tiers, no feature grid.
- **CTA:** "Talk to founders." Always human.

---

## Page structure

1. Hero
2. The asset nobody is using
3. What we build
4. How an engagement runs
5. Firms we build for
6. Security
7. Closing CTA

Deletions from current page: _"One platform. Every function,"_ _"Your buy box becomes a set of automatic rules,"_ _"Broker blasts go to 200 firms / You have 48 hours,"_ and every section shaped around individual-operator anxiety. The new buyer is a managing partner, not a principal running a small shop.

---

## Copy

### 1. Hero

> # We build your firm's private intelligence layer.
>
> Every deal your firm has ever seen, every memo ever written, every broker relationship ever formed — connected, queryable, and working for your team the moment a new deal lands. Your institutional knowledge stops being something only a handful of senior partners carry, and starts being something your whole firm operates on.
>
> **[ Talk to founders ]**

Notes:

- No product screenshot in the hero. A quiet visual — process diagram or a single line-art illustration — reinforces the "firm, not app" read.
- Security is a top-nav link to a dedicated `/security` page (Trove-style), not a hero CTA.
- Lead is "previously impossible," not "faster." Speed is a consequence; the real sell is that dormant institutional knowledge becomes an operating asset.

### 2. The asset nobody is using

> ## Your firm's most valuable asset is already inside your firm.
>
> Twenty years of deal flow. Every memo, every IC discussion, every broker relationship, every rent roll, every comp, every call that was right, every call that was wrong. It sits in Outlook threads, PDF attachments, SharePoint folders, and the heads of your longest-tenured partners.
>
> When a senior partner retires, most of it walks out the door. When a new deal lands on a Tuesday morning, the firm reinvents context it already paid to learn. The knowledge exists. The firm just can't reach it.
>
> Generic AI tools don't fix this. Plugging a chatbot into one inbox, one CRM, or one data room produces toy answers — because none of those systems, on their own, contains what your firm actually knows. The institutional intelligence only appears once the whole corpus is unified.
>
> That's what we build.

### 3. What your firm gets

Three pillars, each led by a capability that didn't exist in your firm before — not a faster version of something you already do.

> ## Your firm's memory, on call.
>
> Ask, in plain English, any question about any deal your firm has ever touched. Which broker showed you this asset in 2019, and what did you pass on. How your firm has historically underwritten distress in this submarket. Which LP questions came up the last time you raised a fund with this strategy. This used to live only in the heads of your longest-tenured partners. Now the whole firm can reach it.
>
> ## Patterns across your own deal flow.
>
> Fifteen years of deals, sitting in PDFs and inboxes, becomes a queryable record of what your firm has seen, priced, and passed. The next time a teaser lands, your team sees every comparable your firm has ever underwritten, every broker relationship you have with the seller's side, and every reason you'd have to move faster than the other twenty firms on the blast. These are analyses your team cannot currently run, at any speed.
>
> ## Screening and memo drafting, operationalized.
>
> Inbound deal flow — OMs, rent rolls, teasers — gets read against your buy box the moment it lands, and first-pass memos get drafted from the underlying documents in minutes. Your team stops triaging and starts deciding. Senior time stops going to first drafts and starts going to judgment.

### 4. How an engagement runs

Four numbered phases, each two sentences. Each phase ends in an outcome, not an activity.

> ## How an engagement runs
>
> **01 &nbsp; Mapping.** &nbsp; We spend the first week inside your firm — reading memos, sitting on IC, shadowing acquisitions. You walk away with a concrete plan naming the intelligence gaps that are costing your team deals, and what we'll build to close them.
>
> **02 &nbsp; Unification.** &nbsp; We provision your private data layer and ingest the sources that matter: email, CRM, diligence archives, underwriting models, market data, public records. Within weeks, your firm's full corpus becomes searchable for the first time.
>
> **03 &nbsp; Agents.** &nbsp; We build the first agents against your workflows — deal screening, memo drafting, relationship recall, market queries — and deploy them where your team already works. Analysts start answering questions the firm could not previously answer at all.
>
> **04 &nbsp; Operation.** &nbsp; We stay embedded. New questions, new data sources, new capabilities ship continuously. Every month your firm's intelligence layer gets sharper, and the compounding advantage it produces is one your competitors can't buy off a shelf.

Visual: a horizontal four-step diagram. Thin lines, small numerals, no stock illustrations.

### 5. Firms we build for

A quiet logo carousel. No client names called out individually, no per-client summaries. The firms speak by appearing on the page; the page speaks by being general.

> ## Firms we build for
>
> [ &nbsp; logo &nbsp; &nbsp; logo &nbsp; &nbsp; logo &nbsp; &nbsp; logo &nbsp; &nbsp; logo &nbsp; &nbsp; logo &nbsp; ]
>
> _Institutional CRE owner/operators. Real estate PE and credit. Family offices. Multi-strategy allocators deploying capital into private markets._

Notes:

- Horizontal auto-scrolling strip. Monochrome/desaturated logos so no one firm visually dominates.
- No named testimonials or case cards in v1. Add individual quotes later only when we have ones we'd put on a billboard.
- The one-line caption below the strip replaces per-client summaries — it tells the reader what _kind_ of firms we work with without forcing us to disclose which.

### 6. Security (home-page treatment)

Security has its own standalone page at `/security` (drafted below under **Navigation**). On the home page itself, a short trust band — two sentences, one link — sits between "Firms we build for" and the closing CTA. It's a reassurance, not a pitch.

> ## Your firm's data stays your firm's.
>
> Every Dealwire deployment runs on infrastructure provisioned for your firm alone. Your data is never mingled with another client's, and it is never used to train an AI model.
>
> **[ Read our security commitments → ]** &nbsp; (links to `/security`)

Notes:

- Deliberately short on the home page so the reader's attention stays on the outcome story; Security owns its own destination for anyone who needs to go deeper.
- The full `/security` page copy is under the **Navigation** section below.

### 7. Closing CTA

> ## Build your firm's intelligence layer.
>
> We take on a small number of engagements each quarter. If your firm is evaluating what AI can actually do inside institutional private markets, we'd like to talk.
>
> **[ Talk to founders ]**
>
> &nbsp;
>
> _Dealwire — a Frontstep company._

---

## Navigation

Top nav — minimal, Trove-style. Security is a standalone destination, not a hero CTA.

- **Dealwire** (home, left)
- **Engagements**
- **Security** → `/security`
- **[ Talk to founders ]** (right-aligned primary CTA)

No "Pricing," no "Product," no "Sign in" in the primary nav (sign-in lives in a footer or hidden route — it's for existing-client login, not a visitor action).

### `/security` page (standalone, linked from top nav)

Full page, not an in-page section. Header + two load-bearing claims up top, deeper detail below the fold. Same visual language as the home page (austere, dark).

> # Security
>
> Dealwire is built for firms whose data is, itself, the business — inbound deal flow, LP communications, proprietary underwriting, decades of institutional knowledge. Two commitments sit underneath everything we build.
>
> ## Per-client isolation
>
> Your Dealwire is not a tenant on a shared platform. It runs on infrastructure we provision for your firm alone — separate database, separate environment, separate credentials. Your data is never mingled with another firm's. This is a direct consequence of the way we work: because every engagement is bespoke, isolation isn't a paid-upgrade tier, it's how the system is shaped from day one.
>
> ## Your data never trains a model
>
> We do not fine-tune or train foundation models on your firm's data. Every model call runs under zero-retention enterprise terms with our AI providers. The intelligence we build on your corpus is yours; it does not become anyone else's, and it does not leak into any model anyone else uses.
>
> ---
>
> ## Further detail
>
> **Model providers.** &nbsp; Inference is handled by enterprise accounts with our LLM providers, under zero-retention and no-training terms. Specific providers, model versions, and terms are available under NDA.
>
> **Sub-processors.** &nbsp; A current list of sub-processors (hosting, observability, email-provider integrations) is available under NDA.
>
> **Data residency.** &nbsp; Deployments can be shaped to your firm's residency requirements. Where region constraints apply, we provision your data layer in the region you specify.
>
> **Access controls.** &nbsp; SSO via your identity provider. Role-based access within the Dealwire system, scoped to your firm's existing access patterns. Engineering access to client environments is logged and auditable.
>
> **Incident response.** &nbsp; Defined notification timelines and a named point of contact for each engagement. Specifics provided as part of contracting.
>
> **Compliance roadmap.** &nbsp; SOC 2 Type II is on our roadmap; if you require it before engagement, tell us — we can share current status under NDA.
>
> **[ Request security diligence pack ]**

Notes:

- `/security` is its own Next.js route: `apps/web/src/app/security/page.tsx`. Not a hash link on the home page.
- The "Request security diligence pack" CTA routes to the same founders contact flow, tagged for procurement handling.
- Only claim what's true today. Everything above reflects the two confirmed claims; the "Further detail" block is written as statements of how we operate, not certifications we hold.

---

## Tone constraints

- Sentences under 22 words. Paragraphs under 5 sentences.
- No _unlock_, _revolutionize_, _seamlessly_, _AI-powered_, _intelligent platform_, _end-to-end_.
- Yes _build_, _unify_, _deploy_, _source_, _screen_, _memo_, _corpus_, _firm_.
- No emoji. No exclamation marks. No rhetorical questions.
- Present tense. Active voice. "We build," not "Dealwire builds."

---

## Implementation notes

**File:** `apps/web/src/app/page.tsx`

**Sections to delete from current page** (grep targets):

- `"Broker blasts go to 200 firms"` (solo-operator framing)
- `"Full-stack acquisition intelligence"` (product framing)
- `"One platform. Every function"` (SaaS framing)
- `"Your buy box becomes a set of automatic rules"` (config framing)
- `"From call to deployed"` (can be retained in spirit — merge into "How an engagement runs")
- `"Built by engineers. Backed by top operators."` (retain sentiment; rewrite)
- `"See what a fully underwritten deal looks like in 20 minutes"` (product demo framing — delete)

**New route:** `apps/web/src/app/security/page.tsx` for the Security deep page the ticket called out. Hero page links to the section anchor in-page; footer and nav link to the dedicated page.

**Visual direction:** Austere. Dark background retained (current page is dark and it works for this voice). Serif for hero + section heads, mono for metadata, sans for body. No stock photography. No product screenshots above the fold.

---

## Open dependencies

1. **Logo permissions** for the carousel — a short email to each of JK / Gabay / Terlidis / Dolan / Cape / Terra Nova asking for logo-use permission. Because we're anonymizing (no per-client descriptions, no quotes), this is a lower ask than naming engagements, and most institutional clients will say yes.
2. **`/security` page** — drafted in this doc under **Navigation**; needs to be built as a standalone route (`apps/web/src/app/security/page.tsx`). Designer will want matching visual language to the home page.
3. **Founder section** — not in this draft. Decide whether to add a short "Who builds this" section (two or three founders, one-line each, no headshots) between Sections 4 and 5. Recommendation: yes, keep it short; it reinforces "firm, not platform."

---

## What this draft is NOT doing, deliberately

- Not showing a product screenshot. The product is consequence, not the sell.
- Not listing integrations. Integrations are tactical detail; the sell is the firm.
- Not claiming SOC 2 before we have it.
- Not naming generalist PE. Keeps the lane sharp and avoids a head-on fight with Trove.
- Not a feature grid. Feature grids are SaaS tells.
- Not self-serve. Every path on the page ends in "Talk to founders."
