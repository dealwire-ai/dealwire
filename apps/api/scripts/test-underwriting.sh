#!/usr/bin/env bash
#
# Send a test underwriting email with deal documents attached.
# Triggers the full prod pipeline: email → webhook → SQS → extract → fill → deliver.
#
# Usage:
#   ./scripts/test-underwriting.sh                              # uses default Preston Gardens docs
#   ./scripts/test-underwriting.sh /path/to/deal/docs/          # custom docs directory
#   ./scripts/test-underwriting.sh file1.pdf file2.xlsx         # specific files
#
# Requires: RESEND_API_KEY in .env (or exported)

set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  export $(grep -E '^RESEND_API_KEY=' .env | xargs)
fi

if [ -z "${RESEND_API_KEY:-}" ]; then
  echo "Error: RESEND_API_KEY not set. Add it to apps/api/.env or export it."
  exit 1
fi

UNDERWRITING_EMAIL="${UNDERWRITING_INBOUND_EMAIL:-underwriting@mail.dealwire.ai}"
FROM_ADDR="isaac@mail.dealwire.ai"
FROM_NAME="Isaac Levine"

# Collect files to attach
FILES=()
if [ $# -eq 0 ]; then
  # Default: Preston Gardens test docs
  DEFAULT_DIR="$HOME/Downloads/Preston Gardens - Louisville"
  if [ ! -d "$DEFAULT_DIR" ]; then
    echo "Error: Default docs not found at $DEFAULT_DIR"
    echo "Usage: $0 [docs-dir | file1 file2 ...]"
    exit 1
  fi
  for f in "$DEFAULT_DIR"/*; do
    [ -f "$f" ] && FILES+=("$f")
  done
elif [ -d "$1" ]; then
  for f in "$1"/*; do
    [ -f "$f" ] && FILES+=("$f")
  done
else
  FILES=("$@")
fi

if [ ${#FILES[@]} -eq 0 ]; then
  echo "Error: No files found to attach."
  exit 1
fi

echo "Sending underwriting test to $UNDERWRITING_EMAIL..."
echo "  From: $FROM_NAME <$FROM_ADDR>"
echo "  Files: ${#FILES[@]}"

# Build request JSON using temp files (large PDFs exceed arg limits)
TMPDIR=$(mktemp -d)
trap "rm -rf $TMPDIR" EXIT

# Start with base request
jq -n \
  --arg from "$FROM_NAME <$FROM_ADDR>" \
  --arg to "$UNDERWRITING_EMAIL" \
  --arg subject "underwrite" \
  --arg html "<p>Please underwrite the attached deal documents.</p>" \
  '{from: $from, to: [$to], subject: $subject, html: $html, attachments: []}' \
  > "$TMPDIR/request.json"

for f in "${FILES[@]}"; do
  FILENAME=$(basename "$f")
  base64 < "$f" > "$TMPDIR/b64.txt"

  # Determine MIME type
  EXT="${FILENAME##*.}"
  case "$EXT" in
    pdf) MIME="application/pdf" ;;
    xlsx) MIME="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ;;
    xls) MIME="application/vnd.ms-excel" ;;
    csv) MIME="text/csv" ;;
    *) MIME="application/octet-stream" ;;
  esac

  # Build attachment object from file (avoids arg length limits)
  jq -n --arg fn "$FILENAME" --arg type "$MIME" --rawfile content "$TMPDIR/b64.txt" \
    '{filename: $fn, content: ($content | rtrimstr("\n")), type: $type}' > "$TMPDIR/att.json"

  # Append to request
  jq --slurpfile att "$TMPDIR/att.json" '.attachments += $att' "$TMPDIR/request.json" \
    > "$TMPDIR/request2.json" && mv "$TMPDIR/request2.json" "$TMPDIR/request.json"

  echo "    - $FILENAME ($MIME)"
done

BODY_FILE="$TMPDIR/request.json"

HTTP_CODE=$(curl -s -o /tmp/resend-uw-response.json -w "%{http_code}" \
  -X POST "https://api.resend.com/emails" \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d @"$BODY_FILE")

RESPONSE=$(cat /tmp/resend-uw-response.json)

if [ "$HTTP_CODE" = "200" ]; then
  EMAIL_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "unknown")
  echo ""
  echo "Sent! (email_id: $EMAIL_ID)"
  echo "Pipeline should process in ~60-90 seconds."
  echo "Check Railway logs: mcp__railway__get-logs or 'railway logs'"
else
  echo ""
  echo "Failed (HTTP $HTTP_CODE):"
  echo "$RESPONSE"
  exit 1
fi
