"use client";

import { useCallback, useEffect, useState } from "react";
import { Phone, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";

type ActivityType =
  | "CALL"
  | "NOTE"
  | "STAGE_CHANGED"
  | "ASSIGNED"
  | "UNASSIGNED"
  | "FOLLOWUP_SCHEDULED"
  | "FOLLOWUP_COMPLETED"
  | "PHONE_STATUS_CHANGED";

interface Activity {
  id: string;
  type: ActivityType;
  body: string | null;
  phoneNumber: string | null;
  phoneStatus: "GOOD" | "BAD" | "UNKNOWN" | null;
  userInitials: string;
  userId: string | null;
  metadata: Record<string, unknown> | null;
  occurredAt: string;
}

interface ActivityPanelProps {
  bbl: string;
}

export function ActivityPanel({ bbl }: ActivityPanelProps) {
  const { apiCall } = useApi();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftType, setDraftType] = useState<"CALL" | "NOTE">("CALL");
  const [draftBody, setDraftBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = (await apiCall(`/public-data/crm/activities/${bbl}`)) as {
        activities: Activity[];
      };
      setActivities(res.activities);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load activity");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbl]);

  useEffect(() => {
    load();
  }, [load]);

  async function handlePost() {
    if (!draftBody.trim() && draftType === "NOTE") return;
    setPosting(true);
    setError(null);
    try {
      await apiCall(`/public-data/crm/activities/${bbl}`, {
        method: "POST",
        body: JSON.stringify({
          type: draftType,
          body: draftBody.trim() || null,
        }),
      });
      setDraftBody("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log activity");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Activity
        </h4>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          aria-label="Refresh"
          className="cursor-pointer text-zinc-500 transition-colors hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-30"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {error && (
        <div className="mb-2 rounded border border-red-900/50 bg-red-950/30 p-2 text-xs text-red-400">
          {error}
        </div>
      )}

      <div className="mb-3 space-y-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDraftType("CALL")}
            className={`inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
              draftType === "CALL"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
            }`}
          >
            <Phone className="h-3 w-3" /> Call
          </button>
          <button
            type="button"
            onClick={() => setDraftType("NOTE")}
            className={`inline-flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors ${
              draftType === "NOTE"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
            }`}
          >
            <FileText className="h-3 w-3" /> Note
          </button>
        </div>
        <textarea
          value={draftBody}
          onChange={(e) => setDraftBody(e.target.value)}
          placeholder={
            draftType === "CALL"
              ? "What happened on the call? (optional)"
              : "Note…"
          }
          rows={2}
          className="w-full resize-none rounded border border-zinc-800 bg-zinc-900 p-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handlePost}
            disabled={posting || (draftType === "NOTE" && !draftBody.trim())}
          >
            {posting ? "Logging…" : `Log ${draftType.toLowerCase()}`}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        {activities.length === 0 && !loading && (
          <div className="py-4 text-center text-xs text-zinc-600">
            No activity yet. Log a call or note above.
          </div>
        )}
        {activities.map((a) => (
          <ActivityRow key={a.id} activity={a} />
        ))}
      </div>
    </div>
  );
}

function ActivityRow({ activity }: { activity: Activity }) {
  const occurred = new Date(activity.occurredAt);
  return (
    <div className="flex items-start gap-2 rounded border border-zinc-800/50 bg-zinc-900/30 p-2 text-xs">
      <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[9px] font-semibold text-zinc-200">
        {activity.userInitials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2 text-zinc-400">
          <span>{describeActivity(activity)}</span>
          <span className="text-zinc-600">{occurred.toLocaleString()}</span>
        </div>
        {activity.body && (
          <div className="mt-1 whitespace-pre-wrap text-zinc-300">
            {activity.body}
          </div>
        )}
      </div>
    </div>
  );
}

// Render a one-line summary per activity type. System events (stage moves,
// assignments) render to a verb-phrase; user events (call/note) just label
// the type and let the body carry the detail.
function describeActivity(a: Activity): string {
  switch (a.type) {
    case "CALL":
      return a.phoneNumber ? `called ${a.phoneNumber}` : "logged a call";
    case "NOTE":
      return "noted";
    case "STAGE_CHANGED": {
      const name = (a.metadata?.["toStageName"] as string | undefined) ?? null;
      return name ? `moved to ${name}` : "changed stage";
    }
    case "ASSIGNED":
      return "assigned this parcel";
    case "UNASSIGNED":
      return "unassigned this parcel";
    case "FOLLOWUP_SCHEDULED":
      return "scheduled a follow-up";
    case "FOLLOWUP_COMPLETED":
      return "completed follow-up";
    case "PHONE_STATUS_CHANGED":
      return a.phoneNumber
        ? `marked ${a.phoneNumber} ${a.phoneStatus?.toLowerCase()}`
        : "updated phone status";
  }
  // Exhaustive switch above; this branch is only reached if the API adds a new
  // ActivityType the client doesn't yet know about — show the raw type so the
  // user at least sees it landed.
  return (a as { type: string }).type.toLowerCase();
}
