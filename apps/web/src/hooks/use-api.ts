"use client";
import { useAuth } from "@clerk/nextjs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ApiCallOptions extends RequestInit {
  /** Skip setting Content-Type (e.g. for FormData uploads where the browser sets it) */
  skipContentType?: boolean;
  /** Return the raw Response instead of calling .json() (e.g. for blob downloads) */
  raw?: boolean;
}

/**
 * API hook for client components
 * Automatically includes Clerk JWT token in Authorization header
 */
export function useApi() {
  const { getToken } = useAuth();

  async function apiCall(endpoint: string, options: ApiCallOptions = {}) {
    const { skipContentType, raw, ...fetchOptions } = options;
    const token = await getToken();

    const headers: HeadersInit = {
      ...(!skipContentType && { "Content-Type": "application/json" }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...fetchOptions.headers,
    };

    const res = await fetch(`${API_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
    });

    if (!res.ok) {
      const error = await res.text().catch(() => res.statusText);
      throw new Error(`API error: ${res.status} ${error}`);
    }

    if (raw) return res;
    return res.json();
  }

  return { apiCall };
}
