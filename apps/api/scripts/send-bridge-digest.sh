#!/usr/bin/env bash
#
# Send a hardcoded BRIDGE Housing demo deal digest email via Resend.
# Branded for BRIDGE Housing Corporation with their nonprofit blue.
# 7 deals: 3 YES (West Coast multifamily NOAH), 4 NO.
#
# Usage:
#   ./scripts/send-bridge-digest.sh <to-email>
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

TO="${1:?Usage: send-bridge-digest.sh <to-email>}"

BRAND_COLOR="#1B4D7E"
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
      <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">BRIDGE Housing Corporation</span>
    </td></tr>

    <!-- Body -->
    <tr><td style="background-color:#ffffff;padding:36px 36px 24px 36px;">

      <h1 style="margin:0 0 8px 0;font-size:28px;font-weight:700;color:#111827;letter-spacing:-0.5px;">Deal Digest</h1>
      <p style="margin:0 0 32px 0;font-size:16px;color:#4b5563;line-height:1.6;">7 deals screened since the last digest</p>

      <!-- Summary bar -->
      <div style="background-color:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:14px 20px;margin:0 0 28px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
          <tr>
            <td style="font-size:14px;font-weight:500;color:#4b5563;padding-right:20px;"><span style="font-weight:700;color:#111827;">7</span> screened</td>
            <td style="font-size:14px;font-weight:500;color:#4b5563;padding-right:20px;"><span style="font-weight:700;color:#16a34a;">3</span> approved</td>
            <td style="font-size:14px;font-weight:500;color:#4b5563;padding-right:20px;"><span style="font-weight:700;color:#111827;">43%</span> pass rate</td>
            <td style="font-size:14px;font-weight:500;color:#4b5563;"><span style="font-weight:700;color:#111827;">7</span> brokers</td>
          </tr>
        </table>
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid #e5e7eb;">
          <span style="font-size:13px;color:#6b7280;">Top markets:</span>
          <span style="font-size:13px;color:#1f2937;margin-left:6px;">Kirkland, WA <span style="color:#6b7280;">(1)</span></span> &middot;
          <span style="font-size:13px;color:#1f2937;margin-left:6px;">Sunnyvale, CA <span style="color:#6b7280;">(1)</span></span> &middot;
          <span style="font-size:13px;color:#1f2937;margin-left:6px;">Beaverton, OR <span style="color:#6b7280;">(1)</span></span>
        </div>
      </div>

      <!-- YES deals -->
      <h2 style="margin:32px 0 20px 0;font-size:20px;font-weight:700;color:#111827;letter-spacing:-0.3px;">Approved Deals <span style="color:#6b7280;font-weight:500;font-size:16px;">(3)</span></h2>

      <!-- YES 1: Kirkland Crossing -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px 0;border-collapse:collapse;">
        <tr>
          <td style="width:4px;background-color:${GREEN_ACCENT};border-radius:8px 0 0 8px;"></td>
          <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-left:none;border-radius:0 8px 8px 0;padding:20px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
              <tr>
                <td style="font-size:17px;font-weight:700;color:#111827;padding-bottom:12px;">Kirkland Crossing — 156-Unit Workforce Multifamily | Kirkland, WA | \$38.2M</td>
                <td style="text-align:right;vertical-align:top;padding-bottom:12px;"><span style="background-color:${GREEN_PILL_BG};color:${GREEN_PILL_TEXT};padding:4px 14px;border-radius:12px;font-size:12px;font-weight:700;letter-spacing:0.5px;">YES</span></td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px;">
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;width:70px;">From</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">tyler@mail.dealwire.ai</td>
              </tr>
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Broker</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">Tyler Hendricks <span style="color:#6b7280;font-size:13px;">(Kidder Mathews &middot; 1 deal &middot; 100% pass rate)</span></td>
              </tr>
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Location</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">11820 NE 128th St, Kirkland, WA</td>
              </tr>
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Screened</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">Mar 11, 2026, 10:02 AM</td>
              </tr>
            </table>
            <div style="border-top:1px solid #f3f4f6;padding-top:14px;">
              <p style="margin:0;font-size:15px;font-weight:500;color:${GREEN_REASON};line-height:1.5;">156-unit NOAH property in East Seattle submarket (Kirkland). Rents \$50 above 60% AMI for King County — naturally affordable workforce housing. 96% occupied, 5.2% cap rate. Value-add upside on 40% unrenovated units. Matches West Coast multifamily criteria.</p>
              <div style="border-top:1px solid #f3f4f6;padding-top:10px;margin-top:10px;">
                <a href="https://outlook.office.com/mail/inbox/id/AAMkBRIDGE001" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">View Email</a><span style="color:#d1d5db;margin:0 6px;font-size:13px;">|</span><a href="https://junipersquare.com/deal-room/kirkland-crossing-2026" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">Deal Room</a><span style="color:#d1d5db;margin:0 6px;font-size:13px;">|</span><a href="https://app.docusign.com/sign/ca-kirkland-crossing" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">Sign CA</a>
              </div>
            </div>
          </td>
        </tr>
      </table>

      <!-- YES 2: Sunnyvale Gardens -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px 0;border-collapse:collapse;">
        <tr>
          <td style="width:4px;background-color:${GREEN_ACCENT};border-radius:8px 0 0 8px;"></td>
          <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-left:none;border-radius:0 8px 8px 0;padding:20px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
              <tr>
                <td style="font-size:17px;font-weight:700;color:#111827;padding-bottom:12px;">Sunnyvale Gardens — 210-Unit Garden-Style Multifamily | Sunnyvale, CA | \$62.5M</td>
                <td style="text-align:right;vertical-align:top;padding-bottom:12px;"><span style="background-color:${GREEN_PILL_BG};color:${GREEN_PILL_TEXT};padding:4px 14px;border-radius:12px;font-size:12px;font-weight:700;letter-spacing:0.5px;">YES</span></td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px;">
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;width:70px;">From</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">rachel@mail.dealwire.ai</td>
              </tr>
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Broker</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">Rachel Nguyen <span style="color:#6b7280;font-size:13px;">(CBRE &middot; 1 deal &middot; 100% pass rate)</span></td>
              </tr>
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Location</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">750 S Wolfe Rd, Sunnyvale, CA</td>
              </tr>
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Screened</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">Mar 11, 2026, 10:03 AM</td>
              </tr>
            </table>
            <div style="border-top:1px solid #f3f4f6;padding-top:14px;">
              <p style="margin:0;font-size:15px;font-weight:500;color:${GREEN_REASON};line-height:1.5;">210-unit NOAH property in NorCal target market (Sunnyvale). Rents at 78% AMI for Santa Clara County. LIHTC preservation candidate — existing allocation expiring 2029, eligible for 4% resyndication. 98% occupied. Strong affordable housing mission alignment.</p>
              <div style="border-top:1px solid #f3f4f6;padding-top:10px;margin-top:10px;">
                <a href="https://outlook.office.com/mail/inbox/id/AAMkBRIDGE002" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">View Email</a><span style="color:#d1d5db;margin:0 6px;font-size:13px;">|</span><a href="https://junipersquare.com/deal-room/sunnyvale-gardens-2026" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">Deal Room</a><span style="color:#d1d5db;margin:0 6px;font-size:13px;">|</span><a href="https://app.docusign.com/sign/ca-sunnyvale-gardens" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">Sign CA</a>
              </div>
            </div>
          </td>
        </tr>
      </table>

      <!-- YES 3: Beaverton Commons -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px 0;border-collapse:collapse;">
        <tr>
          <td style="width:4px;background-color:${GREEN_ACCENT};border-radius:8px 0 0 8px;"></td>
          <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-left:none;border-radius:0 8px 8px 0;padding:20px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
              <tr>
                <td style="font-size:17px;font-weight:700;color:#111827;padding-bottom:12px;">Beaverton Commons — 128-Unit Workforce Housing | Beaverton, OR | \$28.4M</td>
                <td style="text-align:right;vertical-align:top;padding-bottom:12px;"><span style="background-color:${GREEN_PILL_BG};color:${GREEN_PILL_TEXT};padding:4px 14px;border-radius:12px;font-size:12px;font-weight:700;letter-spacing:0.5px;">YES</span></td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px;">
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;width:70px;">From</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">jason@mail.dealwire.ai</td>
              </tr>
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Broker</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">Jason Caldwell <span style="color:#6b7280;font-size:13px;">(JLL &middot; 1 deal &middot; 100% pass rate)</span></td>
              </tr>
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Location</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">4950 SW Western Ave, Beaverton, OR</td>
              </tr>
              <tr>
                <td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Screened</td>
                <td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">Mar 11, 2026, 10:04 AM</td>
              </tr>
            </table>
            <div style="border-top:1px solid #f3f4f6;padding-top:14px;">
              <p style="margin:0;font-size:15px;font-weight:500;color:${GREEN_REASON};line-height:1.5;">128-unit workforce housing in Beaverton, OR — target West Coast market. Rents \$100 above 60% AMI for Washington County. Adjacent to Nike HQ, MAX light rail access. 95% occupied, 5.5% cap rate. Natural affordability without deed restrictions.</p>
              <div style="border-top:1px solid #f3f4f6;padding-top:10px;margin-top:10px;">
                <a href="https://outlook.office.com/mail/inbox/id/AAMkBRIDGE003" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">View Email</a><span style="color:#d1d5db;margin:0 6px;font-size:13px;">|</span><a href="https://junipersquare.com/deal-room/beaverton-commons-2026" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">Deal Room</a><span style="color:#d1d5db;margin:0 6px;font-size:13px;">|</span><a href="https://app.docusign.com/sign/ca-beaverton-commons" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">Sign CA</a>
              </div>
            </div>
          </td>
        </tr>
      </table>

      <!-- NO deals -->
      <h2 style="margin:32px 0 20px 0;font-size:20px;font-weight:700;color:#111827;letter-spacing:-0.3px;">Passed Deals <span style="color:#6b7280;font-weight:500;font-size:16px;">(4)</span></h2>

      <!-- NO 1: One Congress Tower -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px 0;border-collapse:collapse;">
        <tr>
          <td style="width:4px;background-color:${RED_ACCENT};border-radius:8px 0 0 8px;"></td>
          <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-left:none;border-radius:0 8px 8px 0;padding:20px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
              <tr>
                <td style="font-size:17px;font-weight:700;color:#111827;padding-bottom:12px;">One Congress Tower — 32-Floor Class A Office | Boston, MA | \$145M</td>
                <td style="text-align:right;vertical-align:top;padding-bottom:12px;"><span style="background-color:${RED_PILL_BG};color:${RED_PILL_TEXT};padding:4px 14px;border-radius:12px;font-size:12px;font-weight:700;letter-spacing:0.5px;">NO</span></td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px;">
              <tr><td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;width:70px;">From</td><td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">patricia@mail.dealwire.ai</td></tr>
              <tr><td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Location</td><td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">1 Congress St, Boston, MA</td></tr>
              <tr><td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Screened</td><td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">Mar 11, 2026, 10:05 AM</td></tr>
            </table>
            <div style="border-top:1px solid #f3f4f6;padding-top:14px;"><p style="margin:0;font-size:15px;font-weight:500;color:${RED_REASON};line-height:1.5;">Office asset — outside multifamily/NOAH criteria. Boston, MA is non-West Coast geography. Double disqualifier. Pass.</p><div style="border-top:1px solid #f3f4f6;padding-top:10px;margin-top:10px;"><a href="https://outlook.office.com/mail/inbox/id/AAMkBRIDGE004" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">View Email</a></div></div>
          </td>
        </tr>
      </table>

      <!-- NO 2: Mountain View Terrace -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px 0;border-collapse:collapse;">
        <tr>
          <td style="width:4px;background-color:${RED_ACCENT};border-radius:8px 0 0 8px;"></td>
          <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-left:none;border-radius:0 8px 8px 0;padding:20px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
              <tr>
                <td style="font-size:17px;font-weight:700;color:#111827;padding-bottom:12px;">Mountain View Terrace — 180-Unit Multifamily | Mountain View, CA | \$58M</td>
                <td style="text-align:right;vertical-align:top;padding-bottom:12px;"><span style="background-color:${RED_PILL_BG};color:${RED_PILL_TEXT};padding:4px 14px;border-radius:12px;font-size:12px;font-weight:700;letter-spacing:0.5px;">NO</span></td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px;">
              <tr><td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;width:70px;">From</td><td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">kevin@mail.dealwire.ai</td></tr>
              <tr><td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Location</td><td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">1600 Villa St, Mountain View, CA</td></tr>
              <tr><td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Screened</td><td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">Mar 11, 2026, 10:06 AM</td></tr>
            </table>
            <div style="border-top:1px solid #f3f4f6;padding-top:14px;"><p style="margin:0;font-size:15px;font-weight:500;color:${RED_REASON};line-height:1.5;">Mountain View is an explicit rent-control avoid market (CSFRA ordinance). Despite matching multifamily/West Coast criteria, rent stabilization limits upside and conflicts with NOAH acquisition strategy. Pass.</p><div style="border-top:1px solid #f3f4f6;padding-top:10px;margin-top:10px;"><a href="https://outlook.office.com/mail/inbox/id/AAMkBRIDGE005" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">View Email</a></div></div>
          </td>
        </tr>
      </table>

      <!-- NO 3: Riverside Gardens -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px 0;border-collapse:collapse;">
        <tr>
          <td style="width:4px;background-color:${RED_ACCENT};border-radius:8px 0 0 8px;"></td>
          <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-left:none;border-radius:0 8px 8px 0;padding:20px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
              <tr>
                <td style="font-size:17px;font-weight:700;color:#111827;padding-bottom:12px;">Riverside Gardens — 92-Unit Multifamily | Riverside, CA | \$14.8M</td>
                <td style="text-align:right;vertical-align:top;padding-bottom:12px;"><span style="background-color:${RED_PILL_BG};color:${RED_PILL_TEXT};padding:4px 14px;border-radius:12px;font-size:12px;font-weight:700;letter-spacing:0.5px;">NO</span></td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px;">
              <tr><td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;width:70px;">From</td><td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">diana@mail.dealwire.ai</td></tr>
              <tr><td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Location</td><td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">3480 University Ave, Riverside, CA</td></tr>
              <tr><td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Screened</td><td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">Mar 11, 2026, 10:07 AM</td></tr>
            </table>
            <div style="border-top:1px solid #f3f4f6;padding-top:14px;"><p style="margin:0;font-size:15px;font-weight:500;color:${RED_REASON};line-height:1.5;">Riverside County is a low-AMI avoid market. 92 units falls below the 100-unit minimum threshold. Double disqualifier. Pass.</p><div style="border-top:1px solid #f3f4f6;padding-top:10px;margin-top:10px;"><a href="https://outlook.office.com/mail/inbox/id/AAMkBRIDGE006" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">View Email</a></div></div>
          </td>
        </tr>
      </table>

      <!-- NO 4: The Driskill Hotel -->
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px 0;border-collapse:collapse;">
        <tr>
          <td style="width:4px;background-color:${RED_ACCENT};border-radius:8px 0 0 8px;"></td>
          <td style="background-color:#ffffff;border:1px solid #e5e7eb;border-left:none;border-radius:0 8px 8px 0;padding:20px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
              <tr>
                <td style="font-size:17px;font-weight:700;color:#111827;padding-bottom:12px;">The Driskill Hotel — 189-Key Luxury Historic Hotel | Austin, TX | \$92M</td>
                <td style="text-align:right;vertical-align:top;padding-bottom:12px;"><span style="background-color:${RED_PILL_BG};color:${RED_PILL_TEXT};padding:4px 14px;border-radius:12px;font-size:12px;font-weight:700;letter-spacing:0.5px;">NO</span></td>
              </tr>
            </table>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:14px;">
              <tr><td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;width:70px;">From</td><td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">grant@mail.dealwire.ai</td></tr>
              <tr><td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Location</td><td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">604 Brazos St, Austin, TX</td></tr>
              <tr><td style="padding:2px 0;font-size:14px;font-weight:500;color:#6b7280;">Screened</td><td style="padding:2px 0 2px 12px;font-size:14px;font-weight:500;color:#1f2937;">Mar 11, 2026, 10:08 AM</td></tr>
            </table>
            <div style="border-top:1px solid #f3f4f6;padding-top:14px;"><p style="margin:0;font-size:15px;font-weight:500;color:${RED_REASON};line-height:1.5;">Hotel/hospitality asset — outside multifamily/NOAH criteria. Austin, TX is non-West Coast geography. Double disqualifier. Pass.</p><div style="border-top:1px solid #f3f4f6;padding-top:10px;margin-top:10px;"><a href="https://outlook.office.com/mail/inbox/id/AAMkBRIDGE007" style="color:#2563eb;text-decoration:none;font-size:13px;font-weight:600;" target="_blank">View Email</a></div></div>
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
            <td style="padding:10px 16px;color:#111827;font-weight:600;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">Tyler Hendricks <span style="color:#6b7280;font-weight:400;font-size:12px;">(Kidder Mathews)</span></td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">1</td>
            <td style="padding:10px 16px;color:#16a34a;font-weight:600;text-align:center;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">1</td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">100%</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#111827;font-weight:600;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">Rachel Nguyen <span style="color:#6b7280;font-weight:400;font-size:12px;">(CBRE)</span></td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">1</td>
            <td style="padding:10px 16px;color:#16a34a;font-weight:600;text-align:center;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">1</td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">100%</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#111827;font-weight:600;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">Jason Caldwell <span style="color:#6b7280;font-weight:400;font-size:12px;">(JLL)</span></td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">1</td>
            <td style="padding:10px 16px;color:#16a34a;font-weight:600;text-align:center;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">1</td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">100%</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#111827;font-weight:600;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">Patricia Kowalski <span style="color:#6b7280;font-weight:400;font-size:12px;">(Eastdil Secured)</span></td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">1</td>
            <td style="padding:10px 16px;color:#dc2626;font-weight:600;text-align:center;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">0</td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">0%</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#111827;font-weight:600;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">Kevin Chang <span style="color:#6b7280;font-weight:400;font-size:12px;">(Newmark)</span></td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">1</td>
            <td style="padding:10px 16px;color:#dc2626;font-weight:600;text-align:center;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">0</td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#ffffff;border-bottom:1px solid #f3f4f6;">0%</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#111827;font-weight:600;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">Diana Morales <span style="color:#6b7280;font-weight:400;font-size:12px;">(Marcus &amp; Millichap)</span></td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">1</td>
            <td style="padding:10px 16px;color:#dc2626;font-weight:600;text-align:center;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">0</td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#f9fafb;border-bottom:1px solid #f3f4f6;">0%</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;color:#111827;font-weight:600;background-color:#ffffff;">Grant Sullivan <span style="color:#6b7280;font-weight:400;font-size:12px;">(Hodges Ward Elliott)</span></td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#ffffff;">1</td>
            <td style="padding:10px 16px;color:#dc2626;font-weight:600;text-align:center;background-color:#ffffff;">0</td>
            <td style="padding:10px 16px;color:#1f2937;font-weight:500;text-align:center;background-color:#ffffff;">0%</td>
          </tr>
        </table>
      </div>

    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:24px 36px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="margin:0;font-size:13px;color:#6b7280;">BRIDGE Housing Corporation</p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>
ENDOFHTML
)

echo "Sending BRIDGE Housing demo digest to $TO..."

HTTP_CODE=$(curl -s -o /tmp/resend-digest-response.json -w "%{http_code}" \
  -X POST "https://api.resend.com/emails" \
  -H "Authorization: Bearer $RESEND_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
  \"from\": \"BRIDGE Housing Corporation <noreply@mail.dealwire.ai>\",
  \"to\": [\"$TO\"],
  \"subject\": \"Deal Digest: 7 Deals Screened (3 Yes, 4 No)\",
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
