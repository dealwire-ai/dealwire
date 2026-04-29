# Grafana Cloud Setup Guide

## Step 1: Sign up for Grafana Cloud (Free Tier)

1. Go to https://grafana.com/auth/sign-up/create-user
2. Sign up for a free account
3. Verify your email

## Step 2: Create a Prometheus Data Source

1. Log into Grafana Cloud
2. Go to **Connections** → **Data Sources** → **Add data source**
3. Select **Prometheus**
4. Configure:
   - **Name**: `dealwire-api` (or whatever you want)
   - **URL**: `https://dealwire-api-production.up.railway.app/metrics` (your Railway URL)
   - **Access**: Server (default)
   - **Scrape interval**: `15s` (or whatever you prefer)
5. Click **Save & Test**

**Note:** Grafana Cloud's free tier includes a hosted Prometheus instance, but you can also scrape directly from your endpoint.

## Step 3: Set up Prometheus Scraping (Recommended)

Grafana Cloud provides a Prometheus instance. To scrape your metrics:

### Option A: Use Grafana Cloud Agent (Recommended)

1. In Grafana Cloud, go to **Connections** → **Data Sources** → **Prometheus**
2. Click on your Prometheus data source
3. Go to **Configuration** → **Scrape Configs**
4. Add a new scrape config:

```yaml
scrape_configs:
  - job_name: "dealwire-api"
    scrape_interval: 15s
    static_configs:
      - targets: ["dealwire-api-production.up.railway.app"]
    metrics_path: "/metrics"
    scheme: "https"
```

### Option B: Use Grafana Cloud's Remote Write

1. In Grafana Cloud dashboard, go to **My Account** → **Prometheus**
2. Copy your **Remote Write Endpoint** URL and **Username/Password**
3. Set up a Prometheus instance locally or use Railway to scrape and forward

## Step 4: Create Your First Dashboard

1. Go to **Dashboards** → **New** → **Add visualization**
2. Select your Prometheus data source
3. Add panels with these queries:

### Deals Processed Rate

```
rate(deals_processed_total[5m])
```

### AI Call Latency (p95)

```
histogram_quantile(0.95, ai_call_duration_seconds_bucket)
```

### Decision Breakdown

```
sum by (decision) (deals_processed_total)
```

### Error Rate

```
rate(deal_processing_errors_total[5m])
```

### Emails Received

```
sum(emails_received_total)
```

## Step 5: Verify Metrics Are Flowing

1. Make sure your Railway deployment has the `/metrics` endpoint working
2. Visit: `https://dealwire-api-production.up.railway.app/metrics`
3. You should see Prometheus-formatted metrics
4. In Grafana, check **Explore** → Select Prometheus → Run query: `up`
5. Should show `up{job="dealwire-api"} 1` if scraping is working

## LLM Cost Observability

The API emits Prometheus metrics for every LLM call (both Vercel AI SDK and raw OpenAI SDK sites), plus per-run totals for underwriting runs. Use these queries to build a dashboard.

### Metrics emitted

| Metric                          | Type      | Labels                                           | What it is                                       |
| ------------------------------- | --------- | ------------------------------------------------ | ------------------------------------------------ |
| `llm_tokens_total`              | Counter   | `stage`, `model`, `direction`, `organization_id` | Tokens consumed per call, in/out                 |
| `llm_cost_usd_total`            | Counter   | `stage`, `model`, `organization_id`              | USD cost per call (incremented by dollar amount) |
| `llm_call_duration_seconds`     | Histogram | `stage`, `model`, `status`                       | Wall-clock latency per LLM call                  |
| `underwriting_run_llm_cost_usd` | Histogram | `organization_id`                                | Total USD cost of a completed underwriting run   |
| `underwriting_run_llm_tokens`   | Histogram | `organization_id`, `direction`                   | Total tokens in/out per underwriting run         |

`stage` values include `classification`, `extraction.om`, `extraction.rent_roll`, `extraction.t12`, `extraction.generic`, `field_mapping`, `workflow.deal_analysis`, `workflow.assumption_ask`, `workflow.reply_router`, `workflow.template_fill`, `workflow.validation`, `proforma_scan`, `deal_detection`, `initial_screening`, `data_extraction`, `summary`, `broker_reply_draft`, `deal_decision`, `image_ocr`, `chat_agent`.

### Queries

```promql
# Cost rate ($/hour)
sum(rate(llm_cost_usd_total[5m])) * 3600

# Cost by stage ($/hour)
sum by (stage) (rate(llm_cost_usd_total[1h])) * 3600

# Cost by model ($/hour)
sum by (model) (rate(llm_cost_usd_total[1h])) * 3600

# Average cost per completed underwriting run (last 1h)
sum(rate(underwriting_run_llm_cost_usd_sum[1h]))
  / sum(rate(underwriting_run_llm_cost_usd_count[1h]))

# p95 cost per underwriting run
histogram_quantile(
  0.95,
  sum by (le) (rate(underwriting_run_llm_cost_usd_bucket[1h]))
)

# Tokens per hour, split by stage and direction
sum by (stage, direction) (rate(llm_tokens_total[1h])) * 3600

# p95 LLM latency by stage
histogram_quantile(
  0.95,
  sum by (stage, le) (rate(llm_call_duration_seconds_bucket[5m]))
)

# Top 5 most expensive stages (last 24h)
topk(5, sum by (stage) (rate(llm_cost_usd_total[24h])))

# Cost by organization (last 24h)
sum by (organization_id) (rate(llm_cost_usd_total[24h])) * 86400
```

### Per-run cost — Postgres

Prometheus gives you trends; for "what did run X cost?" query the `UnderwritingRun` row directly. The columns `totalPromptTokens`, `totalCompletionTokens`, `totalLlmCostUsd`, and `llmCostByStage` (JSON) are populated at the end of every run. Every run also logs a single `llm.run.summary` structured log line with the same data for grep-based lookups.

## Troubleshooting

**No metrics showing?**

- Check that `/metrics` endpoint is accessible: `curl https://your-url/metrics`
- Verify scrape config in Grafana Cloud
- Check scrape interval isn't too long

**Can't connect to data source?**

- Make sure your Railway URL is publicly accessible
- Check if Railway requires authentication (add headers if needed)
- Verify the `/metrics` path is correct
