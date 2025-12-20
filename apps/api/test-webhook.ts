/**
 * Test script to simulate a Resend webhook for local testing
 *
 * Usage:
 *   ts-node test-webhook.ts [email-id] [from-email]
 *
 * Examples:
 *   ts-node test-webhook.ts                                    # Uses defaults
 *   ts-node test-webhook.ts test123                            # Custom email ID
 *   ts-node test-webhook.ts test123 isaac@frontstep.ai        # Custom sender
 */

import crypto from 'crypto';

const WEBHOOK_URL = 'http://localhost:3001/webhooks/resend';
const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET || 'whsec_test123';

// Parse command line args
const emailId = process.argv[2] || 'test_email_' + Date.now();
const fromEmail = process.argv[3] || 'isaac@frontstep.ai';

// Create a mock Resend webhook payload
const payload = {
  type: 'email.received',
  created_at: new Date().toISOString(),
  data: {
    email_id: emailId,
    from: fromEmail,
    to: ['mail.deals@frontstep.ai'],
    subject: '[TEST] Sample Real Estate Deal',
    message_id: `<test-${emailId}@resend.dev>`,
    attachments: [],
    html: `
      <h1>Investment Opportunity - Multifamily Property</h1>
      <p>Dear Investor,</p>
      <p>We are pleased to present an excellent investment opportunity:</p>

      <h2>Property Details</h2>
      <ul>
        <li><strong>Address:</strong> 123 Main Street, Brooklyn, NY 11201</li>
        <li><strong>Property Type:</strong> Multifamily (24 units)</li>
        <li><strong>Price:</strong> $8,500,000</li>
        <li><strong>Cap Rate:</strong> 6.8%</li>
        <li><strong>Year Built:</strong> 1985</li>
        <li><strong>Lot Size:</strong> 12,000 sq ft</li>
      </ul>

      <h2>Financial Overview</h2>
      <ul>
        <li><strong>Annual NOI:</strong> $578,000</li>
        <li><strong>Gross Rent:</strong> $720,000</li>
        <li><strong>Operating Expenses:</strong> $142,000</li>
        <li><strong>Occupancy:</strong> 95%</li>
      </ul>

      <h2>Highlights</h2>
      <ul>
        <li>Value-add opportunity with 40% below-market rents</li>
        <li>Recent roof and boiler replacement (2022)</li>
        <li>Strong rental demand in growing Brooklyn neighborhood</li>
        <li>10-year property tax abatement in place</li>
      </ul>

      <p>Please let us know if you would like additional information or to schedule a showing.</p>

      <p>Best regards,<br>Real Estate Team</p>
    `,
    text: `
Investment Opportunity - Multifamily Property

Dear Investor,

We are pleased to present an excellent investment opportunity:

Property Details:
- Address: 123 Main Street, Brooklyn, NY 11201
- Property Type: Multifamily (24 units)
- Price: $8,500,000
- Cap Rate: 6.8%
- Year Built: 1985
- Lot Size: 12,000 sq ft

Financial Overview:
- Annual NOI: $578,000
- Gross Rent: $720,000
- Operating Expenses: $142,000
- Occupancy: 95%

Highlights:
- Value-add opportunity with 40% below-market rents
- Recent roof and boiler replacement (2022)
- Strong rental demand in growing Brooklyn neighborhood
- 10-year property tax abatement in place

Please let us know if you would like additional information or to schedule a showing.

Best regards,
Real Estate Team
    `.trim(),
  },
};

// Generate Svix signature
const payloadString = JSON.stringify(payload);
const timestamp = Math.floor(Date.now() / 1000);
const svixId = 'msg_' + crypto.randomBytes(12).toString('hex');

// Svix uses HMAC-SHA256
const signedContent = `${svixId}.${timestamp}.${payloadString}`;
const signature = crypto
  .createHmac('sha256', RESEND_WEBHOOK_SECRET.replace('whsec_', ''))
  .update(signedContent)
  .digest('base64');

const headers = {
  'Content-Type': 'application/json',
  'svix-id': svixId,
  'svix-timestamp': timestamp.toString(),
  'svix-signature': `v1,${signature}`,
};

console.log('\n🧪 Testing webhook endpoint...\n');
console.log('📧 Simulating email from:', fromEmail);
console.log('📨 Email ID:', emailId);
console.log('🔗 Webhook URL:', WEBHOOK_URL);
console.log('\n📤 Sending webhook payload...\n');

fetch(WEBHOOK_URL, {
  method: 'POST',
  headers,
  body: payloadString,
})
  .then(async (response) => {
    console.log('📥 Response status:', response.status, response.statusText);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Webhook processed successfully!');
      console.log('📋 Response:', JSON.stringify(data, null, 2));
      console.log('\n✉️  Check your email at', fromEmail, 'for the summary!\n');
    } else {
      const text = await response.text();
      console.error('❌ Webhook failed!');
      console.error('Response:', text);
    }
  })
  .catch((error) => {
    console.error('❌ Error sending webhook:', error.message);
    console.error('\n💡 Make sure your API server is running on http://localhost:3001');
    console.error('   Run: pnpm --filter @analyzer/api dev\n');
  });
