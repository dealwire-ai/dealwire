#!/usr/bin/env bash
#
# Send a test deal email to trigger the screening pipeline.
# The email is sent via Resend to a monitored Outlook inbox,
# which fires the Microsoft Graph webhook and runs the full flow.
#
# Usage:
#   ./scripts/send-test-email.sh <to-email>
#   ./scripts/send-test-email.sh imlevine@outlook.com
#
# Requires: RESEND_API_KEY in .env (or exported)

set -euo pipefail
cd "$(dirname "$0")/.."

# Load .env if present
if [ -f .env ]; then
  export $(grep -E '^RESEND_API_KEY=' .env | xargs)
fi

if [ -z "${RESEND_API_KEY:-}" ]; then
  echo "Error: RESEND_API_KEY not set. Add it to apps/api/.env or export it."
  exit 1
fi

TO="${1:?Usage: send-test-email.sh <to-email>}"

echo "Sending test deal email to $TO..."

HTTP_CODE=$(curl -s -o /tmp/resend-response.json -w "%{http_code}" \
  -X POST "https://api.resend.com/emails" \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
  \"from\": \"Marcus Chen <marcus@mail.deals.frontstep.ai>\",
  \"to\": [\"$TO\"],
  \"subject\": \"The Meridian at Buckhead — 142-Unit Multifamily | Atlanta, GA | \$28.5M\",
  \"html\": \"<html><body><p>Hi there,</p><p>Hope you are doing well. Pleased to present <b>The Meridian at Buckhead</b>, a 142-unit Class B+ multifamily asset in the heart of Buckhead, Atlanta, GA.</p><h3>Investment Highlights</h3><ul><li><b>Address:</b> 3450 Peachtree Rd NE, Atlanta, GA 30326</li><li><b>Units:</b> 142 (mix of 1BR/2BR)</li><li><b>Year Built:</b> 2004, renovated 2021</li><li><b>Asking Price:</b> \$28,500,000</li><li><b>Price/Unit:</b> ~\$200,704</li><li><b>Cap Rate:</b> 5.8% (in-place)</li><li><b>NOI:</b> \$1,653,000</li><li><b>Occupancy:</b> 94%</li><li><b>Avg Rent:</b> \$1,475/unit</li></ul><p>The property benefits from strong Buckhead submarket fundamentals with limited new supply in the immediate trade area. Significant value-add potential through interior renovations on remaining classic units (~40 units unrenovated) and operational improvements.</p><p><b>Debt Assumption Available:</b> Existing Freddie Mac loan at 4.2% fixed through 2028, ~\$18.5M balance.</p><h3>Documents</h3><p>Full OM and financial package attached. Additional materials available in the deal room:</p><p><a href=\\\"https://junipersquare.com/deal-room/meridian-buckhead-2026\\\">Access Deal Room</a></p><p><a href=\\\"https://app.docusign.com/sign/ca-meridian-buckhead\\\">Sign Confidentiality Agreement</a></p><p>Please let me know if you would like to schedule a call or property tour. First-round bids due March 14th.</p><p>Best regards,<br/>Marcus Chen<br/>Senior Director, Investment Sales<br/>Eastdil Secured<br/>(404) 555-0187<br/>marcus.chen@eastdil.com</p></body></html>\"
}")

RESPONSE=$(cat /tmp/resend-response.json)

if [ "$HTTP_CODE" = "200" ]; then
  EMAIL_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "unknown")
  echo "Sent! Email ID: $EMAIL_ID"
  echo "Check $TO inbox for the deal email, then watch for the screening reply."
else
  echo "Failed (HTTP $HTTP_CODE): $RESPONSE"
  exit 1
fi
