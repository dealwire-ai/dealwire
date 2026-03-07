# Frontend (`apps/web`)

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk public key for frontend |
| `NEXT_PUBLIC_API_URL` | Backend API URL (http://localhost:3001 or production URL) |
| `CLERK_SECRET_KEY` | Clerk secret key for server-side operations |

---

## API Clients

### Server Components

```typescript
import { apiClient } from '@/lib/api';

export default async function MyPage() {
  const data = await apiClient('/your-resource');
  // apiClient automatically includes Clerk JWT token
  return <div>...</div>;
}
```

### Client Components

```typescript
'use client';
import { useApi } from '@/hooks/use-api';

export default function MyComponent() {
  const { apiCall } = useApi();

  useEffect(() => {
    apiCall('/your-resource').then(setData);
  }, []);

  return <div>...</div>;
}
```

### Both clients:
- Automatically include `Authorization: Bearer <jwt>` header
- Handle token refresh via Clerk
- Throw errors on non-200 responses
- Use `NEXT_PUBLIC_API_URL` env var (defaults to `http://localhost:3001`)

---

## CORS Configuration

CORS is configured in `apps/api/src/main.ts`:
```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
});
```

Required env var in `apps/api/.env`:
```bash
FRONTEND_URL=http://localhost:3000  # or https://deals.frontstep.ai in prod
```
