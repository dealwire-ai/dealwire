'use client';
import { useAuth } from '@clerk/nextjs';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * API hook for client components
 * Automatically includes Clerk JWT token in Authorization header
 */
export function useApi() {
  const { getToken } = useAuth();

  async function apiCall(endpoint: string, options: RequestInit = {}) {
    const token = await getToken();
    
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

  return { apiCall };
}
