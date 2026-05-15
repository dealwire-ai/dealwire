"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { DashboardPageShell } from "@/components/dashboard-page-shell";
import { Badge } from "@/components/ui/badge";
import {
  hotels,
  type ParisHotel,
  type OwnerType,
  type DistressFlag,
} from "./data";

// ── Constants ──────────────────────────────────────────────

const ALL_ARRONDISSEMENTS = [
  ...new Set(hotels.map((h) => h.arrondissement)),
].sort((a, b) => parseInt(a) - parseInt(b));

const OWNER_LABELS: Record<OwnerType, string> = {
  family: "Family",
  corporate: "Corporate",
  fund: "Fund",
};

const DISTRESS_LABELS: Record<DistressFlag, string> = {
  none: "—",
  tax: "Tax",
  legal: "Legal",
  maintenance: "Péril",
  operating: "Ops",
};

const SYSTEM_PROMPT = `You are a Paris hotel acquisition analyst for Bohopo. You triage classified Paris hotels for acquisition based on French public-data signals.

Bohopo's Paris buy box:
- 1-3 star classified hotels, 15-50 rooms, anywhere in Paris (1er-20e)
- Strongest targets: family-owned operators with aging directors (succession risk), long hold duration, operational underperformance (rating < 3.7 with meaningful review volume), or filed distress (BODACC procédures, péril orders, tax/URSSAF liens)
- Fund-owned properties past 4-year holds are also strong (forced-timing exits)

Each row gives you: name, arrondissement, star rating, room count, booking rating (1-5), review count, avg nightly rate (EUR), owner_type (family/corporate/fund), director_age (years), years_held, building_year, distress_flag (none/tax/legal/maintenance/operating), rating_trend, rating_30d_change, bohopo_score (0-99), and SIREN (French company ID).

Score interpretation:
- 70-99: Priority target — multiple buy-box pillars hit (succession + distress, or fund-timing + low rating, etc.)
- 40-69: Watch list — one strong signal, monitor
- 0-39: Healthy — not a candidate

When asked for targets, return a ranked list (top 3-5) with 1-2 sentences each. Be specific: cite the arrondissement, the operator's owner type and director age, hold duration, any distress flag, and what it implies. Reference SIREN where useful. Keep it concise and actionable — Bohopo's team uses this to prioritize outreach.`;

const SUGGESTIONS = [
  "Top 5 succession targets right now",
  "Which family hotels are also showing distress signals?",
  "Find fund-owned hotels past their typical hold window",
  "Best operational underperformers in the Marais (3e/4e)",
];

// ── Badges ─────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  let className: string;
  if (score >= 70) {
    className = "bg-red-900/30 text-red-400 border-red-900/50";
  } else if (score >= 40) {
    className = "bg-yellow-900/30 text-yellow-400 border-yellow-900/50";
  } else {
    className = "bg-green-900/30 text-green-400 border-green-900/50";
  }
  return (
    <Badge className={`${className} font-mono text-xs tabular-nums`}>
      {score}
    </Badge>
  );
}

function OwnerBadge({ type }: { type: OwnerType }) {
  const cls =
    type === "family"
      ? "text-amber-400/80"
      : type === "fund"
        ? "text-purple-400/80"
        : "text-zinc-500";
  return (
    <span className={`text-xs font-mono ${cls}`}>{OWNER_LABELS[type]}</span>
  );
}

function DistressBadge({ flag }: { flag: DistressFlag }) {
  if (flag === "none") return <span className="text-zinc-700 text-xs">—</span>;
  const cls =
    flag === "legal"
      ? "text-red-400"
      : flag === "tax"
        ? "text-orange-400"
        : flag === "maintenance"
          ? "text-yellow-400"
          : "text-zinc-400";
  return (
    <span className={`text-xs font-mono ${cls}`}>{DISTRESS_LABELS[flag]}</span>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="text-yellow-500/80 text-xs font-mono">
      {"★".repeat(n)}
      <span className="text-zinc-800">{"★".repeat(Math.max(0, 5 - n))}</span>
    </span>
  );
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "declining") return <span className="text-red-400">▼</span>;
  if (trend === "improving") return <span className="text-green-400">▲</span>;
  return <span className="text-zinc-600">—</span>;
}

function RatingCell({ hotel }: { hotel: ParisHotel }) {
  const color =
    hotel.rating < 3.4
      ? "text-red-400"
      : hotel.rating < 3.8
        ? "text-yellow-400"
        : "text-zinc-500";
  return (
    <span className={`${color} font-mono text-sm font-medium`}>
      {hotel.rating.toFixed(1)}
    </span>
  );
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Main Page ──────────────────────────────────────────────

export default function BohopoParisDemoPage() {
  const [selectedArrs, setSelectedArrs] =
    useState<string[]>(ALL_ARRONDISSEMENTS);
  const [selectedStars, setSelectedStars] = useState<number[]>([1, 2, 3]);
  const [selectedOwners, setSelectedOwners] = useState<OwnerType[]>([
    "family",
    "corporate",
    "fund",
  ]);
  const [roomMin, setRoomMin] = useState(15);
  const [roomMax, setRoomMax] = useState(55);
  const [maxRating, setMaxRating] = useState(5.0);
  const [distressOnly, setDistressOnly] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const filtered = useMemo(() => {
    return hotels
      .filter((h) => selectedArrs.includes(h.arrondissement))
      .filter((h) => selectedStars.includes(h.stars))
      .filter((h) => selectedOwners.includes(h.owner_type))
      .filter((h) => h.rooms >= roomMin && h.rooms <= roomMax)
      .filter((h) => h.rating <= maxRating)
      .filter((h) => (distressOnly ? h.distress_flag !== "none" : true))
      .sort((a, b) => b.bohopo_score - a.bohopo_score);
  }, [
    selectedArrs,
    selectedStars,
    selectedOwners,
    roomMin,
    roomMax,
    maxRating,
    distressOnly,
  ]);

  const priorityCount = filtered.filter((h) => h.bohopo_score >= 70).length;
  const successionCount = filtered.filter(
    (h) => h.owner_type === "family" && h.director_age >= 65,
  ).length;
  const distressCount = filtered.filter(
    (h) => h.distress_flag !== "none",
  ).length;
  const avgScore =
    filtered.length > 0
      ? Math.round(
          filtered.reduce((s, h) => s + h.bohopo_score, 0) / filtered.length,
        )
      : 0;

  const handleChat = async (prompt: string) => {
    if (!prompt.trim() || chatLoading) return;

    const ctx = filtered.slice(0, 30).map((h) => ({
      name: h.name,
      arrondissement: h.arrondissement,
      stars: h.stars,
      rooms: h.rooms,
      rating: h.rating,
      review_count: h.review_count,
      avg_nightly_rate: h.avg_nightly_rate,
      owner_type: h.owner_type,
      director_age: h.director_age,
      years_held: h.years_held,
      building_year: h.building_year,
      distress_flag: h.distress_flag,
      rating_trend: h.rating_trend,
      bohopo_score: h.bohopo_score,
      siren: h.siren,
    }));

    const fullPrompt = `Current filtered Paris hotel data (top 30 by Bohopo score):\n\n${JSON.stringify(ctx, null, 2)}\n\nActive filters: arrondissements=${selectedArrs.length}/20, stars=${selectedStars.join(",")}, owners=${selectedOwners.join(",")}, rooms=${roomMin}-${roomMax}, max_rating=${maxRating}, distress_only=${distressOnly}\n\nQuestion: ${prompt}`;

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

  const toggleArr = (arr: string) => {
    setSelectedArrs((prev) =>
      prev.includes(arr) ? prev.filter((a) => a !== arr) : [...prev, arr],
    );
  };

  const toggleStar = (n: number) => {
    setSelectedStars((prev) =>
      prev.includes(n) ? prev.filter((s) => s !== n) : [...prev, n],
    );
  };

  const toggleOwner = (o: OwnerType) => {
    setSelectedOwners((prev) =>
      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o],
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
              bohopo — paris
            </h1>
            <p className="text-xs text-zinc-600 font-mono mt-1">
              acquisition intelligence // classified hotels // 1er–20e
            </p>
            <p className="text-[10px] text-green-500/70 font-mono mt-1.5">
              ● live — sirene + inpi + bodacc + dvf + atout france // synced 6m
              ago
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Arrondissement
          </label>
          <div className="flex flex-wrap gap-1 max-w-xl">
            {ALL_ARRONDISSEMENTS.map((arr) => (
              <button
                key={arr}
                onClick={() => toggleArr(arr)}
                className={`px-2 py-0.5 text-[11px] rounded border transition-colors font-mono ${
                  selectedArrs.includes(arr)
                    ? "bg-zinc-800 text-zinc-300 border-zinc-700"
                    : "bg-transparent text-zinc-600 border-zinc-800/60 hover:border-zinc-700"
                }`}
              >
                {arr}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Stars
          </label>
          <div className="flex gap-1.5">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                onClick={() => toggleStar(n)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors font-mono ${
                  selectedStars.includes(n)
                    ? "bg-zinc-800 text-zinc-300 border-zinc-700"
                    : "bg-transparent text-zinc-600 border-zinc-800/60 hover:border-zinc-700"
                }`}
              >
                {n}★
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Owner
          </label>
          <div className="flex gap-1.5">
            {(["family", "corporate", "fund"] as OwnerType[]).map((o) => (
              <button
                key={o}
                onClick={() => toggleOwner(o)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                  selectedOwners.includes(o)
                    ? "bg-zinc-800 text-zinc-300 border-zinc-700"
                    : "bg-transparent text-zinc-600 border-zinc-800/60 hover:border-zinc-700"
                }`}
              >
                {OWNER_LABELS[o]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Rooms
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              value={roomMin}
              onChange={(e) => setRoomMin(parseInt(e.target.value) || 10)}
              className="w-14 px-2 py-1 text-xs bg-transparent border border-zinc-800 rounded text-zinc-400 font-mono"
            />
            <span className="text-zinc-700">–</span>
            <input
              type="number"
              value={roomMax}
              onChange={(e) => setRoomMax(parseInt(e.target.value) || 80)}
              className="w-14 px-2 py-1 text-xs bg-transparent border border-zinc-800 rounded text-zinc-400 font-mono"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Max Rating
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={1}
              max={5}
              step={0.1}
              value={maxRating}
              onChange={(e) => setMaxRating(parseFloat(e.target.value))}
              className="w-24 accent-zinc-500"
            />
            <span className="text-xs text-zinc-500 font-mono w-8">
              {maxRating.toFixed(1)}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Distress
          </label>
          <button
            onClick={() => setDistressOnly((v) => !v)}
            className={`px-2.5 py-1 text-xs rounded border transition-colors font-mono ${
              distressOnly
                ? "bg-red-900/30 text-red-400 border-red-900/50"
                : "bg-transparent text-zinc-600 border-zinc-800/60 hover:border-zinc-700"
            }`}
          >
            flagged only
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Hotels Monitored", value: filtered.length.toString() },
          {
            label: "Priority Targets",
            value: priorityCount.toString(),
            sub: "score ≥ 70",
          },
          {
            label: "Succession Candidates",
            value: successionCount.toString(),
            sub: "family + director ≥ 65",
          },
          {
            label: "Distress Flagged",
            value: distressCount.toString(),
            sub: "bodacc / péril",
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

      <p className="text-[10px] text-zinc-700 font-mono mb-4">
        avg bohopo score across filter: {avgScore}
      </p>

      {/* Section: Targets */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono font-medium">
          targets
        </span>
        <div className="flex-1 h-px bg-zinc-800/60" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-zinc-600 text-sm font-mono border border-dashed border-zinc-800 rounded-md">
          no matches // adjust filters
        </div>
      ) : (
        <div className="border border-zinc-800/60 rounded-md overflow-hidden mb-2">
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900 z-10">
                <tr className="border-b border-zinc-800/60">
                  {[
                    "Property",
                    "Arr.",
                    "★",
                    "Rooms",
                    "Owner",
                    "Director",
                    "Held",
                    "Rating",
                    "Reviews",
                    "Rate",
                    "Distress",
                    "Score",
                  ].map((header) => (
                    <th
                      key={header}
                      className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((h, i) => (
                  <tr
                    key={`${h.name}-${i}`}
                    className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors"
                  >
                    <td className="px-3 py-2">
                      <a
                        href={h.maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-400 hover:text-zinc-200 font-medium transition-colors"
                        title={`SIREN ${h.siren} // built ${h.building_year}`}
                      >
                        {h.name}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-zinc-500 font-mono text-xs">
                      {h.arrondissement}
                    </td>
                    <td className="px-3 py-2">
                      <Stars n={h.stars} />
                    </td>
                    <td className="px-3 py-2 text-zinc-500 font-mono text-xs text-center">
                      {h.rooms}
                    </td>
                    <td className="px-3 py-2">
                      <OwnerBadge type={h.owner_type} />
                    </td>
                    <td className="px-3 py-2 text-zinc-500 font-mono text-xs text-center">
                      {h.director_age}y
                    </td>
                    <td className="px-3 py-2 text-zinc-500 font-mono text-xs text-center">
                      {h.years_held}y
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5">
                        <RatingCell hotel={h} />
                        <TrendIcon trend={h.rating_trend} />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-600 font-mono text-xs text-right">
                      {h.review_count.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 font-mono text-xs">
                      €{h.avg_nightly_rate}
                    </td>
                    <td className="px-3 py-2">
                      <DistressBadge flag={h.distress_flag} />
                    </td>
                    <td className="px-3 py-2">
                      <ScoreBadge score={h.bohopo_score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[10px] text-zinc-700 font-mono mb-8">
        {filtered.length} hotels // sorted by bohopo score // hover property for
        siren + build year // click for map
      </p>

      {/* Section: Analyst */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono font-medium">
          analyst
        </span>
        <div className="flex-1 h-px bg-zinc-800/60" />
      </div>

      <div className="border border-zinc-800/60 rounded-md bg-zinc-950/50 p-4 mb-3">
        {chatMessages.length === 0 ? (
          <p className="text-center text-zinc-700 text-sm font-mono italic py-4">
            query succession, distress, or operator risk across paris...
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
          placeholder="Ask about succession, distress signals, fund exits, or specific arrondissements..."
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

      <div className="mt-10 pt-3 border-t border-zinc-800/40 text-center">
        <p className="text-[10px] text-zinc-700 font-mono tracking-wider">
          bohopo paris acquisition intelligence // powered by dealwire
        </p>
      </div>
    </DashboardPageShell>
  );
}
