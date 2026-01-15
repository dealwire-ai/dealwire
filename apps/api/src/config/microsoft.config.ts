export const microsoftConfig = () => {
  // Subscription renewal interval in minutes (default: 360 minutes = 6 hours)
  const renewalIntervalMinutes = parseInt(
    process.env.MICROSOFT_SUBSCRIPTION_RENEWAL_INTERVAL_MINUTES || '360',
    10,
  );

  // Clamp between 1 minute and 24 hours (1440 minutes)
  const minutes = Math.max(1, Math.min(1440, renewalIntervalMinutes));

  // Generate cron expression
  let cronExpression: string;
  if (minutes >= 60 && minutes % 60 === 0) {
    // If it's a whole number of hours, use hour-based cron: "0 */N * * *"
    const hours = minutes / 60;
    cronExpression = `0 */${hours} * * *`;
  } else {
    // Otherwise, use minute-based cron: "*/N * * * *"
    cronExpression = `*/${minutes} * * * *`;
  }

  // Format interval for logging
  const intervalDisplay =
    minutes >= 60
      ? `${minutes / 60} hours`
      : `${minutes} minutes`;

  return {
    /** Secret used to validate incoming Microsoft Graph webhook notifications */
    webhookSecret: process.env.MICROSOFT_WEBHOOK_SECRET || '',
    /** Base URL for our API (used as notificationUrl for Graph subscriptions) */
    apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:3001',
    /** Clerk provider ID for Microsoft OAuth */
    clerkProviderId: 'microsoft',
    /** Cron expression for subscription renewal interval */
    subscriptionRenewalCron: cronExpression,
    /** Subscription renewal interval display string (for logging) */
    subscriptionRenewalInterval: intervalDisplay,
  };
};


