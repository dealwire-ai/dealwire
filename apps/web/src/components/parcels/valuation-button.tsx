"use client";

import { useState } from "react";
import { DollarSign, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import type { Parcel } from "./parcel-table";

interface ValuationButtonProps {
  parcel: Parcel;
  onUpdated?: (updates: Partial<Parcel>) => void;
}

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return "—";
  return `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function ValuationButton({ parcel, onUpdated }: ValuationButtonProps) {
  const { apiCall } = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup(force = false) {
    setLoading(true);
    setError(null);
    try {
      const result = await apiCall(
        `/public-data/parcels/${parcel.bbl}/valuation`,
        { method: "POST", body: JSON.stringify({ force }) },
      );
      onUpdated?.({
        avmValue: result.avmValue,
        avmHigh: result.avmHigh,
        avmLow: result.avmLow,
        avmConfidence: result.avmConfidence,
      });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("limit reached") || msg.includes("429")) {
        setError("Monthly limit reached");
      } else {
        setError("Lookup failed");
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <RefreshCw className="w-3 h-3 animate-spin" />
        Getting valuation...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-red-400">{error}</span>
        <button
          onClick={() => handleLookup()}
          className="text-zinc-400 hover:text-zinc-300 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // Already have valuation data
  if (parcel.avmValue != null) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5 text-[#C8A96E]" />
          <span className="text-sm font-medium text-zinc-100">
            {formatCurrency(parcel.avmValue)}
          </span>
          {parcel.avmConfidence != null && (
            <span
              className={`text-[10px] px-1 py-0 rounded ${
                parcel.avmConfidence >= 80
                  ? "bg-green-900/30 text-green-400"
                  : parcel.avmConfidence >= 60
                    ? "bg-yellow-900/30 text-yellow-400"
                    : "bg-red-900/30 text-red-400"
              }`}
            >
              {parcel.avmConfidence}% conf
            </span>
          )}
        </div>
        <div className="text-[11px] text-zinc-500">
          Range: {formatCurrency(parcel.avmLow)} –{" "}
          {formatCurrency(parcel.avmHigh)}
        </div>
        <button
          onClick={() => handleLookup(true)}
          className="text-xs text-zinc-500 hover:text-zinc-400 underline"
        >
          Refresh
        </button>
      </div>
    );
  }

  // No valuation yet
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => handleLookup()}
      className="h-7 text-xs"
    >
      <DollarSign className="w-3 h-3 mr-1" />
      Get Valuation
    </Button>
  );
}
