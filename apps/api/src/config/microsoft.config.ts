export const microsoftConfig = () => ({
  /** Secret used to validate incoming Microsoft Graph webhook notifications */
  webhookSecret: process.env.MICROSOFT_WEBHOOK_SECRET || '',
  /** Base URL for our API (used as notificationUrl for Graph subscriptions) */
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
  /** Clerk provider ID for Microsoft OAuth */
  clerkProviderId: 'microsoft',
});


