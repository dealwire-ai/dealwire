"use client";

import { useState } from "react";
import { Clipboard, Check, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import type { Parcel } from "./parcel-table";

interface SkipTraceButtonProps {
  parcel: Parcel;
  onUpdated?: (updates: Partial<Parcel>) => void;
}

export function SkipTraceButton({ parcel, onUpdated }: SkipTraceButtonProps) {
  const { apiCall } = useApi();
  const [loading, setLoading] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

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

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedNumber(text);
    setTimeout(() => setCopiedNumber(null), 2000);
  }

  if (loading || status === "pending") {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <RefreshCw className="w-3 h-3 animate-spin" />
        Looking up contact...
      </div>
    );
  }

  if (status === "found") {
    const phones = parcel.ownerPhones ?? [];
    const emails = parcel.ownerEmails ?? [];
    return (
      <div className="space-y-1.5">
        {phones.map((p) => (
          <div key={p.number} className="flex items-center gap-2 text-xs">
            <a
              href={`tel:${p.number}`}
              className="text-[#C8A96E] hover:underline"
            >
              {p.number}
            </a>
            <span className="text-zinc-600 capitalize">{p.type}</span>
            <button
              onClick={() => copyToClipboard(p.number)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Copy number"
            >
              {copiedNumber === p.number ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Clipboard className="w-3 h-3" />
              )}
            </button>
          </div>
        ))}
        {emails.map((email) => (
          <div key={email} className="flex items-center gap-2 text-xs">
            <a
              href={`mailto:${email}`}
              className="text-zinc-300 hover:underline"
            >
              {email}
            </a>
            <button
              onClick={() => copyToClipboard(email)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
              title="Copy email"
            >
              {copiedNumber === email ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Clipboard className="w-3 h-3" />
              )}
            </button>
          </div>
        ))}
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
