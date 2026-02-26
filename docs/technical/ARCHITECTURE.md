# Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              ANALYZER — SYSTEM ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────────────────────────┘

   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │   Clerk      │    │  Microsoft   │    │   Socrata    │
   │  (Auth/SSO)  │    │  Graph API   │    │  SODA API    │
   └──────┬───────┘    └──────┬───────┘    └──────┬───────┘
          │                   │                    │
          │ JWT               │ OAuth +            │ Public data
          │ tokens            │ webhooks           │ (tax liens,
          │                   │                    │  PLUTO, HPD)
          ▼                   ▼                    │
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                                                                   │
│   FRONTEND  (Next.js 16 / React 19 / Tailwind 4)          Deployed on: Vercel    │
│   ─────────────────────────────────────────────────────────────────────────────   │
│                                                                                   │
│   ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  ┌─────────────────────┐  │
│   │  Dashboard   │  │   Manage /   │  │  Parcels      │  │  Chat UI            │  │
│   │  /dashboard  │  │   Settings   │  │  /public-data │  │  (streaming agent)  │  │
│   └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  └──────────┬──────────┘  │
│          │                │                   │                     │              │
│          └────────────────┴───────────────────┴─────────────────────┘              │
│                                      │                                            │
│                        ┌─────────────┴──────────────┐                             │
│                        │  API Clients (lib/api.ts)   │                             │
│                        │  Authorization: Bearer JWT  │                             │
│                        └─────────────┬──────────────┘                             │
│                                      │                                            │
└──────────────────────────────────────┼────────────────────────────────────────────┘
                                       │
                                       │  HTTP (REST + streaming)
                                       │
                                       ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                                                                   │
│   BACKEND  (NestJS 11)                                     Deployed on: Railway   │
│   ─────────────────────────────────────────────────────────────────────────────   │
│                                                                                   │
│   ┌─ GUARDS ───────────────────────────────────────────────────────────────────┐  │
│   │  ClerkAuthGuard → JWT verify → extract userId → resolve organizationId    │  │
│   └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                   │
│   ┌─ CONTROLLERS ──────────────────────────────────────────────────────────────┐  │
│   │                                                                            │  │
│   │  DealController        ChatController        PublicDataController          │  │
│   │  GET /deals            POST /chat            POST /public-data/ingest      │  │
│   │                        (streaming)           GET  /public-data/parcels     │  │
│   │                                              GET  /public-data/stats       │  │
│   │                                                                            │  │
│   │  PreferencesController   WebhookControllers (Clerk, Microsoft, Resend)     │  │
│   │  GET/PUT /preferences    POST /webhooks/microsoft                          │  │
│   │  CRUD /screening-buckets POST /webhooks/clerk                              │  │
│   │  GET /broker-intelligence                                                  │  │
│   └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                   │
│   ┌─ SERVICES ─────────────────────────────────────────────────────────────────┐  │
│   │                                                                            │  │
│   │  ┌─────────────────────── Email Pipeline ───────────────────────────────┐  │  │
│   │  │                                                                      │  │  │
│   │  │  MicrosoftWebhookService                                             │  │  │
│   │  │    │ receives Graph notification                                     │  │  │
│   │  │    ▼                                                                 │  │  │
│   │  │  DealDetectionService ──── quick classify (deal vs non-deal)         │  │  │
│   │  │    │                                                                 │  │  │
│   │  │    ▼                                                                 │  │  │
│   │  │  SQSService.enqueueNormalizedEmail() ──────────────────────┐         │  │  │
│   │  │                                                            │         │  │  │
│   │  │                                            ┌───────────────┼──────┐  │  │  │
│   │  │                                            │   AWS SQS     │      │  │  │  │
│   │  │                                            │   normalized- │      │  │  │  │
│   │  │                                            │   email queue │      │  │  │  │
│   │  │                                            └───────────────┼──────┘  │  │  │
│   │  │                                                            │         │  │  │
│   │  │  NormalizedEmailListenerService ◄──────────────────────────┘         │  │  │
│   │  │    │ (SQS consumer, long-poll 20s)                                   │  │  │
│   │  │    ▼                                                                 │  │  │
│   │  │  EmailProcessorService.process()                                     │  │  │
│   │  │    ├── EmailProcessingService (extract text, OCR PDFs)               │  │  │
│   │  │    ├── DealSummaryService (narrative + structured summary)           │  │  │
│   │  │    ├── DataExtractionService (price, cap rate, NOI, etc.)            │  │  │
│   │  │    ├── AddressNormalizationService                                   │  │  │
│   │  │    ├── ContactNormalizationService                                   │  │  │
│   │  │    ├── InitialScreeningService (apply buckets → YES/NO)              │  │  │
│   │  │    ├── S3Service (upload attachments)                                │  │  │
│   │  │    ├── EmailTemplateService (build analysis reply HTML)              │  │  │
│   │  │    └── MicrosoftGraphService (send reply + draft broker email)       │  │  │
│   │  │                                                                      │  │  │
│   │  └──────────────────────────────────────────────────────────────────────┘  │  │
│   │                                                                            │  │
│   │  ┌─────────────────────── AI / Agent Layer ─────────────────────────────┐  │  │
│   │  │                                                                      │  │  │
│   │  │  AnalyzerAgentService (unified agent for chat + email replies)       │  │  │
│   │  │    Tools: query_parcels, get_parcel_stats,                           │  │  │
│   │  │           update_deal_criteria, update_buy_box, update_always_skip   │  │  │
│   │  │                                                                      │  │  │
│   │  └──────────────────────────────────────────────────────────────────────┘  │  │
│   │                                                                            │  │
│   │  ┌─────────────────────── Public Data Layer ────────────────────────────┐  │  │
│   │  │                                                                      │  │  │
│   │  │  SodaAdapter ──► NycIngestionService ──► DistressScoringService      │  │  │
│   │  │  (generic         (tax liens, PLUTO,      (compute 0-100 scores)     │  │  │
│   │  │   Socrata client)  HPD violations)                                   │  │  │
│   │  │                                                                      │  │  │
│   │  │  ParcelQueryService (filter, paginate, export)                       │  │  │
│   │  │                                                                      │  │  │
│   │  └──────────────────────────────────────────────────────────────────────┘  │  │
│   │                                                                            │  │
│   │  ┌─────────────────────── Scheduled Jobs ───────────────────────────────┐  │  │
│   │  │                                                                      │  │  │
│   │  │  ⏱  MicrosoftRenewalScheduler   every 12h   renew Graph subs        │  │  │
│   │  │  ⏱  DealDigestService           every 30m   send deal digest emails  │  │  │
│   │  │                                                                      │  │  │
│   │  └──────────────────────────────────────────────────────────────────────┘  │  │
│   │                                                                            │  │
│   │  BrokerIntelligenceService   ScreeningBucketService   MetricsService       │  │
│   │  (broker stats/leaderboard)  (customizable tiers)     (Prometheus /metrics)│  │
│   │                                                                            │  │
│   └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                   │
└───────────────────────────────┬───────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
     ┌────────────────┐ ┌────────────┐ ┌──────────────┐
     │   PostgreSQL   │ │  AWS S3    │ │   OpenAI     │
     │   (Supabase)   │ │            │ │  gpt-4o-mini │
     │                │ │  Document  │ │              │
     │  Users         │ │  storage   │ │  Deal detect │
     │  Organizations │ │  (attach-  │ │  Summarize   │
     │  Deals         │ │   ments)   │ │  Screen      │
     │  Screenings    │ │            │ │  Agent chat  │
     │  Assets        │ └────────────┘ └──────────────┘
     │  Contacts      │
     │  Parcels       │        ┌──────────────┐
     │  Documents     │        │   Resend     │
     │  Preferences   │        │  (email      │
     │  Subscriptions │        │   delivery   │
     └────────────────┘        │   for digest │
                               │   emails)    │
                               └──────────────┘


   ┌─────────────────────────────────────────────────────────────────────────────┐
   │                          EMAIL PROCESSING FLOW                              │
   │                                                                             │
   │  Broker sends         Microsoft          Backend            User's          │
   │  deal email    ──►    Graph     ──►      webhook    ──►     inbox           │
   │                       webhook            (classify)         gets            │
   │                       fires              (enqueue)          AI reply        │
   │                                              │              + action card   │
   │                                              ▼              + broker draft  │
   │                                          SQS queue                          │
   │                                              │                              │
   │                                              ▼                              │
   │                                         AI pipeline                         │
   │                                    (extract → summarize                     │
   │                                     → screen → reply)                       │
   │                                              │                              │
   │                                              ▼                              │
   │                                     Deal + Screening                        │
   │                                     stored in DB  ──►  Digest email         │
   │                                                        (every 30 min)       │
   └─────────────────────────────────────────────────────────────────────────────┘
```
