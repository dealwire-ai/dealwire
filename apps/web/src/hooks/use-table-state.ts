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
  defaultSort?: string;
  defaultOrder?: "asc" | "desc";
}

export function useTableState(options: UseTableStateOptions = {}) {
  const {
    defaultLimit = 20,
    defaultFilters = {},
    defaultSort,
    defaultOrder = "desc",
  } = options;

  const [page, setPage] = useState(1);
  const [limit] = useState(defaultLimit);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>(defaultFilters);
  const [sort, setSortState] = useState<string | undefined>(defaultSort);
  const [order, setOrderState] = useState<"asc" | "desc">(defaultOrder);
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

  const setSort = useCallback((field: string) => {
    setSortState((prev) => {
      const sameColumn = prev === field;
      setOrderState((o) => (sameColumn && o === "desc" ? "asc" : "desc"));
      return field;
    });
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
    if (sort) {
      params.set("sort", sort);
      params.set("order", order);
    }
    return params.toString();
  }, [page, limit, debouncedSearch, filters, sort, order]);

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
    sort,
    order,
    setSort,
  };
}
