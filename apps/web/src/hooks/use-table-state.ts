"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UseTableStateOptions {
  defaultLimit?: number;
  defaultFilters?: Record<string, string>;
}

export function useTableState(options: UseTableStateOptions = {}) {
  const { defaultLimit = 20, defaultFilters = {} } = options;

  const [page, setPage] = useState(1);
  const [limit] = useState(defaultLimit);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>(defaultFilters);
  const [meta, setMeta] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: defaultLimit,
    totalPages: 0,
  });

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounce search input
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Reset page when filters change
  const setFilter = useCallback((key: string, value: string) => {
    setFilters((prev) => {
      if (value === "") {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
    setPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setSearch("");
    setDebouncedSearch("");
    setFilters({});
    setPage(1);
  }, []);

  const hasActiveFilters = search !== "" || Object.keys(filters).length > 0;

  // Build query string
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (debouncedSearch) params.set("search", debouncedSearch);
    for (const [key, value] of Object.entries(filters)) {
      if (value) params.set(key, value);
    }
    return params.toString();
  }, [page, limit, debouncedSearch, filters]);

  return {
    page,
    setPage,
    limit,
    search,
    setSearch,
    debouncedSearch,
    filters,
    setFilter,
    clearFilters,
    hasActiveFilters,
    meta,
    setMeta,
    queryString,
  };
}
