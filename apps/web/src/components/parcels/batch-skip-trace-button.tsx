"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useApi } from "@/hooks/use-api";

interface BatchSkipTraceButtonProps {
  selectedBbls: Set<string>;
  onQueued: () => void;
  quotaRemaining?: number;
  quotaLimit?: number;
}

type ButtonState = "idle" | "confirming" | "loading" | "queued" | "error";

export function BatchSkipTraceButton({
  selectedBbls,
  onQueued,
  quotaRemaining,
  quotaLimit,
}: BatchSkipTraceButtonProps) {
  const { apiCall } = useApi();
  const [state, setState] = useState<ButtonState>("idle");
  const [resultInfo, setResultInfo] = useState<{
    queued: number;
    skipped: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const count = selectedBbls.size;
  const estimatedCost = (count * 0.02).toFixed(2);
  const overQuota = quotaRemaining !== undefined && count > quotaRemaining;

  async function handleConfirm() {
    setState("loading");
    try {
      const result = await apiCall("/public-data/parcels/skip-trace", {
        method: "POST",
        body: JSON.stringify({ bbls: Array.from(selectedBbls) }),
      });
      setResultInfo({ queued: result.queued, skipped: result.skipped });
      setState("queued");
      onQueued();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Request failed");
      setState("error");
    }
  }

  if (state === "queued") {
    return (
      <span className="text-xs text-zinc-400">
        Queued {resultInfo?.queued} — results in ~2 min
        {(resultInfo?.skipped ?? 0) > 0 && (
          <span className="text-zinc-600">
            {" "}
            ({resultInfo?.skipped} skipped — already traced)
          </span>
        )}
      </span>
    );
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setState("confirming")}
        className="h-8 text-xs gap-1.5"
      >
        <Phone className="w-3.5 h-3.5" />
        Skip Trace {count} Selected
      </Button>

      <Dialog
        open={
          state === "confirming" || state === "loading" || state === "error"
        }
        onOpenChange={(open) => {
          if (!open && state !== "loading") {
            setState("idle");
            setErrorMsg(null);
          }
        }}
      >
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Skip Trace</DialogTitle>
          </DialogHeader>

          <div className="py-2 space-y-3 text-sm">
            <p className="text-zinc-300">
              Look up contact info for{" "}
              <span className="text-white font-medium">{count} parcels</span>.
            </p>
            <div className="bg-zinc-800/60 rounded-lg p-3 space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">Estimated cost</span>
                <span className="text-white font-medium">${estimatedCost}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Rate</span>
                <span className="text-zinc-300">$0.02 / record</span>
              </div>
            </div>
            {quotaRemaining !== undefined && quotaLimit !== undefined && (
              <div className="flex justify-between text-xs">
                <span className="text-zinc-400">Monthly quota</span>
                <span
                  className={
                    overQuota ? "text-red-400 font-medium" : "text-zinc-300"
                  }
                >
                  {quotaLimit - quotaRemaining} / {quotaLimit} used
                </span>
              </div>
            )}
            {overQuota && (
              <p className="text-red-400 text-xs">
                Exceeds remaining quota ({quotaRemaining} traces left this
                month). Select fewer parcels.
              </p>
            )}
            {errorMsg && <p className="text-red-400 text-xs">{errorMsg}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setState("idle");
                setErrorMsg(null);
              }}
              disabled={state === "loading"}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={state === "loading" || overQuota}
              className="bg-[#C8A96E] hover:bg-[#b8996e] text-black"
            >
              {state === "loading" ? "Submitting..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
