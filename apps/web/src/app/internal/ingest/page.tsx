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

  // NYCTL state
  const [nyctlState, setNyctlState] = useState<IngestState>("idle");
  const [nyctlResult, setNyctlResult] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [nyctlError, setNyctlError] = useState<string>("");
  const [nyctlReportDate, setNyctlReportDate] = useState("9-30-2025");

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/sign-in");
    }
  }, [isLoaded, user, router]);

  const isFrontstep =
    (user?.primaryEmailAddress?.emailAddress?.endsWith("@dealwire.ai") ||
      user?.primaryEmailAddress?.emailAddress?.endsWith("@frontstep.ai")) ??
    false;

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

  async function handleNyctlIngest() {
    if (nyctlState === "loading" || !nyctlReportDate.trim()) return;
    setNyctlState("loading");
    setNyctlResult(null);
    setNyctlError("");

    try {
      const data = await apiCall("/public-data/ingest/nyctl", {
        method: "POST",
        body: JSON.stringify({ reportDate: nyctlReportDate.trim() }),
      });
      setNyctlResult(data);
      setNyctlState("success");
    } catch (err) {
      setNyctlError(err instanceof Error ? err.message : "Unknown error");
      setNyctlState("error");
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

      {/* NYCTL Lien Sale Ingestion */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-md w-full space-y-4 mt-8">
        <div className="text-zinc-300 font-bold text-sm tracking-wide uppercase">
          NYCTL Lien Sale Ingestion
        </div>
        <p className="text-zinc-500 text-xs">
          Ingest NYCTL quarterly XLSX data and match to parcels. Enter the
          report date from the XLSX filename (e.g. 9-30-2025).
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={nyctlReportDate}
            onChange={(e) => setNyctlReportDate(e.target.value)}
            placeholder="9-30-2025"
            className="flex-1 bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
          />
          <button
            onClick={handleNyctlIngest}
            disabled={nyctlState === "loading" || !nyctlReportDate.trim()}
            className={`px-4 py-2 rounded text-sm font-medium transition-colors cursor-pointer ${
              nyctlState === "loading"
                ? "bg-yellow-900 text-yellow-300 animate-pulse"
                : "bg-yellow-600 text-white hover:bg-yellow-500"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {nyctlState === "loading" ? "Ingesting..." : "Ingest NYCTL"}
          </button>
        </div>

        {nyctlState === "success" && nyctlResult && (
          <div className="bg-zinc-950 border border-green-800 rounded p-3 text-xs font-mono space-y-1">
            <div className="text-green-400 font-bold">
              NYCTL INGESTION COMPLETE
            </div>
            {Object.entries(nyctlResult).map(([key, val]) => (
              <div key={key}>
                <span className="text-zinc-500">{key}: </span>
                <span className="text-zinc-200">
                  {typeof val === "number"
                    ? val.toLocaleString()
                    : String(val ?? "-")}
                </span>
              </div>
            ))}
            <button
              onClick={() => {
                setNyctlState("idle");
                setNyctlResult(null);
              }}
              className="mt-2 text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
            >
              Reset
            </button>
          </div>
        )}

        {nyctlState === "error" && (
          <div className="bg-zinc-950 border border-red-800 rounded p-3 text-xs font-mono">
            <div className="text-red-400 font-bold">NYCTL INGESTION FAILED</div>
            <div className="text-red-300 break-all mt-1">{nyctlError}</div>
            <button
              onClick={() => {
                setNyctlState("idle");
                setNyctlError("");
              }}
              className="mt-2 text-zinc-500 hover:text-zinc-300 underline cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
