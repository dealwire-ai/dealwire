# Clerk Authentication Setup - Implementation Summary

## ✅ What Was Implemented

### Backend Security (API)

1. **Controllers Secured with Organization Scope**
   - `DealController` - All endpoints now use `@AuthUser('organizationId')` decorator
   - `ScreeningPreferencesController` - Scoped to user's organization
   - `ContactController` - Contacts filtered by organization
   - `AssetController` - Assets filtered by organization
   - **Security Fix**: Removed `organizationId` query parameters that allowed users to access other orgs' data

2. **CORS Configuration**
   - Added CORS support in `apps/api/src/main.ts`
   - Configured to accept requests from `http://localhost:3000` (dev) and production frontend URL
   - Added `FRONTEND_URL` environment variable to `apps/api/.env`

### Frontend API Clients (Web)

1. **Server Component API Client** (`apps/web/src/lib/api.ts`)
   - Uses Clerk's `auth()` from `@clerk/nextjs/server`
   - Automatically includes JWT token in `Authorization` header
   - For use in Server Components and Server Actions

2. **Client Component Hook** (`apps/web/src/hooks/use-api.ts`)
   - Uses Clerk's `useAuth()` hook from `@clerk/nextjs`
   - Automatically includes JWT token in `Authorization` header
   - For use in Client Components

## How It Works

### Authentication Flow

```
User signs in via Clerk
         ↓
Frontend gets session token from Clerk
         ↓
Frontend calls apiClient('/deals') or useApi().apiCall('/deals')
         ↓
Request includes: Authorization: Bearer <jwt-token>
         ↓
Backend: ClerkAuthGuard intercepts request
         ↓
Guard verifies JWT with Clerk
         ↓
Guard looks up user's organizationId in database
         ↓
Guard attaches req.auth = { userId, organizationId }
         ↓
Controller reads @AuthUser('organizationId')
         ↓
Query scoped to user's organization only
         ↓
Response returned with ONLY user's org data
```

## Usage Examples

### Server Component (Next.js)

```typescript
import { apiClient } from '@/lib/api';

export default async function DealsPage() {
  // Automatically includes Clerk JWT token
  const response = await apiClient('/deals');
  const deals = response.data;

  return (
    <div>
      {deals.map(deal => (
        <div key={deal.id}>{deal.sourceSubject}</div>
      ))}
    </div>
  );
}
```

### Client Component (React)

```typescript
'use client';
import { useApi } from '@/hooks/use-api';
import { useEffect, useState } from 'react';

export default function DealsClient() {
  const { apiCall } = useApi();
  const [deals, setDeals] = useState([]);

  useEffect(() => {
    apiCall('/deals').then(response => {
      setDeals(response.data);
    });
  }, []);

  return (
    <div>
      {deals.map(deal => (
        <div key={deal.id}>{deal.sourceSubject}</div>
      ))}
    </div>
  );
}
```

## Manual Testing Steps

1. **Start both services:**
   ```bash
   pnpm dev
   ```

2. **Sign in with Clerk** on the frontend (http://localhost:3000)

3. **Make API calls** from a page/component using `apiClient()` or `useApi()`

4. **Verify:**
   - Requests include `Authorization: Bearer <token>` header
   - Backend returns 403 if user not in organization
   - Backend returns only data for user's organization
   - CORS headers are present in response

## Security Notes

- ✅ Users can ONLY access their organization's data
- ✅ `organizationId` is extracted from verified JWT, not from query params
- ✅ Auth is optional in development (for easier testing)
- ✅ Auth is REQUIRED in production (NODE_ENV=production)
- ✅ CORS restricts requests to allowed frontend origins

## Environment Variables

### Backend (apps/api/.env)
```bash
CLERK_SECRET_KEY=sk_test_...
FRONTEND_URL=http://localhost:3000  # or production URL
REQUIRE_AUTH=true  # Optional: force auth even in dev
```

### Frontend (apps/web/.env.local)
```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_API_URL=http://localhost:3001
CLERK_SECRET_KEY=sk_test_...
```

## Files Modified

### Backend
- ✅ `apps/api/src/controller/deal.controller.ts`
- ✅ `apps/api/src/controller/screening-preferences.controller.ts`
- ✅ `apps/api/src/controller/contact.controller.ts`
- ✅ `apps/api/src/controller/asset.controller.ts`
- ✅ `apps/api/src/main.ts` (CORS)
- ✅ `apps/api/.env` (FRONTEND_URL)

### Frontend
- ✅ `apps/web/src/lib/api.ts` (new)
- ✅ `apps/web/src/hooks/use-api.ts` (new)

## Testing the Setup

### Test Pages Created

1. **Sign-In Page** (`/sign-in`)
   - Uses Clerk's built-in `<SignIn />` component
   - Styled to match the app's dark theme
   - Automatically redirects to `/dashboard` after sign-in

2. **Dashboard Page** (`/dashboard`)
   - Protected route - requires authentication
   - Fetches deals from `/deals` API endpoint
   - Displays deals in a simple list with decision badges
   - Shows API connection status
   - Includes sign-out button

3. **Home Page** (`/`)
   - Added "Sign In" button in navigation
   - Links to `/sign-in` page

### How to Test

1. **Start both services:**
   ```bash
   pnpm dev
   ```

2. **Visit the app:**
   - Open http://localhost:3000
   - Click "Sign In" button
   - Sign in with your Microsoft account (configured in Clerk)
   - You'll be redirected to `/dashboard`
   - Dashboard will fetch and display your organization's deals

3. **If you get a 403 error:**
   - Visit http://localhost:3000/debug
   - Copy your Clerk user ID
   - Run this command to sync your user:
   ```bash
   psql "postgresql://isaac@localhost:5432/analyzer" -c "INSERT INTO \"User\" (id, email, \"organizationId\", \"createdAt\", \"updatedAt\") VALUES ('YOUR_USER_ID', 'your@email.com', '931ee21b-59ff-470a-b6f4-988002905bc2', NOW(), NOW()) ON CONFLICT (id) DO UPDATE SET \"organizationId\" = '931ee21b-59ff-470a-b6f4-988002905bc2', \"updatedAt\" = NOW();"
   ```
   - Alternatively, in production, users are synced automatically via Clerk webhooks
   - The dashboard now shows helpful logs in the API console

4. **Verify:**
   - ✅ Sign-in flow works
   - ✅ Dashboard is protected (redirects to sign-in if not logged in)
   - ✅ API calls include JWT token automatically
   - ✅ Only your organization's deals are shown
   - ✅ CORS headers are present
   - ✅ Error handling for 403 (user not in org) or other API errors
   - ✅ Helpful debug page at `/debug` to diagnose auth issues

### Files Created

**Frontend:**
- `apps/web/src/app/sign-in/[[...sign-in]]/page.tsx` - Sign-in page
- `apps/web/src/app/dashboard/page.tsx` - Protected dashboard
- `apps/web/src/middleware.ts` - Route protection middleware
- Updated `apps/web/src/app/page.tsx` - Added sign-in button
- Updated `apps/web/.env.local` - Added Clerk redirect URLs

## Next Steps

1. ✅ Create protected pages/components that use the API clients (DONE - `/dashboard`)
2. Test with real Clerk user accounts in your organization
3. Add error handling for 401/403 responses (basic error display added)
4. Consider adding loading states and error boundaries
5. Update production environment variables on Railway and Vercel
6. Build out the dashboard with more features (charts, filters, etc.)
