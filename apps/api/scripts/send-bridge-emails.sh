#!/usr/bin/env bash
#
# Send BRIDGE Housing demo deal emails to trigger the screening pipeline.
# 7 deals tailored to BRIDGE's buy box: 3 YES (West Coast multifamily NOAH),
# 4 NO (wrong geography, wrong asset type, rent control, low AMI).
#
# Usage:
#   ./scripts/send-bridge-emails.sh <to-email>            # single YES deal (Kirkland Crossing)
#   ./scripts/send-bridge-emails.sh <to-email> --burst     # all 7 deals, 1s apart
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

TO="${1:?Usage: send-bridge-emails.sh <to-email> [--burst]}"
BURST="${2:-}"

send_email() {
  local from_name="$1" from_addr="$2" subject="$3" html="$4"

  HTTP_CODE=$(curl -s -o /tmp/resend-response.json -w "%{http_code}" \
    -X POST "https://api.resend.com/emails" \
    -H "Authorization: Bearer $RESEND_API_KEY" \
    -H "Content-Type: application/json" \
    -d "{
    \"from\": \"${from_name} <${from_addr}>\",
    \"to\": [\"$TO\"],
    \"subject\": \"${subject}\",
    \"html\": \"${html}\"
  }")

  RESPONSE=$(cat /tmp/resend-response.json)

  if [ "$HTTP_CODE" = "200" ]; then
    EMAIL_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "unknown")
    echo "  ✓ Sent ($EMAIL_ID): $subject"
  else
    echo "  ✗ Failed (HTTP $HTTP_CODE): $subject"
    echo "    $RESPONSE"
  fi
}

# ── YES 1: Kirkland Crossing — 156-unit multifamily, Kirkland, WA ────────────

EMAIL_1_FROM="Tyler Hendricks"
EMAIL_1_ADDR="tyler@mail.dealwire.ai"
EMAIL_1_SUBJECT="Kirkland Crossing — 156-Unit Workforce Multifamily | Kirkland, WA | \$38.2M"
EMAIL_1_HTML="<html><body><p>Good morning,</p><p>Pleased to present <b>Kirkland Crossing</b>, a 156-unit workforce multifamily community in Kirkland, WA — one of the strongest suburban markets on the Eastside.</p><h3>Investment Highlights</h3><ul><li><b>Address:</b> 11820 NE 128th St, Kirkland, WA 98034</li><li><b>Units:</b> 156 (1BR/2BR/3BR mix)</li><li><b>Year Built:</b> 1998, renovated 2022</li><li><b>Asking Price:</b> \$38,200,000</li><li><b>Price/Unit:</b> ~\$244,872</li><li><b>Cap Rate:</b> 5.2% (in-place)</li><li><b>NOI:</b> \$1,986,400</li><li><b>Occupancy:</b> 96%</li><li><b>Avg Rent:</b> \$1,580/unit</li><li><b>AMI Context:</b> Current rents are approximately \$50 above 60% AMI for King County — NOAH property with natural affordability</li></ul><p>The property sits in the heart of Kirkland's Totem Lake submarket, with direct access to the 405 corridor and walkable proximity to Google's Kirkland campus and EvergreenHealth Medical Center. Strong household income demographics (\$112K median HHI in 1-mile radius) with limited new multifamily supply.</p><p><b>Value-Add:</b> 40% of units have original-spec interiors — interior renovation program can drive \$150-200/unit rent premiums on turns. Current ownership has completed 60% of units.</p><h3>Documents</h3><p><a href=\\\"https://junipersquare.com/deal-room/kirkland-crossing-2026\\\">Access Deal Room</a> | <a href=\\\"https://app.docusign.com/sign/ca-kirkland-crossing\\\">Sign Confidentiality Agreement</a></p><p>First-round offers due March 21st. Happy to schedule a property tour or provide additional details.</p><p>Best regards,<br/>Tyler Hendricks<br/>Senior Vice President<br/>Kidder Mathews<br/>(425) 555-0318<br/>tyler.hendricks@kidder.com</p></body></html>"

# ── YES 2: Sunnyvale Gardens — 210-unit garden-style, Sunnyvale, CA ──────────

EMAIL_2_FROM="Rachel Nguyen"
EMAIL_2_ADDR="rachel@mail.dealwire.ai"
EMAIL_2_SUBJECT="Sunnyvale Gardens — 210-Unit Garden-Style Multifamily | Sunnyvale, CA | \$62.5M"
EMAIL_2_HTML="<html><body><p>Hi there,</p><p>Excited to share <b>Sunnyvale Gardens</b>, a 210-unit garden-style multifamily community in the heart of Silicon Valley with a compelling LIHTC preservation story.</p><h3>Investment Highlights</h3><ul><li><b>Address:</b> 750 S Wolfe Rd, Sunnyvale, CA 94086</li><li><b>Units:</b> 210 (studio/1BR/2BR/3BR mix)</li><li><b>Year Built:</b> 1985, partial renovation 2019</li><li><b>Asking Price:</b> \$62,500,000</li><li><b>Price/Unit:</b> ~\$297,619</li><li><b>Cap Rate:</b> 4.8% (in-place)</li><li><b>NOI:</b> \$3,000,000</li><li><b>Occupancy:</b> 98%</li><li><b>Avg Rent:</b> \$2,180/unit</li><li><b>AMI Context:</b> Rents at approximately 78% of AMI for Santa Clara County — naturally affordable without deed restrictions</li><li><b>LIHTC:</b> Existing LIHTC allocation expiring 2029 — preservation acquisition candidate</li></ul><p>Located in Sunnyvale's high-opportunity corridor between Apple and Google campuses. The property benefits from exceptional transit access (Caltrain and VTA light rail within 0.5 miles) and is surrounded by \$3,500+/month Class A product, creating a natural affordability buffer.</p><p><b>Preservation Opportunity:</b> Current LIHTC compliance period ends 2029. Property is eligible for 4% LIHTC resyndication with new allocation. Seller will cooperate with buyer's tax credit application timeline.</p><h3>Documents</h3><p><a href=\\\"https://junipersquare.com/deal-room/sunnyvale-gardens-2026\\\">Access Deal Room</a> | <a href=\\\"https://app.docusign.com/sign/ca-sunnyvale-gardens\\\">Sign Confidentiality Agreement</a></p><p>We are running a targeted process — please indicate interest by March 18th.</p><p>Best,<br/>Rachel Nguyen<br/>Executive Vice President, Affordable Housing<br/>CBRE<br/>(408) 555-0742<br/>rachel.nguyen@cbre.com</p></body></html>"

# ── YES 3: Beaverton Commons — 128-unit workforce, Beaverton, OR ─────────────

EMAIL_3_FROM="Jason Caldwell"
EMAIL_3_ADDR="jason@mail.dealwire.ai"
EMAIL_3_SUBJECT="Beaverton Commons — 128-Unit Workforce Housing | Beaverton, OR | \$28.4M"
EMAIL_3_HTML="<html><body><p>Hello,</p><p>Pleased to present <b>Beaverton Commons</b>, a 128-unit workforce housing community in Beaverton, OR — a top-performing suburban submarket in the Portland MSA.</p><h3>Investment Highlights</h3><ul><li><b>Address:</b> 4950 SW Western Ave, Beaverton, OR 97005</li><li><b>Units:</b> 128 (1BR/2BR/3BR mix)</li><li><b>Year Built:</b> 2003, renovated 2021</li><li><b>Asking Price:</b> \$28,400,000</li><li><b>Price/Unit:</b> ~\$221,875</li><li><b>Cap Rate:</b> 5.5% (in-place)</li><li><b>NOI:</b> \$1,562,000</li><li><b>Occupancy:</b> 95%</li><li><b>Avg Rent:</b> \$1,420/unit</li><li><b>AMI Context:</b> Rents approximately \$100 above 60% AMI for Washington County — strong workforce housing positioning</li></ul><p>Beaverton Commons is located adjacent to the Nike World Headquarters campus and benefits from the Beaverton Creek MAX light rail station within walking distance. Washington County has seen 4.2% population growth over the past 3 years with limited new multifamily deliveries.</p><p><b>Workforce Housing Thesis:</b> Rents are naturally affordable relative to area median income without deed restrictions. Strong demand from Nike, Intel, and Tektronix employees seeking quality housing below Class A pricing.</p><h3>Documents</h3><p><a href=\\\"https://junipersquare.com/deal-room/beaverton-commons-2026\\\">Access Deal Room</a> | <a href=\\\"https://app.docusign.com/sign/ca-beaverton-commons\\\">Sign Confidentiality Agreement</a></p><p>Offers due March 25th. Available for tours starting next week.</p><p>Best regards,<br/>Jason Caldwell<br/>Managing Director<br/>JLL<br/>(503) 555-0291<br/>jason.caldwell@jll.com</p></body></html>"

# ── NO 1: One Congress Tower — Class A office, Boston, MA ─────────────────────

EMAIL_4_FROM="Patricia Kowalski"
EMAIL_4_ADDR="patricia@mail.dealwire.ai"
EMAIL_4_SUBJECT="One Congress Tower — 32-Floor Class A Office | Boston, MA | \$145M"
EMAIL_4_HTML="<html><body><p>Good morning,</p><p>We are pleased to exclusively offer <b>One Congress Tower</b>, a 32-story, 680,000 SF Class A office tower in Boston's Financial District.</p><h3>Investment Highlights</h3><ul><li><b>Address:</b> 1 Congress St, Boston, MA 02114</li><li><b>SF:</b> 680,000</li><li><b>Year Built:</b> 2001, renovated 2023</li><li><b>Asking Price:</b> \$145,000,000</li><li><b>Price/SF:</b> ~\$213</li><li><b>Cap Rate:</b> 6.1%</li><li><b>NOI:</b> \$8,845,000</li><li><b>Occupancy:</b> 84%</li><li><b>Major Tenants:</b> Fidelity Investments (12 floors), State Street Corp (8 floors)</li></ul><p>LEED Gold certified trophy asset overlooking Boston Harbor. Recently completed \$45M capital improvement program including full lobby renovation and new amenity floor. Strong institutional tenant base with 6.8-year WALT.</p><p>Best regards,<br/>Patricia Kowalski<br/>Managing Director<br/>Eastdil Secured<br/>(617) 555-0483<br/>patricia.kowalski@eastdil.com</p></body></html>"

# ── NO 2: Mountain View Terrace — rent-control jurisdiction ───────────────────

EMAIL_5_FROM="Kevin Chang"
EMAIL_5_ADDR="kevin@mail.dealwire.ai"
EMAIL_5_SUBJECT="Mountain View Terrace — 180-Unit Multifamily | Mountain View, CA | \$58M"
EMAIL_5_HTML="<html><body><p>Hi,</p><p>Pleased to present <b>Mountain View Terrace</b>, a 180-unit multifamily community in Mountain View, CA — steps from Google's main campus.</p><h3>Investment Highlights</h3><ul><li><b>Address:</b> 1600 Villa St, Mountain View, CA 94041</li><li><b>Units:</b> 180 (1BR/2BR mix)</li><li><b>Year Built:</b> 1972, partial renovation 2020</li><li><b>Asking Price:</b> \$58,000,000</li><li><b>Price/Unit:</b> ~\$322,222</li><li><b>Cap Rate:</b> 4.3% (in-place)</li><li><b>NOI:</b> \$2,494,000</li><li><b>Occupancy:</b> 99%</li><li><b>Avg Rent:</b> \$2,350/unit</li></ul><p>Located in Mountain View's downtown core with direct access to Google shuttle routes and VTA light rail. The property benefits from the Community Stabilization and Fair Rent Act (CSFRA) — tenants are long-term and turnover is minimal, resulting in near-full occupancy.</p><p><b>Note:</b> Property is subject to Mountain View's rent stabilization ordinance (CSFRA) which limits annual rent increases to CPI (max 5%). Below-market rents on legacy tenants create upside on turnover.</p><p>Best,<br/>Kevin Chang<br/>Senior Associate<br/>Newmark<br/>(650) 555-0156<br/>kevin.chang@nmrk.com</p></body></html>"

# ── NO 3: Riverside Gardens — low AMI county + under 100 units ────────────────

EMAIL_6_FROM="Diana Morales"
EMAIL_6_ADDR="diana@mail.dealwire.ai"
EMAIL_6_SUBJECT="Riverside Gardens — 92-Unit Multifamily | Riverside, CA | \$14.8M"
EMAIL_6_HTML="<html><body><p>Good afternoon,</p><p>Presenting <b>Riverside Gardens</b>, a 92-unit multifamily property in Riverside, CA with strong cash flow and value-add potential.</p><h3>Investment Highlights</h3><ul><li><b>Address:</b> 3480 University Ave, Riverside, CA 92501</li><li><b>Units:</b> 92 (studio/1BR/2BR mix)</li><li><b>Year Built:</b> 1988</li><li><b>Asking Price:</b> \$14,800,000</li><li><b>Price/Unit:</b> ~\$160,870</li><li><b>Cap Rate:</b> 5.9%</li><li><b>NOI:</b> \$873,200</li><li><b>Occupancy:</b> 91%</li><li><b>Avg Rent:</b> \$1,150/unit</li></ul><p>Riverside County continues to see strong population growth from LA and Orange County out-migration. The property is located near UC Riverside and benefits from steady student and workforce demand. Interior renovation program can drive \$100-150/unit rent increases.</p><p>Regards,<br/>Diana Morales<br/>Associate<br/>Marcus &amp; Millichap<br/>(951) 555-0234<br/>diana.morales@marcusmillichap.com</p></body></html>"

# ── NO 4: The Driskill Hotel — luxury hotel, Austin, TX ───────────────────────

EMAIL_7_FROM="Grant Sullivan"
EMAIL_7_ADDR="grant@mail.dealwire.ai"
EMAIL_7_SUBJECT="The Driskill Hotel — 189-Key Luxury Historic Hotel | Austin, TX | \$92M"
EMAIL_7_HTML="<html><body><p>Hello,</p><p>Exclusively presenting <b>The Driskill Hotel</b>, a 189-key luxury historic hotel on Austin's iconic 6th Street — one of Texas's most storied hospitality properties.</p><h3>Investment Highlights</h3><ul><li><b>Address:</b> 604 Brazos St, Austin, TX 78701</li><li><b>Keys:</b> 189</li><li><b>Year Built:</b> 1886, restored 2018</li><li><b>Asking Price:</b> \$92,000,000</li><li><b>Price/Key:</b> ~\$486,772</li><li><b>RevPAR:</b> \$265</li><li><b>ADR:</b> \$385</li><li><b>Occupancy:</b> 82%</li><li><b>2025 NOI:</b> \$6,200,000</li></ul><p>The Driskill is a landmark property with 20,000 SF of event space, a nationally recognized restaurant, and a world-class spa. The hotel benefits from Austin's explosive growth in tech, entertainment, and convention demand. Currently operated as an independent luxury property — significant upside from potential Marriott Luxury Collection or Hilton LXR affiliation.</p><p>Best regards,<br/>Grant Sullivan<br/>Senior Director, Hospitality<br/>Hodges Ward Elliott<br/>(512) 555-0891<br/>grant.sullivan@hfrg.com</p></body></html>"

# ── Send logic ───────────────────────────────────────────────────────────────

echo "Sending BRIDGE Housing demo emails to $TO..."

if [ "$BURST" = "--burst" ]; then
  send_email "$EMAIL_1_FROM" "$EMAIL_1_ADDR" "$EMAIL_1_SUBJECT" "$EMAIL_1_HTML"
  for n in 2 3 4 5 6 7; do
    sleep 1
    from_var="EMAIL_${n}_FROM"
    addr_var="EMAIL_${n}_ADDR"
    subj_var="EMAIL_${n}_SUBJECT"
    html_var="EMAIL_${n}_HTML"
    send_email "${!from_var}" "${!addr_var}" "${!subj_var}" "${!html_var}"
  done
  echo ""
  echo "Done — sent 7 deals: 3 YES (Kirkland, Sunnyvale, Beaverton) + 4 NO (Boston office, Mt View rent control, Riverside under-size, Austin hotel)."
else
  send_email "$EMAIL_1_FROM" "$EMAIL_1_ADDR" "$EMAIL_1_SUBJECT" "$EMAIL_1_HTML"
  echo "Check $TO inbox for the deal email, then watch for the screening reply."
  echo "(Use --burst to send all 7 deals 1s apart)"
fi
