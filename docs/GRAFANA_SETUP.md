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
   - **Name**: `analyzer-api` (or whatever you want)
   - **URL**: `https://analyzer-api-production.up.railway.app/metrics` (your Railway URL)
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
  - job_name: 'analyzer-api'
    scrape_interval: 15s
    static_configs:
      - targets: ['analyzer-api-production.up.railway.app']
    metrics_path: '/metrics'
    scheme: 'https'
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
2. Visit: `https://analyzer-api-production.up.railway.app/metrics`
3. You should see Prometheus-formatted metrics
4. In Grafana, check **Explore** → Select Prometheus → Run query: `up`
5. Should show `up{job="analyzer-api"} 1` if scraping is working

## Troubleshooting

**No metrics showing?**
- Check that `/metrics` endpoint is accessible: `curl https://your-url/metrics`
- Verify scrape config in Grafana Cloud
- Check scrape interval isn't too long

**Can't connect to data source?**
- Make sure your Railway URL is publicly accessible
- Check if Railway requires authentication (add headers if needed)
- Verify the `/metrics` path is correct

