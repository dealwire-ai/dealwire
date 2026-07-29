"use client";

import { useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useApi } from "./use-api";
import type { Parcel, OwnerPhone } from "@/components/parcels/parcel-table";

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CONSECUTIVE_POLL_ERRORS = 3;

interface SkipTraceStatusResponse {
  [bbl: string]: {
    status: string | null;
    phones: OwnerPhone[] | null;
    emails: string[] | null;
  };
}

/**
 * Polls the backend for skip trace status changes on pending parcels.
 * Auto-starts when any parcel has `skipTraceStatus: 'pending'` and
 * stops when none remain pending or after 5 minutes.
 */
export function useSkipTracePolling(
  parcels: Parcel[],
  onParcelsUpdated: (updates: Record<string, Partial<Parcel>>) => void,
) {
  const { apiCall } = useApi();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const pendingBblsRef = useRef<Set<string>>(new Set());
  const consecutiveErrorsRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startedAtRef.current = null;
  }, []);

  /**
   * Flip every still-pending parcel to a local 'error' state so the UI
   * offers Retry instead of showing "Queued" forever. The DB converges
   * separately via the backend's stale-pending reaper.
   */
  const failPending = useCallback(
    (message: string) => {
      const updates: Record<string, Partial<Parcel>> = {};
      for (const bbl of pendingBblsRef.current) {
        updates[bbl] = { skipTraceStatus: "error" };
      }
      pendingBblsRef.current.clear();
      stopPolling();
      if (Object.keys(updates).length > 0) {
        onParcelsUpdated(updates);
        toast.error(message);
      }
    },
    [onParcelsUpdated, stopPolling],
  );

  const poll = useCallback(async () => {
    const bbls = Array.from(pendingBblsRef.current);
    if (bbls.length === 0) {
      stopPolling();
      return;
    }

    if (
      startedAtRef.current &&
      Date.now() - startedAtRef.current > MAX_POLL_DURATION_MS
    ) {
      failPending(
        "Skip trace timed out — no results after 5 minutes. Use Retry in the phone column.",
      );
      return;
    }

    try {
      const data: SkipTraceStatusResponse = await apiCall(
        `/public-data/parcels/skip-trace/status?bbls=${bbls.join(",")}`,
      );
      consecutiveErrorsRef.current = 0;

      const updates: Record<string, Partial<Parcel>> = {};
      let completedCount = 0;
      let errorCount = 0;

      for (const bbl of bbls) {
        const info = data[bbl];
        if (!info) continue;

        if (info.status && info.status !== "pending") {
          updates[bbl] = {
            skipTraceStatus: info.status as Parcel["skipTraceStatus"],
            ownerPhones: info.phones ?? null,
            ownerEmails: info.emails ?? null,
          };
          pendingBblsRef.current.delete(bbl);
          if (info.status === "found") completedCount++;
          if (info.status === "error") errorCount++;
        }
      }

      if (Object.keys(updates).length > 0) {
        onParcelsUpdated(updates);

        if (completedCount > 0) {
          toast.success(
            completedCount === 1
              ? "Skip trace complete — phone number found"
              : `Skip trace complete — ${completedCount} contacts found`,
          );
        }
        if (errorCount > 0) {
          toast.error(
            errorCount === 1
              ? "Skip trace failed — use Retry in the phone column"
              : `${errorCount} skip traces failed — use Retry in the phone column`,
          );
        }
      }

      // Stop if nothing left pending
      if (pendingBblsRef.current.size === 0) {
        stopPolling();
      }
    } catch {
      // Retry on the next interval, but don't spin silently forever
      consecutiveErrorsRef.current += 1;
      if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_POLL_ERRORS) {
        failPending(
          "Lost connection while checking skip trace results — use Retry in the phone column.",
        );
      }
    }
  }, [apiCall, onParcelsUpdated, stopPolling, failPending]);

  // Track which BBLs are pending and start/stop polling accordingly
  useEffect(() => {
    const pendingBbls = new Set(
      parcels.filter((p) => p.skipTraceStatus === "pending").map((p) => p.bbl),
    );

    pendingBblsRef.current = pendingBbls;

    if (pendingBbls.size > 0 && !timerRef.current) {
      // Start polling
      startedAtRef.current = Date.now();
      consecutiveErrorsRef.current = 0;
      timerRef.current = setInterval(poll, POLL_INTERVAL_MS);
    } else if (pendingBbls.size === 0 && timerRef.current) {
      stopPolling();
    }
  }, [parcels, poll, stopPolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);
}
