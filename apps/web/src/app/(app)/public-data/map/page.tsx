"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { DealMap } from "@/components/pipeline/deal-map";

export default function MapPage() {
  const { userId, isLoaded } = useAuth();
  const router = useRouter();
  const { flags, loading: flagsLoading } = useFeatureFlags();

  useEffect(() => {
    if (!flagsLoading && !flags.parcels) {
      router.push("/dashboard");
    }
  }, [flagsLoading, flags.parcels, router]);

  if (!isLoaded || flagsLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  if (!userId) return null;

  return (
    <div className="flex h-full flex-col p-6">
      <DealMap />
    </div>
  );
}
