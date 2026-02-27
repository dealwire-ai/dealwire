#!/usr/bin/env bash
#
# Send a hardcoded demo deal digest email via Resend.
# Looks identical to a real digest — use this during demos after running --burst
# to show the full agentic loop: deals in → screened → digest out.
#
# Usage:
#   ./scripts/send-test-digest.sh <to-email>
#
# Requires: RESEND_API_KEY in .env (or exported)

set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  export $(grep -E '^RESEND_API_KEY=' .env | xargs)
fi

if [ -z "${RESEND_API_KEY:-}" ]; then
  echo "Error: RESEND_API_KEY not set."
  exit 1
fi

TO="${1:?Usage: send-test-digest.sh <to-email>}"

BRAND_COLOR="#2A4A7C"
GREEN_ACCENT="#16a34a"
GREEN_PILL_BG="#dcfce7"
GREEN_PILL_TEXT="#166534"
GREEN_REASON="#15803d"
RED_ACCENT="#dc2626"
RED_PILL_BG="#fee2e2"
RED_PILL_TEXT="#991b1b"
RED_REASON="#b91c1c"

HTML=$(cat <<ENDOFHTML
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f1f5f9; }</style>
</head>
<body>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;">
  <tr><td>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:800px;margin:0 auto;">

    <!-- Header -->
    <tr><td style="padding:28px 32px;text-align:center;background-color:${BRAND_COLOR};">
      <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Lambert Capital</span>
    </td></tr>

    <!-- Body -->
    <tr><td style="background-color:#ffffff;padding:36px 36px 24px 36px;">

      <h1 style="margin:0 0 8px 0;font-size:28px;font-weight:700;color:#111827;letter-spacing:-0.5px;">Deal Digest</h1>
      <p style="margin:0 0 32px 0;font-size:16px;color:#4b5563;line-height:1.6;">5 deals screened since the last digest</p>

      <!-- Summary bar -->
      <div style="background-color:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px 20px;margin:0 0 28px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
          <tr>
            <td style="font-size:14px;font-weight:500;color:#4b5563;padding-right:20px;"><span style="font-weight:700;color:#111827;">5</span> screened</td>
            <td style="font-size:14px;font-weight:500;color:#4b5563;padding-right:20px;"><span style="font-weight:700;color:#16a34a;">2</span> approved</td>
            <td style="font-size:14px;font-weight:500;color:#4b5563;padding-right:20px;"><span style="font-weight:700;color:#111827;">40%</span> pass rate</td>
            <td style="font-size:14px;font-weight:500;color:#4b5563;"><span style="font-weight:700;color:#111827;">5</span> brokers</td>
          </tr>
        </table>
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid #e5e7eb;">
          <span style="font-size:13px;color:#6b7280;">Top markets:</span>
          <span style="font-size:13px;color:#1f2937;margin-left:6px;">Scottsdale, AZ <span style="color:#6b7280;">(1)</span></span> &middot;
          <span style="font-size:13px;color:#1f2937;margin-left:6px;">Nashville, TN <span style="color:#6b7280;">(1)</span></span> &middot;
          <span style="font-size:13px;color:#1f2937;margin-left:6px;">New York, NY <span style="color:#6b7280;">(1)</span></span>
        </div>
      </div>

      <!-- YES deals -->
      <h2 style="margin:32px 0 20px 0;font-size:20px;font-weight:700;color:#111827;letter-spacing:-0.3px;">Approved Deals <span style="color:#6b7280;font-weight:500;font-size:16px;">(2)</span></h2>

      <!-- YES 1: Galleria Commons -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px 0;border-collapse:collapse;">
        <tr>
          <td style="width:4px;background-color:${GREEN_ACCENT};border-radius:8px 0 0 8px;"></td>
          <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-left:none;border-radius:0 8px 8px 0;padding:20px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
              <tr>
                <td style="font-size:17px;font-weight:700;color:#111827;padding-bottom:12px;">Galleria Commons — 185K SF Grocery-Anchored Retail | Scottsdale, AZ | \$34M</td>
                <td style="text-align:right;vertical-align:top;padding-bottom:12px;"><span style="background-color:${GREEN_PILL_BG};color:${GREEN_PILL_TEXT};padding:4px 14px;border-radius:12px;font-size:12px;font-weight:700;letter-spacing:0.5px;">YES</span></td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px;">
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;width:70px;">From</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">jennifer@mail.deals.frontstep.ai</td>
              </tr>
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Broker</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">Jennifer Walsh <span style="color:#6b7280;font-size:13px;">(3 deals total &middot; 33% pass rate)</span></td>
              </tr>
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Location</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">15205 N Kierland Blvd, Scottsdale, AZ</td>
              </tr>
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Screened</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">Feb 27, 2026, 9:06 AM</td>
              </tr>
            </table>
            <div style="border-top:1px solid #f3f4f6;padding-top:14px;">
              <p style="margin:0;font-size:15px;font-weight:500;color:${GREEN_REASON};line-height:1.5;">Whole Foods-anchored retail in prime North Scottsdale corridor. 6.5% in-place cap rate, 96% occupancy, 20-year anchor lease with 12 years remaining. Meets Sun Belt commercial income criteria.</p>
              <div style="border-top:1px solid #f3f4f6;padding-top:10px;margin-top:10px;">
                <a href="https://outlook.office.com/mail/inbox/id/AAMkZmVhNjM4LTZmYWItNDdkNi05NzllLTY4NjZjY2Y5YTk2" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">View Email</a><span style="color:#d1d5db;margin:0 6px;font-size:13px;">|</span><a href="https://junipersquare.com/deal-room/galleria-commons-2026" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">Deal Room</a><span style="color:#d1d5db;margin:0 6px;font-size:13px;">|</span><a href="https://app.docusign.com/sign/ca-galleria-commons-2026" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">Sign CA</a>
              </div>
            </div>
          </td>
        </tr>
      </table>

      <!-- YES 2: MedPark Tower -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px 0;border-collapse:collapse;">
        <tr>
          <td style="width:4px;background-color:${GREEN_ACCENT};border-radius:8px 0 0 8px;"></td>
          <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-left:none;border-radius:0 8px 8px 0;padding:20px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
              <tr>
                <td style="font-size:17px;font-weight:700;color:#111827;padding-bottom:12px;">MedPark Tower — 95K SF Medical Office | Nashville, TN | \$26M</td>
                <td style="text-align:right;vertical-align:top;padding-bottom:12px;"><span style="background-color:${GREEN_PILL_BG};color:${GREEN_PILL_TEXT};padding:4px 14px;border-radius:12px;font-size:12px;font-weight:700;letter-spacing:0.5px;">YES</span></td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px;">
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;width:70px;">From</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">brian@mail.deals.frontstep.ai</td>
              </tr>
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Broker</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">Brian Kessler <span style="color:#6b7280;font-size:13px;">(1 deal total &middot; 100% pass rate)</span></td>
              </tr>
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Location</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">2100 Patterson St, Nashville, TN</td>
              </tr>
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Screened</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">Feb 27, 2026, 9:07 AM</td>
              </tr>
            </table>
            <div style="border-top:1px solid #f3f4f6;padding-top:14px;">
              <p style="margin:0;font-size:15px;font-weight:500;color:${GREEN_REASON};line-height:1.5;">Class A medical office adjacent to Vanderbilt Medical Center. 6.8% cap rate, 98% occupied, 7.2-year WALT. HCA Healthcare and Tennessee Oncology as anchor tenants — investment-grade credit, NNN-like structure.</p>
              <div style="border-top:1px solid #f3f4f6;padding-top:10px;margin-top:10px;">
                <a href="https://outlook.office.com/mail/inbox/id/AAMkZmVhNjM4LTZmYWItNDdkNi05NzllLTY4NjZjY2Y5YTk3" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">View Email</a><span style="color:#d1d5db;margin:0 6px;font-size:13px;">|</span><a href="https://app.docusign.com/sign/ca-medpark-tower-2026" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">Sign CA</a>
              </div>
            </div>
          </td>
        </tr>
      </table>

      <!-- NO deals -->
      <h2 style="margin:32px 0 20px 0;font-size:20px;font-weight:700;color:#111827;letter-spacing:-0.3px;">Passed Deals <span style="color:#6b7280;font-weight:500;font-size:16px;">(3)</span></h2>

      <!-- NO 1 -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px 0;border-collapse:collapse;">
        <tr>
          <td style="width:4px;background-color:${RED_ACCENT};border-radius:8px 0 0 8px;"></td>
          <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-left:none;border-radius:0 8px 8px 0;padding:20px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
              <tr>
                <td style="font-size:17px;font-weight:700;color:#111827;padding-bottom:12px;">One Vanderbilt Plaza — 48-Floor Class A Office | Midtown Manhattan | \$188M Note Sale</td>
                <td style="text-align:right;vertical-align:top;padding-bottom:12px;"><span style="background-color:${RED_PILL_BG};color:${RED_PILL_TEXT};padding:4px 14px;border-radius:12px;font-size:12px;font-weight:700;letter-spacing:0.5px;">NO</span></td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px;">
              <tr><td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;width:70px;">From</td><td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">sarah@mail.deals.frontstep.ai</td></tr>
              <tr><td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Location</td><td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">1 Vanderbilt Ave, New York, NY</td></tr>
              <tr><td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Screened</td><td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">Feb 27, 2026, 9:06 AM</td></tr>
            </table>
            <div style="border-top:1px solid #f3f4f6;padding-top:14px;"><p style="margin:0;font-size:15px;font-weight:500;color:${RED_REASON};line-height:1.5;">Office sector outside criteria. \$188M exceeds \$50M deal size limit. Northeast market, not Sun Belt. Pass.</p><div style="border-top:1px solid #f3f4f6;padding-top:10px;margin-top:10px;"><a href="https://outlook.office.com/mail/inbox/id/AAMkZmVhNjM4LTZmYWItNDdkNi05NzllLTY4NjZjY2Y5YTk4" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">View Email</a></div></div>
          </td>
        </tr>
      </table>

      <!-- NO 2 -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px 0;border-collapse:collapse;">
        <tr>
          <td style="width:4px;background-color:${RED_ACCENT};border-radius:8px 0 0 8px;"></td>
          <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-left:none;border-radius:0 8px 8px 0;padding:20px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
              <tr>
                <td style="font-size:17px;font-weight:700;color:#111827;padding-bottom:12px;">The Langham Residences — 220-Key Luxury Hotel | Miami Beach, FL | \$115M</td>
                <td style="text-align:right;vertical-align:top;padding-bottom:12px;"><span style="background-color:${RED_PILL_BG};color:${RED_PILL_TEXT};padding:4px 14px;border-radius:12px;font-size:12px;font-weight:700;letter-spacing:0.5px;">NO</span></td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px;">
              <tr><td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;width:70px;">From</td><td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">roberto@mail.deals.frontstep.ai</td></tr>
              <tr><td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Location</td><td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">4525 Collins Ave, Miami Beach, FL</td></tr>
            </table>
            <div style="border-top:1px solid #f3f4f6;padding-top:14px;"><p style="margin:0;font-size:15px;font-weight:500;color:${RED_REASON};line-height:1.5;">Hospitality outside target asset class. \$115M exceeds deal size limit. Operational hotel requires active management. Pass.</p><div style="border-top:1px solid #f3f4f6;padding-top:10px;margin-top:10px;"><a href="https://outlook.office.com/mail/inbox/id/AAMkZmVhNjM4LTZmYWItNDdkNi05NzllLTY4NjZjY2Y5YTk5" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">View Email</a></div></div>
          </td>
        </tr>
      </table>

      <!-- NO 3 -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px 0;border-collapse:collapse;">
        <tr>
          <td style="width:4px;background-color:${RED_ACCENT};border-radius:8px 0 0 8px;"></td>
          <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-left:none;border-radius:0 8px 8px 0;padding:20px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
              <tr>
                <td style="font-size:17px;font-weight:700;color:#111827;padding-bottom:12px;">Waterfront Block 7 — 2.4-Acre Mixed-Use Dev Site | Brooklyn, NY | \$55M</td>
                <td style="text-align:right;vertical-align:top;padding-bottom:12px;"><span style="background-color:${RED_PILL_BG};color:${RED_PILL_TEXT};padding:4px 14px;border-radius:12px;font-size:12px;font-weight:700;letter-spacing:0.5px;">NO</span></td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px;">
              <tr><td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;width:70px;">From</td><td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">michael@mail.deals.frontstep.ai</td></tr>
              <tr><td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Location</td><td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">7 Kent Ave, Brooklyn, NY</td></tr>
            </table>
            <div style="border-top:1px solid #f3f4f6;padding-top:14px;"><p style="margin:0;font-size:15px;font-weight:500;color:${RED_REASON};line-height:1.5;">Development site — no in-place income. Northeast market, not Sun Belt. \$55M exceeds deal size limit. Pass.</p><div style="border-top:1px solid #f3f4f6;padding-top:10px;margin-top:10px;"><a href="https://outlook.office.com/mail/inbox/id/AAMkZmVhNjM4LTZmYWItNDdkNi05NzllLTY4NjZjY2Y5YTEwMA" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">View Email</a></div></div>
          </td>
        </tr>
      </table>

      <!-- Top Brokers -->
      <div style="margin:0 0 32px 0;">
        <h2 style="margin:0 0 16px 0;font-size:20px;font-weight:700;color:#111827;letter-spacing:-0.3px;">Top Brokers <span style="color:#6b7280;font-weight:500;font-size:16px;">Last 30 Days</span></h2>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:14px;border:1px solid #e5e7eb;border-radius:8px;border-collapse:separate;overflow:hidden;">
          <tr>
            <td style="padding:10px 16px;font-weight:700;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;">Broker</td>
            <td style="padding:10px 16px;font-weight:700;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;text-align:center;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;">Deals</td>
            <td style="padding:10px 16px;font-weight:700;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;text-align:center;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;">Approved</td>
            <td style="padding:10px 16px;font-weight:700;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;text-align:center;background-color:#f9fafb;border-bottom:1px solid #e5e7eb;">Pass Rate</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#111827;font-weight:600;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">Jennifer Walsh</td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">1</td>
            <td style="padding:10px 16px;color:#16a34a;font-weight:600;text-align:center;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">1</td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">100%</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#111827;font-weight:600;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">Brian Kessler</td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">1</td>
            <td style="padding:10px 16px;color:#16a34a;font-weight:600;text-align:center;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">1</td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">100%</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#111827;font-weight:600;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">Sarah Mitchell</td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">1</td>
            <td style="padding:10px 16px;color:#dc2626;font-weight:600;text-align:center;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">0</td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">0%</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#111827;font-weight:600;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">Roberto Vega</td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">1</td>
            <td style="padding:10px 16px;color:#dc2626;font-weight:600;text-align:center;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">0</td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">0%</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#111827;font-weight:600;background-color:#ffffff;">Michael Okonkwo</td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#ffffff;">1</td>
            <td style="padding:10px 16px;color:#dc2626;font-weight:600;text-align:center;background-color:#ffffff;">0</td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#ffffff;">0%</td>
          </tr>
        </table>
      </div>

    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:24px 36px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;font-size:13px;color:#6b7280;">Lambert Capital</p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>
ENDOFHTML
)

echo "Sending demo deal digest to $TO..."

HTTP_CODE=$(curl -s -o /tmp/resend-digest-response.json -w "%{http_code}" \
  -X POST "https://api.resend.com/emails" \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
  \"from\": \"Lambert Capital <noreply@mail.deals.frontstep.ai>\",
  \"to\": [\"$TO\"],
  \"subject\": \"Deal Digest: 5 Deals Screened (2 Yes, 3 No)\",
  \"html\": $(echo "$HTML" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')
}")

if [ "$HTTP_CODE" = "200" ]; then
  EMAIL_ID=$(cat /tmp/resend-digest-response.json | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "unknown")
  echo "  ✓ Sent digest ($EMAIL_ID) → $TO"
else
  echo "  ✗ Failed (HTTP $HTTP_CODE)"
  cat /tmp/resend-digest-response.json
  exit 1
fi
