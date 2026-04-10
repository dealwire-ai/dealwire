"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { PhoneContactPanel } from "./phone-contact-panel";
import type { Parcel } from "./parcel-table";

interface SkipTraceButtonProps {
  parcel: Parcel;
  onUpdated?: (updates: Partial<Parcel>) => void;
}

export function SkipTraceButton({ parcel, onUpdated }: SkipTraceButtonProps) {
  const { apiCall } = useApi();
  const [loading, setLoading] = useState(false);

  const status = parcel.skipTraceStatus;

  async function handleLookup(force = false) {
    setLoading(true);
    try {
      await apiCall(`/public-data/parcels/${parcel.bbl}/skip-trace`, {
        method: "POST",
        body: JSON.stringify({ force }),
      });
      // Mark as pending locally — results arrive async
      onUpdated?.({ skipTraceStatus: "pending" });
    } catch {
      // ignore — user can retry
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <RefreshCw className="w-3 h-3 animate-spin" />
        Submitting...
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#C8A96E] opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#C8A96E]" />
        </span>
        Queued — checking for results...
      </div>
    );
  }

  if (status === "found") {
    const phones = parcel.ownerPhones ?? [];
    const emails = parcel.ownerEmails ?? [];
    return (
      <div className="space-y-2">
        <PhoneContactPanel
          bbl={parcel.bbl}
          phones={phones}
          emails={emails}
          onVerifiedPhoneChange={(phone) =>
            onUpdated?.({ _verifiedPhone: phone })
          }
        />
        <button
          onClick={() => handleLookup(true)}
          className="text-xs text-zinc-500 hover:text-zinc-400 underline"
        >
          Re-trace
        </button>
      </div>
    );
  }

  if (status === "not_found") {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-zinc-500">No contact found</span>
        <button
          onClick={() => handleLookup(true)}
          className="text-zinc-500 hover:text-zinc-400 underline"
        >
          Re-trace
        </button>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-red-400">Lookup failed</span>
        <button
          onClick={() => handleLookup(true)}
          className="text-zinc-400 hover:text-zinc-300 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // Not traced yet
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => handleLookup(false)}
      className="h-7 text-xs"
    >
      Lookup Phone
    </Button>
  );
}
