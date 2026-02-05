import { auth } from '@clerk/nextjs/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * API client for server components and server actions
 * Automatically includes Clerk JWT token in Authorization header
 */
export async function apiClient(endpoint: string, options: RequestInit = {}) {
  const { getToken } = await auth();
  
  // Get the token with no template - this returns the default Clerk session JWT
  const token = await getToken();
  
  console.log('[apiClient] Calling:', endpoint);
  console.log('[apiClient] Token obtained:', token ? 'YES' : 'NO');
  if (token) {
    console.log('[apiClient] Token preview:', token.substring(0, 50) + '...');
    console.log('[apiClient] Token has dots:', (token.match(/\./g) || []).length);
  }
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText);
    throw new Error(`API error: ${res.status} ${error}`);
  }

  return res.json();
}
