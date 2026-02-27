'use client';

import { useEffect } from 'react';
import { SignIn } from '@clerk/nextjs';
import posthog from 'posthog-js';

export default function SignInPage() {
  useEffect(() => {
    posthog.capture('sign_in_page_viewed');
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black">
      <SignIn
        fallbackRedirectUrl="/dashboard"
        signUpFallbackRedirectUrl="/dashboard"
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-zinc-900 border border-zinc-800',
          },
        }}
      />
    </div>
  );
}
