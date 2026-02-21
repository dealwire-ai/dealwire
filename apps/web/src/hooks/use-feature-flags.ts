"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { useApi } from "./use-api";

export interface FeatureFlags {
  parcels: boolean;
}

const DEFAULTS: FeatureFlags = {
  parcels: false,
};

export function useFeatureFlags() {
  const { isLoaded, userId } = useAuth();
  const { apiCall } = useApi();
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded || !userId) return;

    apiCall("/feature-flags")
      .then((data) => setFlags({ ...DEFAULTS, ...data }))
      .catch(() => setFlags(DEFAULTS))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, userId]);

  return { flags, loading };
}
