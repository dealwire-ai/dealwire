#!/usr/bin/env bash
#
# Send a test deal email to trigger the screening pipeline.
# The email is sent via Resend to a monitored Outlook inbox,
# which fires the Microsoft Graph webhook and runs the full flow.
#
# Usage:
#   ./scripts/send-test-email.sh <to-email>            # single multifamily deal
#   ./scripts/send-test-email.sh <to-email> --burst     # 10 deals across asset types, 1s apart
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

TO="${1:?Usage: send-test-email.sh <to-email> [--burst]}"
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

# ── Email 1: Multifamily (original) ──────────────────────────────────────────

EMAIL_1_FROM="Marcus Chen"
EMAIL_1_ADDR="marcus@mail.deals.frontstep.ai"
EMAIL_1_SUBJECT="The Meridian at Buckhead — 142-Unit Multifamily | Atlanta, GA | \$28.5M"
EMAIL_1_HTML="<html><body><p>Hi there,</p><p>Hope you are doing well. Pleased to present <b>The Meridian at Buckhead</b>, a 142-unit Class B+ multifamily asset in the heart of Buckhead, Atlanta, GA.</p><h3>Investment Highlights</h3><ul><li><b>Address:</b> 3450 Peachtree Rd NE, Atlanta, GA 30326</li><li><b>Units:</b> 142 (mix of 1BR/2BR)</li><li><b>Year Built:</b> 2004, renovated 2021</li><li><b>Asking Price:</b> \$28,500,000</li><li><b>Price/Unit:</b> ~\$200,704</li><li><b>Cap Rate:</b> 5.8% (in-place)</li><li><b>NOI:</b> \$1,653,000</li><li><b>Occupancy:</b> 94%</li><li><b>Avg Rent:</b> \$1,475/unit</li></ul><p>The property benefits from strong Buckhead submarket fundamentals with limited new supply in the immediate trade area. Significant value-add potential through interior renovations on remaining classic units (~40 units unrenovated) and operational improvements.</p><p><b>Debt Assumption Available:</b> Existing Freddie Mac loan at 4.2% fixed through 2028, ~\$18.5M balance.</p><h3>Documents</h3><p>Full OM and financial package attached. Additional materials available in the deal room:</p><p><a href=\\\"https://junipersquare.com/deal-room/meridian-buckhead-2026\\\">Access Deal Room</a></p><p><a href=\\\"https://app.docusign.com/sign/ca-meridian-buckhead\\\">Sign Confidentiality Agreement</a></p><p>Please let me know if you would like to schedule a call or property tour. First-round bids due March 14th.</p><p>Best regards,<br/>Marcus Chen<br/>Senior Director, Investment Sales<br/>Eastdil Secured<br/>(404) 555-0187<br/>marcus.chen@eastdil.com</p></body></html>"

# ── Email 2: Office ──────────────────────────────────────────────────────────

EMAIL_2_FROM="Sarah Mitchell"
EMAIL_2_ADDR="sarah@mail.deals.frontstep.ai"
EMAIL_2_SUBJECT="One Vanderbilt Plaza — 48-Floor Class A Office | Midtown Manhattan | \$188M Note Sale"
EMAIL_2_HTML="<html><body><p>Good morning,</p><p>We are pleased to exclusively offer <b>One Vanderbilt Plaza</b>, a 48-story, 1.2M SF Class A office tower in the Grand Central submarket.</p><h3>Investment Highlights</h3><ul><li><b>Address:</b> 1 Vanderbilt Ave, New York, NY 10017</li><li><b>SF:</b> 1,200,000</li><li><b>Year Built:</b> 2020</li><li><b>Asking Price:</b> \$188,000,000 (note sale)</li><li><b>Price/SF:</b> ~\$157</li><li><b>In-Place NOI:</b> \$12,400,000</li><li><b>Occupancy:</b> 72%</li><li><b>Major Tenants:</b> TD Securities (18 floors), Carlyle Group (6 floors)</li></ul><p>Significant lease-up opportunity with 336,000 SF of vacancy in a trophy asset. LEED Platinum certified with best-in-class amenities.</p><p>Best regards,<br/>Sarah Mitchell<br/>Managing Director<br/>JLL Capital Markets<br/>(212) 555-0291<br/>sarah.mitchell@jll.com</p></body></html>"

# ── Email 3: Industrial/Warehouse ────────────────────────────────────────────

EMAIL_3_FROM="David Park"
EMAIL_3_ADDR="david@mail.deals.frontstep.ai"
EMAIL_3_SUBJECT="Inland Empire Logistics Hub — 540K SF Industrial | Ontario, CA | \$72M"
EMAIL_3_HTML="<html><body><p>Hi,</p><p>Pleased to present <b>Inland Empire Logistics Hub</b>, a 540,000 SF Class A industrial distribution facility in Ontario, CA.</p><h3>Investment Highlights</h3><ul><li><b>Address:</b> 2800 E Jurupa Ave, Ontario, CA 91761</li><li><b>SF:</b> 540,000</li><li><b>Clear Height:</b> 36 ft</li><li><b>Year Built:</b> 2019</li><li><b>Asking Price:</b> \$72,000,000</li><li><b>Price/SF:</b> ~\$133</li><li><b>Cap Rate:</b> 4.9%</li><li><b>NOI:</b> \$3,528,000</li><li><b>Tenant:</b> Amazon (NNN lease through 2031)</li></ul><p>Cross-dock configuration, 120 dock-high doors, 185 ft truck court. Located 0.5 miles from I-10/I-15 interchange. Below-market rent with 3% annual escalators.</p><p>Best,<br/>David Park<br/>Vice President, Industrial<br/>CBRE<br/>(909) 555-0443<br/>david.park@cbre.com</p></body></html>"

# ── Email 4: Retail / Shopping Center ────────────────────────────────────────

EMAIL_4_FROM="Jennifer Walsh"
EMAIL_4_ADDR="jennifer@mail.deals.frontstep.ai"
EMAIL_4_SUBJECT="Galleria Commons — 185K SF Grocery-Anchored Retail | Scottsdale, AZ | \$34M"
EMAIL_4_HTML="<html><body><p>Good afternoon,</p><p>We are marketing <b>Galleria Commons</b>, a 185,000 SF grocery-anchored shopping center in North Scottsdale.</p><h3>Investment Highlights</h3><ul><li><b>Address:</b> 15205 N Kierland Blvd, Scottsdale, AZ 85254</li><li><b>SF:</b> 185,000</li><li><b>Year Built:</b> 2007</li><li><b>Asking Price:</b> \$34,000,000</li><li><b>Price/SF:</b> ~\$184</li><li><b>Cap Rate:</b> 6.5%</li><li><b>NOI:</b> \$2,210,000</li><li><b>Occupancy:</b> 96%</li><li><b>Anchor:</b> Whole Foods (20-year lease, 12 years remaining)</li></ul><p>Shadow-anchored by Target and REI. Avg HHI \$145K in 3-mile radius. Well-below replacement cost.</p><p>Regards,<br/>Jennifer Walsh<br/>Senior Associate<br/>Marcus &amp; Millichap<br/>(480) 555-0128<br/>jennifer.walsh@marcusmillichap.com</p></body></html>"

# ── Email 5: Hotel / Hospitality ─────────────────────────────────────────────

EMAIL_5_FROM="Roberto Vega"
EMAIL_5_ADDR="roberto@mail.deals.frontstep.ai"
EMAIL_5_SUBJECT="The Langham Residences — 220-Key Luxury Hotel | Miami Beach, FL | \$115M"
EMAIL_5_HTML="<html><body><p>Hello,</p><p>Exclusively presenting <b>The Langham Residences</b>, a 220-key luxury boutique hotel on Collins Avenue, Miami Beach.</p><h3>Investment Highlights</h3><ul><li><b>Address:</b> 4525 Collins Ave, Miami Beach, FL 33140</li><li><b>Keys:</b> 220</li><li><b>Year Built:</b> 2016</li><li><b>Asking Price:</b> \$115,000,000</li><li><b>Price/Key:</b> ~\$522,727</li><li><b>RevPAR:</b> \$285</li><li><b>ADR:</b> \$425</li><li><b>Occupancy:</b> 78%</li><li><b>2025 NOI:</b> \$8,900,000</li></ul><p>Oceanfront property with 15,000 SF of meeting space, rooftop pool, and full-service spa. Unbranded — potential for flag affiliation upside. F&amp;B generates 35% of total revenue.</p><p>Best regards,<br/>Roberto Vega<br/>Director, Hospitality<br/>Hodges Ward Elliott<br/>(305) 555-0667<br/>roberto.vega@hfrg.com</p></body></html>"

# ── Email 6: Self-Storage ────────────────────────────────────────────────────

EMAIL_6_FROM="Amanda Torres"
EMAIL_6_ADDR="amanda@mail.deals.frontstep.ai"
EMAIL_6_SUBJECT="SecureSpace Portfolio — 3-Property Self-Storage | DFW Metroplex | \$19.5M"
EMAIL_6_HTML="<html><body><p>Hi there,</p><p>Pleased to offer the <b>SecureSpace Portfolio</b>, a 3-property, 1,850-unit self-storage portfolio across the Dallas-Fort Worth metroplex.</p><h3>Investment Highlights</h3><ul><li><b>Locations:</b> Frisco, Plano, and McKinney, TX</li><li><b>Total Units:</b> 1,850 (145,000 net rentable SF)</li><li><b>Year Built:</b> 2017-2020</li><li><b>Asking Price:</b> \$19,500,000</li><li><b>Price/SF:</b> ~\$134</li><li><b>Cap Rate:</b> 6.2%</li><li><b>NOI:</b> \$1,209,000</li><li><b>Occupancy:</b> 91% (physical)</li><li><b>Climate Controlled:</b> 65% of units</li></ul><p>All three facilities are located in high-growth suburban corridors with population growth exceeding 5% annually. Below market rents with 8-12% mark-to-market opportunity.</p><p>Thanks,<br/>Amanda Torres<br/>Associate<br/>Cushman &amp; Wakefield<br/>(214) 555-0339<br/>amanda.torres@cushwake.com</p></body></html>"

# ── Email 7: Medical Office ──────────────────────────────────────────────────

EMAIL_7_FROM="Brian Kessler"
EMAIL_7_ADDR="brian@mail.deals.frontstep.ai"
EMAIL_7_SUBJECT="MedPark Tower — 95K SF Medical Office | Nashville, TN | \$26M"
EMAIL_7_HTML="<html><body><p>Good morning,</p><p>Presenting <b>MedPark Tower</b>, a 95,000 SF Class A medical office building adjacent to Vanderbilt University Medical Center.</p><h3>Investment Highlights</h3><ul><li><b>Address:</b> 2100 Patterson St, Nashville, TN 37203</li><li><b>SF:</b> 95,000</li><li><b>Year Built:</b> 2012</li><li><b>Asking Price:</b> \$26,000,000</li><li><b>Price/SF:</b> ~\$274</li><li><b>Cap Rate:</b> 6.8%</li><li><b>NOI:</b> \$1,768,000</li><li><b>Occupancy:</b> 98%</li><li><b>WALT:</b> 7.2 years</li></ul><p>100% medical tenancy with investment-grade credit tenants including HCA Healthcare (42% of NRA) and Tennessee Oncology (28% of NRA). Built-to-suit surgical suites on floors 3-5.</p><p>Kind regards,<br/>Brian Kessler<br/>Senior Vice President<br/>Newmark<br/>(615) 555-0812<br/>brian.kessler@nmrk.com</p></body></html>"

# ── Email 8: Student Housing ────────────────────────────────────────────────

EMAIL_8_FROM="Lauren Chen"
EMAIL_8_ADDR="lauren@mail.deals.frontstep.ai"
EMAIL_8_SUBJECT="The Hub at Campus Crossing — 412-Bed Student Housing | Austin, TX | \$41M"
EMAIL_8_HTML="<html><body><p>Hi,</p><p>Excited to share <b>The Hub at Campus Crossing</b>, a 412-bed purpose-built student housing community serving UT Austin.</p><h3>Investment Highlights</h3><ul><li><b>Address:</b> 2600 Rio Grande St, Austin, TX 78705</li><li><b>Beds:</b> 412 (114 units, avg 3.6 beds/unit)</li><li><b>Year Built:</b> 2015</li><li><b>Asking Price:</b> \$41,000,000</li><li><b>Price/Bed:</b> ~\$99,515</li><li><b>Cap Rate:</b> 5.1%</li><li><b>NOI:</b> \$2,091,000</li><li><b>Occupancy:</b> 97% (pre-leased for Fall 2026)</li><li><b>Avg Rent/Bed:</b> \$1,050/month</li></ul><p>Located 0.3 miles from UT campus. Amenity package includes resort-style pool, fitness center, study lounges, and garage parking. Consistently pre-leased by February each year.</p><p>Cheers,<br/>Lauren Chen<br/>Director, Student Housing<br/>Colliers<br/>(512) 555-0194<br/>lauren.chen@colliers.com</p></body></html>"

# ── Email 9: Mixed-Use / Development Site ────────────────────────────────────

EMAIL_9_FROM="Michael Okonkwo"
EMAIL_9_ADDR="michael@mail.deals.frontstep.ai"
EMAIL_9_SUBJECT="Waterfront Block 7 — 2.4-Acre Mixed-Use Dev Site | Brooklyn, NY | \$55M"
EMAIL_9_HTML="<html><body><p>Hello,</p><p>Presenting <b>Waterfront Block 7</b>, a 2.4-acre fully entitled mixed-use development site on the Williamsburg waterfront.</p><h3>Investment Highlights</h3><ul><li><b>Address:</b> 7 Kent Ave, Brooklyn, NY 11249</li><li><b>Lot Size:</b> 2.4 acres (104,544 SF)</li><li><b>Zoning:</b> R8A / C2-4 (MIH)</li><li><b>Max Buildable:</b> 680,000 ZFA</li><li><b>Asking Price:</b> \$55,000,000</li><li><b>Price/BSF:</b> ~\$81</li><li><b>Approvals:</b> ULURP complete, DOB permits in progress</li><li><b>Proposed Program:</b> 520 residential units + 45K SF retail + 15K SF community facility</li></ul><p>Waterfront zoning allows 25-story towers. 421-a tax abatement eligible. Adjacent to Domino Park and East River ferry terminal. Seller will consider JV structure.</p><p>Regards,<br/>Michael Okonkwo<br/>Managing Director, Land &amp; Development<br/>Avison Young<br/>(718) 555-0456<br/>michael.okonkwo@avisonyoung.com</p></body></html>"

# ── Email 10: NNN Single-Tenant ──────────────────────────────────────────────

EMAIL_10_FROM="Karen Blackwell"
EMAIL_10_ADDR="karen@mail.deals.frontstep.ai"
EMAIL_10_SUBJECT="Walgreens NNN — Single-Tenant Absolute Net | Portland, OR | \$5.8M"
EMAIL_10_HTML="<html><body><p>Good afternoon,</p><p>Offering a <b>Walgreens NNN</b> absolute net lease investment in the Pearl District, Portland.</p><h3>Investment Highlights</h3><ul><li><b>Address:</b> 940 NW 14th Ave, Portland, OR 97209</li><li><b>SF:</b> 14,500</li><li><b>Year Built:</b> 2005</li><li><b>Asking Price:</b> \$5,800,000</li><li><b>Cap Rate:</b> 5.5%</li><li><b>NOI:</b> \$319,000</li><li><b>Lease Type:</b> Absolute NNN</li><li><b>Lease Term:</b> 15 years remaining (2041 expiration)</li><li><b>Rent Increases:</b> 10% every 5 years</li><li><b>Tenant Credit:</b> Walgreens Boots Alliance (S&amp;P: BBB)</li></ul><p>Zero landlord responsibilities. Corporately guaranteed lease. Located on a signalized corner with 32,000 VPD. Ideal 1031 exchange candidate.</p><p>Best,<br/>Karen Blackwell<br/>Associate Broker<br/>Stan Johnson Company<br/>(503) 555-0721<br/>karen.blackwell@stanjohnson.com</p></body></html>"

# ── Send logic ───────────────────────────────────────────────────────────────

echo "Sending test deal email(s) to $TO..."

send_email "$EMAIL_1_FROM" "$EMAIL_1_ADDR" "$EMAIL_1_SUBJECT" "$EMAIL_1_HTML"

if [ "$BURST" = "--burst" ]; then
  for i in 2 3 4 5 6 7 8 9 10; do
    sleep 1
    from_var="EMAIL_${i}_FROM"
    addr_var="EMAIL_${i}_ADDR"
    subj_var="EMAIL_${i}_SUBJECT"
    html_var="EMAIL_${i}_HTML"
    send_email "${!from_var}" "${!addr_var}" "${!subj_var}" "${!html_var}"
  done
  echo ""
  echo "Done — sent 10 deals across: multifamily, office, industrial, retail, hotel, self-storage, medical office, student housing, mixed-use dev site, NNN net lease."
else
  echo "Check $TO inbox for the deal email, then watch for the screening reply."
  echo "(Use --burst to send 10 diverse deals 1s apart)"
fi
