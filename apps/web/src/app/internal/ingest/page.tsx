"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApi } from "@/hooks/use-api";

type IngestState = "idle" | "loading" | "success" | "error";

interface IngestResult {
  totalProcessed?: number;
  totalCreated?: number;
  totalUpdated?: number;
  totalSkipped?: number;
  [key: string]: unknown;
}

export default function IngestPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { apiCall } = useApi();
  const [state, setState] = useState<IngestState>("idle");
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/sign-in");
    }
  }, [isLoaded, user, router]);

  const isFrontstep =
    user?.primaryEmailAddress?.emailAddress?.endsWith("@frontstep.ai") ?? false;

  async function handleIngest() {
    if (state === "loading") return;
    setState("loading");
    setResult(null);
    setError("");

    try {
      const data = await apiCall("/public-data/ingest", {
        method: "POST",
        body: JSON.stringify({ boroughs: ["1", "2", "3", "4", "5"] }),
      });
      setResult(data);
      setState("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  if (!isLoaded || !user) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!isFrontstep) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
        <div className="text-6xl">🚫</div>
        <h1 className="text-3xl font-bold text-red-500">ACCESS DENIED</h1>
        <p className="text-zinc-400">
          This area is restricted to authorized Frontstep personnel only.
        </p>
        <p className="text-zinc-600 text-sm font-mono">
          Your clearance level: INSUFFICIENT
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-8 p-8 select-none">
      {/* Hazard header */}
      <div className="text-center space-y-2">
        <div className="font-mono text-xs tracking-[0.3em] text-yellow-500/80 uppercase">
          ⚠ Authorized Personnel Only ⚠
        </div>
        <h1 className="text-4xl font-black tracking-tight">
          INGESTION CONTROL
        </h1>
        <div
          className="h-2 w-64 mx-auto"
          style={{
            background:
              "repeating-linear-gradient(-45deg, #eab308, #eab308 10px, #000 10px, #000 20px)",
          }}
        />
      </div>

      {/* Warning text */}
      <div className="text-center">
        <p className="text-red-500 font-bold text-lg tracking-wide animate-pulse">
          ⚠ DO NOT PRESS ⚠
        </p>
        <p className="text-zinc-600 text-xs font-mono mt-1">
          (unless you really want to)
        </p>
      </div>

      {/* The Button */}
      <div className="relative">
        {/* Hazard ring */}
        <div
          className="absolute -inset-4 rounded-full"
          style={{
            background:
              "repeating-conic-gradient(#eab308 0deg 10deg, #000 10deg 20deg)",
            opacity: 0.3,
          }}
        />

        <button
          onClick={handleIngest}
          disabled={state === "loading"}
          className={`
            relative z-10 w-48 h-48 rounded-full font-black text-xl uppercase tracking-wider
            border-4 border-red-900
            transition-all duration-150 cursor-pointer
            ${
              state === "loading"
                ? "bg-red-900 text-red-300 animate-pulse scale-95 shadow-[0_0_60px_rgba(239,68,68,0.4)]"
                : state === "success"
                  ? "bg-green-700 text-green-100 shadow-[0_0_60px_rgba(34,197,94,0.5)] border-green-600"
                  : state === "error"
                    ? "bg-red-950 text-red-300 border-red-700"
                    : "bg-red-700 text-white shadow-[0_0_30px_rgba(239,68,68,0.3)] hover:scale-110 hover:shadow-[0_0_80px_rgba(239,68,68,0.6)] active:scale-95"
            }
          `}
        >
          {state === "loading" && "INGESTING..."}
          {state === "success" && "DONE ✓"}
          {state === "error" && "FAILED ✗"}
          {state === "idle" && (
            <>
              <div className="text-sm mb-1 opacity-70">LAUNCH</div>
              <div>INGESTION</div>
            </>
          )}
        </button>
      </div>

      {/* Danger zone label */}
      <div className="font-mono text-xs text-red-900 tracking-[0.5em] uppercase">
        — Danger Zone —
      </div>

      {/* Results / Error */}
      {state === "success" && result && (
        <div className="bg-zinc-900 border border-green-800 rounded-lg p-6 max-w-md w-full text-sm font-mono space-y-1">
          <div className="text-green-400 font-bold mb-2">
            INGESTION COMPLETE
          </div>
          {result.totalProcessed !== undefined && (
            <div>
              Processed:{" "}
              <span className="text-white">
                {result.totalProcessed.toLocaleString()}
              </span>
            </div>
          )}
          {result.totalCreated !== undefined && (
            <div>
              Created:{" "}
              <span className="text-green-400">
                {result.totalCreated.toLocaleString()}
              </span>
            </div>
          )}
          {result.totalUpdated !== undefined && (
            <div>
              Updated:{" "}
              <span className="text-yellow-400">
                {result.totalUpdated.toLocaleString()}
              </span>
            </div>
          )}
          {result.totalSkipped !== undefined && (
            <div>
              Skipped:{" "}
              <span className="text-zinc-400">
                {result.totalSkipped.toLocaleString()}
              </span>
            </div>
          )}
          <button
            onClick={() => {
              setState("idle");
              setResult(null);
            }}
            className="mt-4 text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
          >
            Reset
          </button>
        </div>
      )}

      {state === "error" && (
        <div className="bg-zinc-900 border border-red-800 rounded-lg p-6 max-w-md w-full text-sm font-mono">
          <div className="text-red-400 font-bold mb-2">INGESTION FAILED</div>
          <div className="text-red-300 break-all">{error}</div>
          <button
            onClick={() => {
              setState("idle");
              setError("");
            }}
            className="mt-4 text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Fine print */}
      <p className="text-zinc-700 text-xs font-mono max-w-sm text-center">
        This will ingest NYC parcel data for all 5 boroughs. The process may
        take several minutes. Frontstep, Inc. is not responsible for any
        consequences of pressing this button.
      </p>
    </div>
  );
}
