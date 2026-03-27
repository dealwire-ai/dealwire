"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { DashboardPageShell } from "@/components/dashboard-page-shell";
import { Badge } from "@/components/ui/badge";
import { guests, type Guest } from "./data";

// ── Constants ──────────────────────────────────────────────

const ALL_SEGMENTS: Guest["guestSegment"][] = [
  "loyalist",
  "planner",
  "impulse",
  "new",
];

const SEGMENT_LABELS: Record<Guest["guestSegment"], string> = {
  loyalist: "Loyalist",
  planner: "Planner",
  impulse: "Impulse",
  new: "New",
};

const ARRIVAL_OPTIONS = [
  { label: "Next 7d", days: 7 },
  { label: "Next 30d", days: 30 },
  { label: "Next 90d", days: 90 },
  { label: "All", days: 9999 },
];

const SYSTEM_PROMPT = `You are a guest intelligence analyst for Forever Wild (formerly Emerson Resort), a resort in the Catskill Mountains being repositioned to target younger demographics (20s-40s) — active travelers who hike, bike, and ski.

You have enriched guest profile data including: name, phone, total stays, total revenue, last stay date, next arrival date, nightly rate, nights booked, room type, booking lead time (days between reservation and check-in), guest segment (loyalist/planner/impulse/new), enrichment score (0-100, confidence of public data enrichment), occupation, company, estimated age, social presence level, VIP score (0-100, composite of revenue + loyalty + enrichment), and auto-generated tags.

Guest segments:
- Loyalist: 3+ stays, the core base — recognize and reward them
- Planner: Books 30+ days ahead — methodical, values certainty
- Impulse: Books 1-7 days ahead — spontaneous, high upsell potential
- New: First stay — make a great first impression

VIP score interpretation:
- 80-100: VIP — top-tier guests, personalized service mandatory
- 60-79: High value — strong guests, recognition opportunities
- 40-59: Standard — good guests, build the relationship
- 0-39: New/low engagement — welcome warmly, gather data

When asked about guests, provide actionable pre-arrival intelligence. Reference specific data points (occupation, company, age, booking pattern). Suggest personalized touches: room upgrades, welcome amenities, activity recommendations based on their profile. Keep responses concise and operational — this is for front desk staff preparing for arrivals.`;

const SUGGESTIONS = [
  "Who are the VIPs arriving this weekend?",
  "Which repeat guests haven't been back in 6+ months?",
  "Show me high-value guests under 40 for Forever Wild targeting",
  "What upsell opportunities exist for this week's arrivals?",
];

// ── Score Badges ───────────────────────────────────────────

function VipBadge({ score }: { score: number }) {
  let className: string;
  if (score >= 80) {
    className = "bg-purple-900/30 text-purple-400 border-purple-900/50";
  } else if (score >= 60) {
    className = "bg-blue-900/30 text-blue-400 border-blue-900/50";
  } else if (score >= 40) {
    className = "bg-zinc-800/50 text-zinc-400 border-zinc-700/50";
  } else {
    className = "bg-zinc-900/30 text-zinc-600 border-zinc-800/50";
  }
  return (
    <Badge className={`${className} font-mono text-xs tabular-nums`}>
      {score}
    </Badge>
  );
}

function EnrichmentBadge({ score }: { score: number }) {
  let className: string;
  if (score >= 80) {
    className = "bg-green-900/30 text-green-400 border-green-900/50";
  } else if (score >= 50) {
    className = "bg-yellow-900/30 text-yellow-400 border-yellow-900/50";
  } else {
    className = "bg-red-900/30 text-red-400 border-red-900/50";
  }
  return (
    <Badge className={`${className} font-mono text-xs tabular-nums`}>
      {score}%
    </Badge>
  );
}

function SegmentBadge({ segment }: { segment: Guest["guestSegment"] }) {
  const styles: Record<Guest["guestSegment"], string> = {
    loyalist: "bg-purple-900/20 text-purple-400 border-purple-900/40",
    planner: "bg-blue-900/20 text-blue-400 border-blue-900/40",
    impulse: "bg-orange-900/20 text-orange-400 border-orange-900/40",
    new: "bg-zinc-800/30 text-zinc-500 border-zinc-700/40",
  };
  return (
    <Badge
      className={`${styles[segment]} text-[10px] uppercase tracking-wider`}
    >
      {segment}
    </Badge>
  );
}

// ── Chat Message Type ──────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Main Page ──────────────────────────────────────────────

export default function DDHADemoPage() {
  // Filters
  const [selectedSegments, setSelectedSegments] =
    useState<Guest["guestSegment"][]>(ALL_SEGMENTS);
  const [minVip, setMinVip] = useState(0);
  const [minEnrichment, setMinEnrichment] = useState(0);
  const [arrivalDays, setArrivalDays] = useState(9999);

  // Sort
  const [sortCol, setSortCol] = useState<
    | "vipScore"
    | "enrichmentScore"
    | "totalRevenue"
    | "totalStays"
    | "nextArrival"
  >("vipScore");
  const [sortAsc, setSortAsc] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Filter guests
  const filtered = useMemo(() => {
    const refDate = new Date("2026-04-07");
    const cutoff = new Date(refDate);
    cutoff.setDate(cutoff.getDate() + arrivalDays);

    return guests
      .filter((g) => selectedSegments.includes(g.guestSegment))
      .filter((g) => g.vipScore >= minVip)
      .filter((g) => g.enrichmentScore >= minEnrichment)
      .filter((g) => {
        if (arrivalDays >= 9999) return true;
        const arrival = new Date(g.nextArrival);
        return arrival >= refDate && arrival <= cutoff;
      })
      .sort((a, b) => {
        const dir = sortAsc ? 1 : -1;
        if (sortCol === "nextArrival") {
          return (
            dir *
            (new Date(a.nextArrival).getTime() -
              new Date(b.nextArrival).getTime())
          );
        }
        return dir * ((a[sortCol] as number) - (b[sortCol] as number));
      });
  }, [selectedSegments, minVip, minEnrichment, arrivalDays, sortCol, sortAsc]);

  // Stats
  const vipCount = filtered.filter((g) => g.vipScore >= 80).length;
  const enrichedCount = filtered.filter((g) => g.enrichmentScore >= 50).length;
  const enrichmentRate =
    filtered.length > 0
      ? Math.round((enrichedCount / filtered.length) * 100)
      : 0;
  const repeatCount = filtered.filter((g) => g.totalStays >= 2).length;
  const avgRevenue =
    filtered.length > 0
      ? Math.round(
          filtered.reduce((s, g) => s + g.totalRevenue, 0) / filtered.length,
        )
      : 0;

  // Sort handler
  const handleSort = (col: typeof sortCol) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(false);
    }
  };

  const sortIndicator = (col: typeof sortCol) => {
    if (sortCol !== col) return "";
    return sortAsc ? " ▲" : " ▼";
  };

  // Chat handler
  const handleChat = async (prompt: string) => {
    if (!prompt.trim() || chatLoading) return;

    const contextGuests = filtered.slice(0, 30).map((g) => ({
      name: g.name,
      phone: g.phone,
      totalStays: g.totalStays,
      totalRevenue: g.totalRevenue,
      lastStay: g.lastStay,
      nextArrival: g.nextArrival,
      nightlyRate: g.nightlyRate,
      nights: g.nights,
      roomType: g.roomType,
      bookingLeadDays: g.bookingLeadDays,
      guestSegment: g.guestSegment,
      enrichmentScore: g.enrichmentScore,
      occupation: g.occupation,
      company: g.company,
      ageEstimate: g.ageEstimate,
      vipScore: g.vipScore,
      tags: g.tags,
    }));

    const fullPrompt = `Current filtered guest data (top 30 by sort):\n\n${JSON.stringify(contextGuests, null, 2)}\n\nActive filters: Segments = ${selectedSegments.join(", ")}, Min VIP = ${minVip}, Min Enrichment = ${minEnrichment}, Arrival window = ${arrivalDays >= 9999 ? "All" : `next ${arrivalDays}d`}\n\nToday's date: April 7, 2026\n\nQuestion: ${prompt}`;

    const newMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: prompt },
    ];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...newMessages.slice(0, -1).map((m) => ({
              role: m.role,
              content: m.content,
            })),
            { role: "user", content: fullPrompt },
          ],
        }),
      });

      if (!res.ok) throw new Error("Chat request failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          assistantContent += decoder.decode(value, { stream: true });
          setChatMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: assistantContent,
            };
            return updated;
          });
        }
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const toggleSegment = (seg: Guest["guestSegment"]) => {
    setSelectedSegments((prev) =>
      prev.includes(seg) ? prev.filter((s) => s !== seg) : [...prev, seg],
    );
  };

  return (
    <DashboardPageShell
      title=""
      actions={
        <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono border border-zinc-800 px-2.5 py-1 rounded">
          internal // confidential
        </span>
      }
    >
      {/* Header */}
      <div className="mb-6 pb-5 border-b border-zinc-800/60">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-wider text-zinc-400 uppercase font-mono">
              forever wild
            </h1>
            <p className="text-xs text-zinc-600 font-mono mt-1">
              guest intelligence // pre-arrival enrichment
            </p>
            <p className="text-[10px] text-green-500/70 font-mono mt-1.5">
              ● live — 120 guests enriched // 68% enrichment rate
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* Segment */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Guest Segment
          </label>
          <div className="flex gap-1.5">
            {ALL_SEGMENTS.map((seg) => (
              <button
                key={seg}
                onClick={() => toggleSegment(seg)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                  selectedSegments.includes(seg)
                    ? "bg-zinc-800 text-zinc-300 border-zinc-700"
                    : "bg-transparent text-zinc-600 border-zinc-800/60 hover:border-zinc-700"
                }`}
              >
                {SEGMENT_LABELS[seg]}
              </button>
            ))}
          </div>
        </div>

        {/* Min VIP Score */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Min VIP Score
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minVip}
              onChange={(e) => setMinVip(parseInt(e.target.value))}
              className="w-24 accent-zinc-500"
            />
            <span className="text-xs text-zinc-500 font-mono w-6">
              {minVip}
            </span>
          </div>
        </div>

        {/* Min Enrichment */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Min Enrichment
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minEnrichment}
              onChange={(e) => setMinEnrichment(parseInt(e.target.value))}
              className="w-24 accent-zinc-500"
            />
            <span className="text-xs text-zinc-500 font-mono w-8">
              {minEnrichment}%
            </span>
          </div>
        </div>

        {/* Arrival Window */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Arriving
          </label>
          <div className="flex gap-1.5">
            {ARRIVAL_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                onClick={() => setArrivalDays(opt.days)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors font-mono ${
                  arrivalDays === opt.days
                    ? "bg-zinc-800 text-zinc-300 border-zinc-700"
                    : "bg-transparent text-zinc-600 border-zinc-800/60 hover:border-zinc-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Guests in View", value: filtered.length.toString() },
          {
            label: "VIP Guests",
            value: vipCount.toString(),
            sub: "score ≥ 80",
          },
          {
            label: "Enrichment Rate",
            value: `${enrichmentRate}%`,
            sub: `${enrichedCount} enriched`,
          },
          {
            label: "Repeat Guests",
            value: repeatCount.toString(),
            sub: `avg $${avgRevenue.toLocaleString()} rev`,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-zinc-950/50 border border-zinc-800/60 rounded-md px-4 py-3"
          >
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
              {stat.label}
            </p>
            <p className="text-xl font-semibold text-zinc-200 font-mono mt-1">
              {stat.value}
            </p>
            {stat.sub && (
              <p className="text-[10px] text-zinc-600 font-mono">{stat.sub}</p>
            )}
          </div>
        ))}
      </div>

      {/* Section: Guest Profiles */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono font-medium">
          guest profiles
        </span>
        <div className="flex-1 h-px bg-zinc-800/60" />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-10 text-zinc-600 text-sm font-mono border border-dashed border-zinc-800 rounded-md">
          no matches // adjust filters
        </div>
      ) : (
        <div className="border border-zinc-800/60 rounded-md overflow-hidden mb-2">
          <div className="max-h-[440px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900 z-10">
                <tr className="border-b border-zinc-800/60">
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium">
                    Guest
                  </th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium">
                    Occupation
                  </th>
                  <th
                    className="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium cursor-pointer hover:text-zinc-400"
                    onClick={() => handleSort("totalStays")}
                  >
                    Stays{sortIndicator("totalStays")}
                  </th>
                  <th
                    className="text-right px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium cursor-pointer hover:text-zinc-400"
                    onClick={() => handleSort("totalRevenue")}
                  >
                    Revenue{sortIndicator("totalRevenue")}
                  </th>
                  <th
                    className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium cursor-pointer hover:text-zinc-400"
                    onClick={() => handleSort("nextArrival")}
                  >
                    Next Arrival{sortIndicator("nextArrival")}
                  </th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium">
                    Room
                  </th>
                  <th className="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium">
                    Segment
                  </th>
                  <th
                    className="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium cursor-pointer hover:text-zinc-400"
                    onClick={() => handleSort("enrichmentScore")}
                  >
                    Enrichment{sortIndicator("enrichmentScore")}
                  </th>
                  <th
                    className="text-center px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium cursor-pointer hover:text-zinc-400"
                    onClick={() => handleSort("vipScore")}
                  >
                    VIP{sortIndicator("vipScore")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((guest, i) => (
                  <tr
                    key={`${guest.name}-${i}`}
                    className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors"
                  >
                    <td className="px-3 py-2">
                      <div>
                        <span className="text-zinc-300 font-medium">
                          {guest.name}
                        </span>
                        <p className="text-[10px] text-zinc-600 font-mono">
                          {guest.phone}
                          {guest.ageEstimate && ` · ~${guest.ageEstimate}y`}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      {guest.occupation ? (
                        <div>
                          <span className="text-zinc-400 text-xs">
                            {guest.occupation}
                          </span>
                          {guest.company && (
                            <p className="text-[10px] text-zinc-600">
                              {guest.company}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-700 text-xs italic">
                          not enriched
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-zinc-500 font-mono text-xs">
                      {guest.totalStays}
                    </td>
                    <td className="px-3 py-2 text-right text-zinc-500 font-mono text-xs">
                      ${guest.totalRevenue.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-zinc-500 text-xs font-mono">
                      {guest.nextArrival}
                      <span className="text-zinc-700 ml-1">
                        ({guest.bookingLeadDays}d lead)
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-600 text-xs font-mono">
                      {guest.roomType}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <SegmentBadge segment={guest.guestSegment} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <EnrichmentBadge score={guest.enrichmentScore} />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <VipBadge score={guest.vipScore} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[10px] text-zinc-700 font-mono mb-8">
        {filtered.length} guests // sorted by{" "}
        {sortCol === "vipScore"
          ? "VIP score"
          : sortCol === "enrichmentScore"
            ? "enrichment"
            : sortCol === "totalRevenue"
              ? "revenue"
              : sortCol === "totalStays"
                ? "stays"
                : "arrival date"}{" "}
        {/* click column headers to sort */}
      </p>

      {/* Section: Analyst */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono font-medium">
          analyst
        </span>
        <div className="flex-1 h-px bg-zinc-800/60" />
      </div>

      {/* Chat */}
      <div className="border border-zinc-800/60 rounded-md bg-zinc-950/50 p-4 mb-3">
        {chatMessages.length === 0 ? (
          <p className="text-center text-zinc-700 text-sm font-mono italic py-4">
            ask about guest profiles, arrival prep, or upsell opportunities...
          </p>
        ) : (
          <div className="space-y-4 max-h-[300px] overflow-y-auto mb-4">
            {chatMessages.map((msg, i) => (
              <div key={i}>
                {msg.role === "user" ? (
                  <div className="mb-1">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
                      query
                    </span>
                    <p className="text-zinc-500 text-sm italic">
                      &ldquo;{msg.content}&rdquo;
                    </p>
                  </div>
                ) : (
                  <div className="text-zinc-400 text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                    {chatLoading && i === chatMessages.length - 1 && (
                      <span className="inline-block w-1.5 h-4 bg-zinc-500 animate-pulse ml-0.5 align-text-bottom" />
                    )}
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Suggestion chips */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => handleChat(suggestion)}
            disabled={chatLoading}
            className="text-left px-3 py-2 text-xs text-zinc-600 border border-zinc-800/60 rounded hover:border-zinc-700 hover:text-zinc-400 transition-colors disabled:opacity-50"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* Chat input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleChat(chatInput);
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Ask about guest profiles, arrivals, or personalization opportunities..."
          disabled={chatLoading}
          className="flex-1 px-3 py-2 text-sm bg-transparent border border-zinc-800 rounded text-zinc-300 placeholder:text-zinc-700 focus:outline-none focus:border-zinc-600 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={chatLoading || !chatInput.trim()}
          className="px-4 py-2 text-sm bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:hover:bg-zinc-800"
        >
          {chatLoading ? "..." : "Send"}
        </button>
      </form>

      {/* Footer */}
      <div className="mt-10 pt-3 border-t border-zinc-800/40 text-center">
        <p className="text-[10px] text-zinc-700 font-mono tracking-wider">
          forever wild guest intelligence // powered by dealwire
        </p>
      </div>
    </DashboardPageShell>
  );
}
