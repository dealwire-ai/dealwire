export interface ClerkConfig {
  clerkSecretKey: string;
  webhookSecret: string;
}

export const clerkConfig = (): ClerkConfig => ({
  clerkSecretKey: process.env.CLERK_SECRET_KEY || '',
  webhookSecret: process.env.CLERK_WEBHOOK_SECRET || '',
});

