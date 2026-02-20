# Web 3.0 Is Agents: The Agentic Layer Thesis

*Research brief — February 2026*

---

## The Core Insight

Web 1.0 was read. Web 2.0 was read/write. Web 3.0 is read/write/**do**.

The crypto crowd tried to claim "Web3" as decentralized ownership. They were wrong about the mechanism but right about the intuition: the next internet isn't about humans clicking through dashboards. It's about software that acts autonomously on your behalf — that has agency. The real Web 3.0 is agents.

This isn't theoretical anymore. In the first six weeks of 2026, nearly **$1 trillion in market cap** evaporated from the S&P 500 Software & Services Index as "seat compression" — companies needing fewer software licenses because AI agents do the work — triggered a massive valuation reset. Publicis Sapient reports cutting traditional SaaS licenses by ~50%, replacing them with AI agents described as "10x faster, 100x smarter" than junior staff. Salesforce is scrambling to pivot from $150/month user seats to $0.10/action AI pricing. The transition is happening now.

---

## Why Financial Services / Private Markets

The agent opportunity exists everywhere, but financial services — and private markets specifically — is where it's most valuable. Here's why:

### 1. The Work Is Expensive and Repetitive

A junior analyst at a PE firm costs $150-250K/year fully loaded. A commercial real estate acquisitions analyst: similar. An associate at an investment bank: $200-350K. These people spend 60-80% of their time on tasks that are fundamentally pattern matching against unstructured data:

- Reading offering memorandums and extracting key terms
- Building comparable analyses from scattered data sources
- Screening deal flow against investment criteria
- Writing investment committee memos
- Pulling property records, zoning data, environmental reports
- Tracking broker relationships and deal history
- Drafting responses to brokers

An agent doesn't replace the $500K managing director making judgment calls. It replaces the 3-5 analysts feeding that MD the information they need to make those calls. **The agent competes with headcount, not software.** This is critical: you're not selling into a $50K/year software budget. You're selling into a $750K/year analyst payroll line item.

### 2. The Data Is Fragmented and Messy

Public markets have Bloomberg, Refinitiv, FactSet — mature, consolidated data infrastructure. Private markets have... nothing comparable. Deal data lives in:

- Broker emails (image-heavy HTML blasts, PDFs, Word docs)
- County assessor websites (each with different formats)
- Municipal permit databases
- CoStar/Crexi (expensive, incomplete)
- Relationship knowledge in people's heads
- Rent rolls in Excel spreadsheets
- Environmental reports in PDFs

This fragmentation is a **feature, not a bug** for an agent business. An agent that can ingest, normalize, and structure this chaos builds a compounding data asset that gets more valuable with every deal it processes. A human analyst processes maybe 500 deals/year. An agent processes 500 deals/week across multiple clients, building a proprietary dataset of normalized deal intelligence that no individual firm could match.

### 3. The Workflows Are Integration-Native

The work happens in email, not dashboards. Brokers send deals via email. Analysts respond via email. Investment committees get memos via email. This is perfect for an agentic model because:

- **You don't need to change user behavior.** The agent meets them where they already work.
- **The integration IS the product.** Outlook/Gmail monitoring, automated responses, drafted replies — these aren't features bolted onto a dashboard. They are the core value delivery mechanism.
- **Switching costs compound.** Every broker relationship the agent learns about, every deal criterion it calibrates to, every organizational preference it absorbs makes it harder to leave.

### 4. The Decisions Have Real Dollar Impact

A good deal screener saves an acquisitions team from wasting due diligence resources on bad deals (easily $10-50K per deal in legal, environmental, appraisal costs). A fast screener means getting to good deals before competitors. Missing a good deal or wasting time on a bad one has direct, quantifiable financial consequences — which means the willingness to pay is high.

---

## The Moat Stack: Where Real Defensibility Lives

The research is clear: thin wrappers around LLMs are commodities. The question is what creates defensibility in the agentic layer. There are five layers, and the strongest businesses stack multiple:

### Layer 1: Workflow Embedding (Strongest)

> "The defining question is no longer 'Do you have proprietary data?' but 'How will you gain control of the workflow?'" — Vendep Capital

When your agent is the thing monitoring the inbox, screening every deal, drafting every broker reply, writing every investment memo — removing it breaks the operation. You're not a tool they open; you're the invisible infrastructure their deal flow runs on. This is the Bloomberg Terminal effect: it's not that Bloomberg has the best data (though they do). It's that every trader's workflow is built around the Terminal. Ripping it out would require rebuilding muscle memory, processes, and integrations across the entire firm.

**What this looks like in practice:** The agent handles 100% of incoming deal flow. It knows the firm's buy box, the MD's communication style, the broker relationships, the org's risk tolerance. It has months of context about every deal they've seen. Replacing it means losing all that institutional knowledge.

### Layer 2: Proprietary Data Accumulation (Strong)

Every deal the agent processes creates structured intelligence:
- Normalized deal metrics across thousands of offerings
- Broker reliability scores (who sends good deals vs. noise)
- Market pricing data extracted from actual deal flow (not listed prices)
- Property intelligence assembled from dozens of public sources
- Historical decision patterns and outcomes

Over time, this becomes a dataset that no one else has. CoStar has listing data. PitchBook has fundraising data. But no one has structured, normalized data from the actual deal flow — the real prices, the real terms, the actual broker communications — across hundreds of firms.

**The compounding effect:** Client A screens 1,000 deals. Client B screens 1,000 deals. The agent has now seen 2,000 deals with structured data. It can tell Client C that a deal is priced 15% above recent comps in the submarket — intelligence that no single firm could generate alone.

### Layer 3: Integration Depth (Moderate)

- Microsoft Graph API for Outlook monitoring
- Gmail API for Google Workspace shops
- S3 for document storage and OCR pipeline
- County/municipal APIs for property data enrichment
- Brokerage APIs (when available)
- CRM connectors (Salesforce, Juniper Square, Yardi)

Each integration is table-stakes individually but the compound effect of having them all working together, tested, and reliable creates real switching costs.

### Layer 4: Domain Model Tuning (Moderate but Erosive)

Fine-tuned models for deal detection, data extraction, and decision-making. These improve with more training data (which comes from Layer 2). But model capabilities are improving rapidly across the board, so this moat erodes unless tied to proprietary data.

### Layer 5: Network Effects (Aspirational but Transformative)

The endgame: **one firm's rejected deal is another firm's target.**

If you have 100 CRE acquisitions firms using the agent, each with different buy boxes, you can build a matching network. Firm A passes on a deal in Dallas because they only buy in NYC. But Firm B specifically targets Dallas multifamily. The agent routes the deal to Firm B (with Firm A's permission or broker cooperation).

This is the marketplace / network effect layer. It's hard to build — you need critical mass — but if achieved, it creates a gravity well that's nearly impossible to escape.

---

## Business Models That Work

The research reveals five pricing models for agent businesses, and the data strongly suggests the right approach for private markets:

### FTE Replacement Pricing (Best Fit for Private Markets)

**$3,000 - $15,000/month per firm.** Position the agent as a digital analyst. This taps into headcount budgets (10x larger than IT software budgets) and the ROI is obvious: you're replacing $150-250K/year analysts.

The math: If you charge $10K/month ($120K/year) and the agent replaces even one junior analyst ($175K/year), the firm saves $55K/year while getting 24/7 coverage, no vacation, no turnover, and improving performance over time. The agent pays for itself in under a year.

### Outcome-Based Premium Tier

For firms that want it: charge a basis point premium on deals closed using agent-sourced intelligence. If the agent identifies a deal that closes at $50M and you charge 1bp, that's $5,000 per deal. This aligns incentives and captures value from the real economic outcome.

### Data Product Monetization (Future)

Once the proprietary data asset reaches critical mass, sell market intelligence products:
- Submarket deal flow reports
- Broker performance analytics
- Pricing trend data
- Investment committee benchmarking

This is the Palantir model: start with services revenue, build a proprietary data flywheel, then monetize the data itself.

### Marketplace Take Rate (Long-term)

If/when the deal matching network reaches scale: 10-25% commission on matched deals, or flat fee per qualified deal referral.

---

## What "The Agentic Layer" Actually Means

The term "agentic layer" describes a specific architectural position in the technology stack:

```
┌─────────────────────────────────┐
│        End User / Firm          │  ← They don't open an app
│    (works in Outlook/email)     │
└──────────────┬──────────────────┘
               │ email / integrations
┌──────────────▼──────────────────┐
│     THE AGENTIC LAYER           │  ← THIS IS WHERE YOU BUILD
│  ┌───────────────────────────┐  │
│  │ Workflow Orchestration    │  │  Monitors inbox, routes deals,
│  │ Decision Engine           │  │  makes screening decisions,
│  │ Integration Hub           │  │  enriches data, drafts replies,
│  │ Proprietary Data Store    │  │  manages broker relationships
│  │ Domain-Specific Models    │  │
│  └───────────────────────────┘  │
└──────────────┬──────────────────┘
               │ API calls
┌──────────────▼──────────────────┐
│     Foundation Models           │  ← Commodity layer (OpenAI,
│     (GPT, Claude, etc.)         │     Anthropic, open source)
└──────────────┬──────────────────┘
               │
┌──────────────▼──────────────────┐
│     Data Sources                │  ← Public records, APIs,
│     (county, municipal, etc.)   │     email content, documents
└─────────────────────────────────┘
```

The key insight: **the foundation model layer is commoditizing rapidly.** GPT-4 level capabilities that cost $0.03/1K tokens in 2024 now cost $0.001. The model is not the moat. The agentic layer — the domain knowledge, workflow integration, proprietary data, and decision logic built on top — is where durable value accrues.

This is analogous to the web's evolution: HTTP and web browsers commoditized, but Google (search + ads), Amazon (commerce + logistics), and Salesforce (CRM + workflow) built trillion-dollar businesses on top by owning the application layer. The agent equivalent is building the intelligence layer that owns the workflow and accumulates the data.

---

## The Competitive Landscape and Gaps

### What Exists Today

| Company | What They Do | Weakness |
|---------|-------------|----------|
| **CoStar/LoopNet** | Property listings, comps | Dashboard-based. No agency. Data is broad but shallow on individual deals. Expensive. |
| **Reonomy** | Property intelligence | Good data but no workflow integration. You have to go to their dashboard. |
| **Cherre** | Property data platform | Infrastructure play, not agent. Serves as data source, not decision-maker. |
| **PitchBook/Preqin** | PE/VC deal data | Great for public fundraising data. Zero visibility into actual deal flow and screening. |
| **Juniper Square** | Fund management | System of record for investor relations. No deal sourcing or screening. |
| **Crexi** | CRE marketplace | Listing platform. No agent intelligence. |
| **EliseAI** | Residential leasing automation | $250M Series E. But focused on property management, not acquisitions. |

### The Gap

Nobody is building the **autonomous acquisitions analyst** that:
1. Lives in your email
2. Screens every deal against your specific criteria
3. Enriches deals with deep property data from public sources
4. Manages broker relationships with context
5. Learns your preferences and improves over time
6. Accumulates proprietary deal intelligence across the market

This is exactly what Analyzer is building. The question is how to make it a much larger business.

---

## How to Make This a $1B+ Business: Three Strategic Paths

### Path 1: Depth-First (The Bloomberg Approach)

**Go deep in CRE acquisitions, then expand asset classes.**

- Perfect the CRE deal screening agent (you're here)
- Add deep data enrichment (public records, market comps, environmental)
- Expand to business acquisitions (PE deal flow — different data extraction)
- Add debt/lending (term sheets, refinance opportunities)
- Eventually: any private market asset class

**Why it works:** Each asset class has the same structural dynamics — expensive analysts, fragmented data, email-driven workflows. The core agent architecture generalizes. The data moat compounds across asset classes.

**Revenue at scale:** 5,000 firms x $10K/month = $600M ARR. Add data products: $1B+.

**Risk:** Slow. Takes years to build deep data in each vertical. Competitors can pick off individual verticals.

### Path 2: Platform-First (The Shopify Approach)

**Build the platform for anyone to deploy domain-specific agents.**

Instead of building one agent for CRE, build the agentic layer platform: email monitoring, document extraction, decision engine, integration framework, data enrichment pipeline. Then let verticalized agents be built on top — by you and by third parties.

- CRE deal screening agent (your first "app")
- Insurance underwriting agent (someone builds on your platform)
- M&A due diligence agent (another builder)
- Compliance monitoring agent (another builder)

**Why it works:** You capture value from every vertical without building each one yourself. The platform gets better as more agents are built on it (shared integrations, shared data processing capabilities).

**Revenue at scale:** Platform fees + marketplace take rate. If you become the Shopify of agentic finance, the ceiling is very high.

**Risk:** Platform businesses are hard. Requires different DNA than vertical product building. You might build great infrastructure that someone else's vertical agent dominates on top of.

### Path 3: Network-First (The Carta/AngelList Approach)

**Build the deal-matching network first, monetize intelligence.**

Focus on getting as many firms as possible onto the platform (even at low/free pricing for basic screening) to build the deal flow network. Then monetize:

- Deal matching between firms (your reject = my target)
- Market intelligence products from aggregated deal data
- Broker analytics (which brokers send the best deals in which markets)
- Pricing data (what deals are actually trading at, not list prices)

**Why it works:** The network effect, if achieved, is the strongest moat of all. No one can replicate a network with critical mass. The data products from aggregated deal flow would be genuinely novel — no one else has this data.

**Revenue at scale:** Network effects create winner-take-all dynamics. If you're the network, you're the network. Carta is valued at $7.4B because it's the cap table network. A deal flow network could be comparably valuable.

**Risk:** The chicken-and-egg problem is brutal. You need deal volume to attract firms, but you need firms to get deal volume. Classic marketplace cold start.

---

## The Honest Assessment

### What's Actually New Here

The honest question: couldn't you have built deal screening software 5 years ago? What's different now?

**Three things are genuinely new:**

1. **The AI can actually read.** Before 2023, you couldn't reliably extract structured data from a broker's image-heavy HTML email blast or a scanned PDF offering memorandum. Now you can. This unlocks the entire intake pipeline.

2. **The AI can actually decide.** Deal screening requires judgment — "is this a good deal for THIS client given THEIR criteria?" — not just keyword matching. LLMs can make these judgment calls with reasonable accuracy. This wasn't possible with rules-based systems.

3. **The cost curve makes agent economics work.** Running an agent that processes 1,000 deals/month costs hundreds of dollars in API calls, not hundreds of thousands. The margin on replacing a $200K analyst is enormous.

### What's Genuinely Hard

1. **Data quality is everything.** If the agent misclassifies deals — missing good ones or flagging bad ones — trust erodes instantly. This is a field where false negatives (missing a good deal) are extremely costly. The bar for accuracy is high.

2. **Enterprise sales in finance.** CRE firms, PE shops, and banks are conservative buyers. Long sales cycles, procurement processes, compliance reviews. This is not a PLG viral-growth market.

3. **The model moat erodes.** Anything your fine-tuned model can do today, a foundation model will do better in 12 months. Your moat has to be in data and workflow, not model capability.

4. **Incumbents aren't sleeping.** CoStar has the data and the budget. Yardi has the workflow integration. Salesforce has Agentforce. The question is whether a purpose-built agent startup can move fast enough to establish a moat before incumbents add AI capabilities.

---

## What I'd Actually Build

If I were starting fresh with the thesis "Web 3.0 is agents, build in financial services," here is the highest-conviction version:

### The Autonomous Acquisitions Intelligence Layer

**What it does:**
1. Monitors all deal flow channels (email today, marketplace APIs tomorrow)
2. Extracts, normalizes, and structures every data point from every deal
3. Enriches with deep property/asset data from public and private sources
4. Screens against client-specific criteria with human-level judgment
5. Manages broker relationships with full context and history
6. Generates market intelligence from aggregated, anonymized deal flow
7. Eventually: matches deals between firms (rejected by A, perfect for B)

**The moat stack:**
- **Workflow:** You ARE the deal flow pipeline. Removing you breaks acquisitions.
- **Data:** Every deal processed adds to a proprietary dataset no one else has.
- **Network (long-term):** Aggregated deal flow creates intelligence and matching capabilities.

**Pricing:**
- **Core agent:** $5-15K/month (FTE replacement positioning)
- **Data enrichment premium:** +$2-5K/month for deep property data
- **Market intelligence products:** Sold separately to broader market
- **Deal matching network:** Commission-based, long-term play

**Why it wins:**
- Competes with headcount ($250K analysts), not software ($50K SaaS)
- Gets stronger with every deal processed (compounding data asset)
- Meets users in email (no behavior change required)
- Asset-class generalizable (CRE → PE → business acquisitions → lending)
- Network effects possible at scale (deal matching, market intelligence)

**The 10-year vision:**
The Bloomberg Terminal of private markets — but instead of a human sitting at a terminal querying data, an agent that autonomously processes deal flow, enriches it with deep intelligence, and delivers actionable analysis through the channels you already use. Every private market firm has one. It's the thing that makes them competitive.

---

## Key Takeaways

1. **The "agentic layer" is the real Web 3.0.** Not crypto, not tokens — software that acts autonomously. The market is growing from $7.8B (2025) to $52.6B (2030). Gartner says 40% of enterprise apps will embed agents by end of 2026.

2. **Private markets are the best vertical.** Expensive labor, fragmented data, email-native workflows, high-dollar decisions. The unit economics of replacing analysts are compelling.

3. **The moat is workflow + data, not models.** Foundation models are commoditizing. Defensibility comes from being embedded in the operational workflow and accumulating proprietary data that compounds over time.

4. **Price against headcount, not software.** Agent businesses that position as FTE replacement ($3-20K/month) tap into budgets 10x larger than IT software and have clearer ROI.

5. **The network effect is the endgame.** If you achieve critical mass in a private market vertical, aggregated deal intelligence and deal matching create a gravity well that's nearly impossible to escape.

6. **The SaaS model is breaking.** $1T in software market cap evaporated in early 2026 from seat compression. The next generation of software companies won't sell seats — they'll sell outcomes. Build for that future.

---

*This is what you're building. The screener is the wedge. The data is the moat. The network is the endgame.*
