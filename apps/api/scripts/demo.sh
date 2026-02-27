#!/usr/bin/env bash
#
# Full demo script — orchestrates the complete agentic loop for a live recording.
#
# What happens:
#   1. Sends 5 diverse deal emails to the monitored inbox (burst)
#   2. Tails Railway logs until all 5 are screened (or timeout)
#   3. Sends the deal digest email
#
# Usage:
#   ./scripts/demo.sh --email <email>               # monitor Railway logs (default)
#   ./scripts/demo.sh --email <email> --wait 90     # fixed sleep instead of log monitoring
#
# Requires: RESEND_API_KEY in .env (or exported), railway CLI linked to analyzer-api

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Parse flags
EMAIL=""
USE_FIXED_WAIT=false
FIXED_WAIT=90
TOTAL_DEALS=5
MAX_WAIT=180  # hard timeout in seconds regardless of mode

while [ $# -gt 0 ]; do
  case "$1" in
    --email) EMAIL="${2:?--email requires an address}"; shift 2 ;;
    --wait)  USE_FIXED_WAIT=true; FIXED_WAIT="${2:?--wait requires a number of seconds}"; shift 2 ;;
    *) echo "Unknown argument: $1"; echo "Usage: demo.sh --email <email> [--wait <seconds>]"; exit 1 ;;
  esac
done

if [ -z "$EMAIL" ]; then
  echo "Usage: demo.sh --email <email> [--wait <seconds>]"
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Analyzer Demo"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Email:  $EMAIL"
if [ "$USE_FIXED_WAIT" = true ]; then
  echo "  Mode:   fixed wait (${FIXED_WAIT}s)"
else
  echo "  Mode:   Railway log monitoring (timeout: ${MAX_WAIT}s)"
fi
echo ""

# ── Step 1: Send burst of 5 deal emails ──────────────────────────────────────
echo "▶ Step 1/3  Sending ${TOTAL_DEALS} deal emails to $EMAIL..."
bash "$SCRIPT_DIR/send-test-email.sh" "$EMAIL" --burst
BURST_DONE_AT=$(date +%s)
echo ""

# ── Step 2: Wait for pipeline ────────────────────────────────────────────────
echo "▶ Step 2/3  Waiting for agent to screen all ${TOTAL_DEALS} deals..."
echo ""

if [ "$USE_FIXED_WAIT" = true ]; then
  # ── Fixed sleep mode ──────────────────────────────────────────────────────
  for i in $(seq "$FIXED_WAIT" -10 10); do
    printf "\r  ⏳ %3ds remaining..." "$i"
    sleep 10
  done
  sleep 10
  printf "\r  ✓ Done (fixed wait).             \n"

else
  # ── Railway log monitoring mode ───────────────────────────────────────────
  # Check railway CLI is available
  if ! command -v railway &>/dev/null; then
    echo "  ⚠ railway CLI not found — falling back to fixed ${FIXED_WAIT}s wait"
    sleep "$FIXED_WAIT"
  else
    SCREENED=0
    ELAPSED=0
    POLL_INTERVAL=5

    # Stream Railway deploy logs in the background, writing matching lines to a temp file
    TMP_LOG=$(mktemp)
    trap 'kill $LOG_PID 2>/dev/null; rm -f "$TMP_LOG"' EXIT

    railway logs \
      --service analyzer-api \
      --filter "Initial screening completed" \
      2>/dev/null >> "$TMP_LOG" &
    LOG_PID=$!

    while [ "$SCREENED" -lt "$TOTAL_DEALS" ] && [ "$ELAPSED" -lt "$MAX_WAIT" ]; do
      sleep "$POLL_INTERVAL"
      ELAPSED=$((ELAPSED + POLL_INTERVAL))

      SCREENED=$(wc -l < "$TMP_LOG" | tr -d ' ')

      printf "\r  ⏳ %d/%d screened (%ds elapsed)..." "$SCREENED" "$TOTAL_DEALS" "$ELAPSED"
    done

    kill $LOG_PID 2>/dev/null || true
    echo ""

    if [ "$SCREENED" -ge "$TOTAL_DEALS" ]; then
      DONE_AT=$(date +%s)
      TOOK=$((DONE_AT - BURST_DONE_AT))
      printf "  ✓ All %d deals screened in %ds.\n" "$TOTAL_DEALS" "$TOOK"
    else
      printf "  ⚠ Timeout after %ds — only %d/%d deals screened. Sending digest anyway.\n" \
        "$MAX_WAIT" "$SCREENED" "$TOTAL_DEALS"
    fi
  fi
fi

echo ""

# ── Step 3: Send deal digest ──────────────────────────────────────────────────
echo "▶ Step 3/3  Sending deal digest to $EMAIL..."
bash "$SCRIPT_DIR/send-test-digest.sh" "$EMAIL"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Demo complete."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
