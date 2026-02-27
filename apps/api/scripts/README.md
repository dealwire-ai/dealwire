# Demo Scripts

Scripts for running live demos and testing the full agentic pipeline.

## Prerequisites

- `RESEND_API_KEY` set in `apps/api/.env`
- `railway` CLI installed and linked to `analyzer-api` (for log monitoring mode)
- A monitored Outlook inbox connected via Microsoft Graph webhook

## Scripts

### `demo.sh` — Full demo orchestrator

Runs the complete agentic loop end-to-end:
1. Sends 10 diverse deal emails to the monitored inbox (burst, 1s apart)
2. Watches Railway logs until all 10 deals are screened by the agent
3. Sends a hardcoded deal digest email to the same address

```bash
# From apps/api/
pnpm demo <email>

# Example
pnpm demo jordan@jkequities.com
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--wait <seconds>` | Skip log monitoring, use a fixed sleep instead (e.g. `--wait 90`) |

**Log monitoring** (default): tails `railway logs --filter "Initial screening completed"` in the background and polls every 5s. Advances to the digest as soon as all 10 deals are confirmed screened. Hard timeout at 180s.

**Environment overrides:**
```bash
# Already handled by --wait flag, no separate env var needed
pnpm demo jordan@jkequities.com --wait 60
```

---

### `send-test-email.sh` — Send deal emails to the inbox

Sends real deal emails via Resend to a monitored Outlook inbox, triggering the Microsoft Graph webhook and the full screening pipeline.

```bash
pnpm send-test-email <inbox-email>              # single multifamily deal
pnpm send-test-email <inbox-email> --burst      # 10 deals across asset types, 1s apart
```

The 10 burst deals cover: multifamily, office, industrial, retail, hotel, self-storage, medical office, student housing, mixed-use dev site, NNN net lease.

---

### `send-test-digest.sh` — Send a hardcoded digest email

Sends a pixel-perfect deal digest email directly via Resend — bypasses the database and service entirely. Useful for demoing the digest format without waiting for the full pipeline.

The hardcoded digest matches the Lambert Capital demo org:
- **3 YES** (approved): Galleria Commons retail, SecureSpace self-storage, MedPark Tower medical office
- **7 NO** (passed): multifamily, office, industrial, hotel, student housing, dev site, NNN
- Broker leaderboard: Brian Kessler (100%), Amanda Torres (50%), Jennifer Walsh (33%)
- Summary bar: 10 screened, 3 approved, 30% pass rate, 8 brokers

```bash
pnpm send-test-digest <email>

# Example
pnpm send-test-digest jordan@jkequities.com
```

---

## Demo Script (what to say)

Suggested flow for a live recording:

1. **Start the demo**: `pnpm demo jordan@jkequities.com`
2. **Narrate step 1**: "I'm sending 10 deal emails to the inbox right now — multifamily, office, industrial, retail..."
3. **While waiting (step 2)**: Switch to Outlook and show the inbox filling up with deal emails and screening replies arriving in real time. Show deals being moved into `Commercial Income` and `Healthcare` folders vs `Passed Deals`.
4. **Digest arrives (step 3)**: Open the digest email. Show the summary bar, the 3 approved deals with reasoning, the 7 passes, and the broker leaderboard.
5. **Ask the AI assistant**: *"Which brokers sent me deals that match my criteria, and which ones should I bother responding to?"*

---

## Deal Criteria (Lambert Capital demo org)

Configured in Screening Preferences for `org_3AEGDJh3sL8Q11Hlw1i7i70AqVI`:

> High-yield commercial income properties in Sun Belt markets. Target assets: grocery-anchored retail centers, self-storage portfolios, and medical office buildings with strong tenancy. Minimum 6% cap rate. Deal size under $50M. Pass on: office, multifamily, industrial, hospitality, student housing, and development sites.

**Buckets:**
- `Commercial Income` — retail + self-storage (MOVE_TO_FOLDER)
- `Healthcare` — medical office (MOVE_TO_FOLDER)
- `Passed Deals` — everything else
