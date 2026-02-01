export interface ClerkConfig {
  clerkSecretKey: string;
  webhookSecret: string;
  /**
   * When true, protected routes require a valid Clerk JWT (401 if missing/invalid).
   * When false (e.g. local dev), requests are allowed without a token; if a token
   * is present it is still verified and auth is attached.
   * Set REQUIRE_AUTH=true to require auth even when NODE_ENV !== 'production'.
   */
  requireAuth: boolean;
}

export const clerkConfig = (): ClerkConfig => ({
  clerkSecretKey: process.env.CLERK_SECRET_KEY || '',
  webhookSecret: process.env.CLERK_WEBHOOK_SECRET || '',
  requireAuth:
    process.env.REQUIRE_AUTH === 'true' || process.env.NODE_ENV === 'production', // Railway automatically sets NODE_ENV to 'production' in prod. 
});

