export interface ClerkConfig {
  secretKey: string;
  webhookSecret: string;
}

export const clerkConfig = (): ClerkConfig => ({
  secretKey: process.env.CLERK_SECRET_KEY || '',
  webhookSecret: process.env.CLERK_WEBHOOK_SECRET || '',
});

