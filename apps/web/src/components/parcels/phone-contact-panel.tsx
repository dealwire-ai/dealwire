"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Clipboard, Check, CheckCircle2 } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { useApi } from "@/hooks/use-api";
import type { OwnerPhone } from "./parcel-table";

type PhoneStatus = "GOOD" | "BAD" | "UNKNOWN";

interface PhoneNote {
  id: string;
  phoneNumber: string;
  status: PhoneStatus;
  note: string | null;
  userInitials: string;
  updatedAt: string;
}

interface PhoneContactPanelProps {
  bbl: string;
  phones: OwnerPhone[];
  emails: string[];
  onVerifiedPhoneChange?: (phone: string | null) => void;
}

export function PhoneContactPanel({
  bbl,
  phones,
  emails,
  onVerifiedPhoneChange,
}: PhoneContactPanelProps) {
  const { apiCall } = useApi();
  const { user } = useUser();
  const [notes, setNotes] = useState<Record<string, PhoneNote>>({});
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const initials =
    (
      (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "")
    ).toUpperCase() || "??";

  // Fetch existing notes on mount
  useEffect(() => {
    let cancelled = false;
    apiCall(`/public-data/parcels/${bbl}/phone-notes`)
      .then((data: { notes: PhoneNote[] }) => {
        if (cancelled) return;
        const map: Record<string, PhoneNote> = {};
        const localMap: Record<string, string> = {};
        for (const n of data.notes) {
          map[n.phoneNumber] = n;
          localMap[n.phoneNumber] = n.note ?? "";
        }
        setNotes(map);
        setLocalNotes(localMap);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, [bbl]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveNote = useCallback(
    async (phoneNumber: string, status?: PhoneStatus, note?: string) => {
      setSaving((s) => ({ ...s, [phoneNumber]: true }));
      try {
        const body: Record<string, string> = { phoneNumber };
        if (status !== undefined) body.status = status;
        if (note !== undefined) body.note = note;

        const data = await apiCall(`/public-data/parcels/${bbl}/phone-notes`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        setNotes((prev) => ({
          ...prev,
          [phoneNumber]: data.phoneNote,
        }));

        // Notify parent of verified phone change
        if (status === "GOOD") {
          onVerifiedPhoneChange?.(phoneNumber);
        } else if (status === "BAD" || status === "UNKNOWN") {
          const existing = notes[phoneNumber];
          if (existing?.status === "GOOD") {
            onVerifiedPhoneChange?.(null);
          }
        }
      } catch {
        // silently fail — user can retry
      } finally {
        setSaving((s) => ({ ...s, [phoneNumber]: false }));
      }
    },
    [bbl, notes, onVerifiedPhoneChange], // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  }

  function handleNoteFocus(phoneNumber: string) {
    const current = localNotes[phoneNumber] ?? "";
    if (!current) {
      const today = new Date();
      const prefix = `${initials} ${today.getMonth() + 1}/${today.getDate()} - `;
      setLocalNotes((prev) => ({ ...prev, [phoneNumber]: prefix }));
    }
  }

  function handleNoteBlur(phoneNumber: string) {
    const current = localNotes[phoneNumber] ?? "";
    const existing = notes[phoneNumber]?.note ?? "";
    if (current !== existing) {
      saveNote(phoneNumber, undefined, current);
    }
  }

  function handleStatusChange(phoneNumber: string, status: PhoneStatus) {
    const current = notes[phoneNumber]?.status;
    if (current === status) return;
    saveNote(phoneNumber, status);
  }

  if (!loaded) {
    return (
      <div className="text-xs text-zinc-500 py-1">Loading contact data...</div>
    );
  }

  return (
    <div className="space-y-2">
      {phones.map((p) => {
        const note = notes[p.number];
        const isSaving = saving[p.number];
        const status = note?.status ?? "UNKNOWN";

        return (
          <div key={p.number} className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              {/* Phone link */}
              <a
                href={`tel:${p.number}`}
                className="text-[#C8A96E] hover:underline font-medium"
              >
                {p.number}
              </a>
              <span className="text-zinc-600 capitalize">{p.type}</span>
              {p.isDnc && (
                <span className="text-red-400 text-[10px] font-medium px-1 py-0.5 bg-red-400/10 rounded">
                  DNC
                </span>
              )}
              {p.source && (
                <span className="text-zinc-700 text-[10px]">
                  {p.source === "skipsherpa" ? "sherpa" : p.source}
                </span>
              )}

              {/* Copy */}
              <button
                onClick={() => copyToClipboard(p.number)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Copy number"
              >
                {copiedText === p.number ? (
                  <Check className="w-3 h-3 text-green-500" />
                ) : (
                  <Clipboard className="w-3 h-3" />
                )}
              </button>

              {/* Divider */}
              <span className="text-zinc-700">|</span>

              {/* Good/Bad radios */}
              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name={`status-${p.number}`}
                  checked={status === "GOOD"}
                  onChange={() => handleStatusChange(p.number, "GOOD")}
                  className="sr-only"
                />
                <span
                  className={`w-3 h-3 rounded-full border transition-colors ${
                    status === "GOOD"
                      ? "bg-green-500 border-green-500"
                      : "border-zinc-600 hover:border-green-400"
                  }`}
                />
                <span
                  className={
                    status === "GOOD" ? "text-green-400" : "text-zinc-500"
                  }
                >
                  Good
                </span>
              </label>

              <label className="inline-flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  name={`status-${p.number}`}
                  checked={status === "BAD"}
                  onChange={() => handleStatusChange(p.number, "BAD")}
                  className="sr-only"
                />
                <span
                  className={`w-3 h-3 rounded-full border transition-colors ${
                    status === "BAD"
                      ? "bg-red-500 border-red-500"
                      : "border-zinc-600 hover:border-red-400"
                  }`}
                />
                <span
                  className={
                    status === "BAD" ? "text-red-400" : "text-zinc-500"
                  }
                >
                  Bad
                </span>
              </label>

              {/* Verified badge */}
              {status === "GOOD" && (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              )}

              {/* Saving indicator */}
              {isSaving && (
                <span className="text-zinc-600 text-[10px]">saving...</span>
              )}
            </div>

            {/* Note input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={localNotes[p.number] ?? ""}
                onFocus={() => handleNoteFocus(p.number)}
                onBlur={() => handleNoteBlur(p.number)}
                onChange={(e) =>
                  setLocalNotes((prev) => ({
                    ...prev,
                    [p.number]: e.target.value,
                  }))
                }
                placeholder="Add note..."
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
              />
              {note && (
                <span className="text-[10px] text-zinc-600 whitespace-nowrap">
                  {note.userInitials}{" "}
                  {new Date(note.updatedAt).toLocaleDateString("en-US", {
                    month: "numeric",
                    day: "numeric",
                  })}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Emails (passthrough from existing display) */}
      {emails.map((email) => (
        <div key={email} className="flex items-center gap-2 text-xs">
          <a href={`mailto:${email}`} className="text-zinc-300 hover:underline">
            {email}
          </a>
          <button
            onClick={() => copyToClipboard(email)}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Copy email"
          >
            {copiedText === email ? (
              <Check className="w-3 h-3 text-green-500" />
            ) : (
              <Clipboard className="w-3 h-3" />
            )}
          </button>
        </div>
      ))}
    </div>
  );
}
