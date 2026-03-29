# Clerk Authentication Setup

> For detailed auth patterns, guard usage, and env vars, see [BACKEND.md](./BACKEND.md).

## Authentication Flow

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

## Files Modified

### Backend

- `apps/api/src/controller/deal.controller.ts`
- `apps/api/src/controller/screening-preferences.controller.ts`
- `apps/api/src/controller/contact.controller.ts`
- `apps/api/src/controller/asset.controller.ts`
- `apps/api/src/main.ts` (CORS)

### Frontend

- `apps/web/src/lib/api.ts` (server component API client)
- `apps/web/src/hooks/use-api.ts` (client component hook)
- `apps/web/src/middleware.ts` (route protection)
