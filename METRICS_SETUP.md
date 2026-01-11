# Metrics Setup Guide

OpenTelemetry + Prometheus + Grafana setup for monitoring your Analyzer API.

## Quick Start

### 1. Install Dependencies
Already done! The OpenTelemetry packages are installed.

### 2. Start Metrics Stack
```bash
docker-compose -f docker-compose.metrics.yml up -d
```

This starts:
- **Prometheus** on http://localhost:9090 (scrapes metrics from your API)
- **Grafana** on http://localhost:3002 (visualizes metrics)

### 3. Start Your API
```bash
cd apps/api
pnpm dev
```

Your API will now expose metrics at http://localhost:9464/metrics

### 4. Configure Grafana

1. Open http://localhost:3002
2. Login: `admin` / `admin` (change password when prompted)
3. Add Prometheus data source:
   - Go to **Configuration** → **Data Sources** → **Add data source**
   - Select **Prometheus**
   - URL: `http://prometheus:9090` (internal Docker network name)
   - Click **Save & Test**

### 5. Create Your First Dashboard

Go to **Dashboards** → **New** → **Add visualization**

**Example Queries:**

**Deals Processed Rate:**
```
rate(deals_processed_total[5m])
```

**AI Call Latency (p95):**
```
histogram_quantile(0.95, ai_call_duration_seconds_bucket)
```

**Decision Breakdown:**
```
sum by (decision) (deals_processed_total)
```

**Error Rate:**
```
rate(deal_processing_errors_total[5m])
```

**Emails Received:**
```
sum(emails_received_total)
```

## Available Metrics

### Business Metrics
- `deals_processed_total` - Total deals processed (labeled by decision, source)
- `deals_skipped_total` - Deals skipped (labeled by reason)
- `emails_received_total` - Emails received via webhooks (labeled by source)

### AI Metrics
- `ai_calls_total` - Total AI API calls (labeled by service, model, status)
- `ai_call_duration_seconds` - AI call duration histogram (labeled by service, model)

### Error Metrics
- `deal_processing_errors_total` - Processing errors (labeled by error_type, stage)

### Auto-Instrumented Metrics
OpenTelemetry automatically tracks:
- HTTP request duration
- HTTP request count
- Express route metrics

## Stopping Metrics Stack

```bash
docker-compose -f docker-compose.metrics.yml down
```

To remove volumes (clears Prometheus/Grafana data):
```bash
docker-compose -f docker-compose.metrics.yml down -v
```

## Troubleshooting

**Metrics not showing up?**
- Check http://localhost:9464/metrics - should show Prometheus format
- Check Prometheus targets: http://localhost:9090/targets
- Make sure `host.docker.internal` resolves on your machine (Mac/Windows should work, Linux may need different config)

**Grafana can't connect to Prometheus?**
- Make sure you're using `http://prometheus:9090` (not localhost) - this is the Docker network name

**Port conflicts?**
- Change ports in `docker-compose.metrics.yml` if 9090 or 3002 are taken
