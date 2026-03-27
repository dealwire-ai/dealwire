"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { DashboardPageShell } from "@/components/dashboard-page-shell";
import { Badge } from "@/components/ui/badge";
import { hotels, type Hotel } from "./data";

// ── Constants ──────────────────────────────────────────────

const PRICE_LABELS: Record<number, string> = {
  1: "$",
  2: "$$",
  3: "$$$",
  4: "$$$$",
};
const ALL_CITIES = [...new Set(hotels.map((h) => h.city))].sort();

const SYSTEM_PROMPT = `You are a hotel acquisition analyst for Bohopo, a boutique hotel investor targeting underperforming properties in European city centers.

Bohopo's acquisition criteria:
- Small boutique hotels: 20-50 rooms
- City center locations in Athens, Thessaloniki, Marseille, Brussels, Porto, and similar European markets
- Underperforming operators: low ratings (below 3.7) with substantial review volume (100+ reviews)
- Price level 2-3 (mid-range, not budget chains or luxury)
- Goal: acquire, redesign, and operate as upscale boutique properties

You have hotel data including: name, city, rating (1-5 stars), review count, price level, room count, average nightly rate (EUR), sub-ratings (cleanliness, service, location, value), review trend, and acquisition score (0-100, where higher = stronger acquisition signal based on low rating + high review confidence + room count fit).

Score interpretation:
- 70-100: Priority target -- consistently bad operator, high review confidence, strong acquisition signal
- 40-69: Watch list -- some signal, monitor for distress or ownership change
- 0-39: Healthy -- not an acquisition candidate

When asked for targets, return a ranked list (top 3-5) with 1-2 sentences of reasoning per property. Be specific: reference the rating, review count, room count, nightly rate, and what the signal implies about the operator. Keep responses concise and actionable.`;

const SUGGESTIONS = [
  "What are the top 3 hotels I should approach in Athens?",
  "Which city has the strongest acquisition pipeline right now?",
  "Compare the operator quality in Athens vs Brussels",
  "Find me priority targets under 30 rooms",
];

// ── Score Badge ────────────────────────────────────────────

function AcquisitionBadge({ score }: { score: number }) {
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

// ── Trend Icon ─────────────────────────────────────────────

function TrendIcon({ trend }: { trend: string }) {
  if (trend === "declining") return <span className="text-red-400">▼</span>;
  if (trend === "improving") return <span className="text-green-400">▲</span>;
  return <span className="text-zinc-600">—</span>;
}

function RatingChange({ change }: { change: number }) {
  let color: string;
  let icon: string;
  if (change <= -0.2) {
    color = "text-red-500";
    icon = "▼";
  } else if (change < 0) {
    color = "text-red-400";
    icon = "▼";
  } else if (change === 0) {
    color = "text-zinc-600";
    icon = "—";
  } else if (change < 0.2) {
    color = "text-green-300";
    icon = "▲";
  } else {
    color = "text-green-400";
    icon = "▲";
  }
  const sign = change > 0 ? "+" : "";
  return (
    <span className={`${color} font-mono text-xs`}>
      {icon} {sign}
      {change.toFixed(2)}
    </span>
  );
}

// ── Rating with tooltip ────────────────────────────────────

function RatingCell({ hotel }: { hotel: Hotel }) {
  const color =
    hotel.rating < 3.0
      ? "text-red-400"
      : hotel.rating < 3.7
        ? "text-yellow-400"
        : "text-zinc-500";
  return (
    <span
      className={`${color} font-mono text-sm font-medium cursor-help`}
      title={`Cleanliness: ${hotel.cleanliness_rating} | Service: ${hotel.service_rating} | Location: ${hotel.location_rating} | Value: ${hotel.value_rating}`}
    >
      {hotel.rating.toFixed(1)}
    </span>
  );
}

// ── Chat Message Type ──────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Main Page ──────────────────────────────────────────────

export default function BohopoDemoPage() {
  // Filters
  const [selectedCities, setSelectedCities] = useState<string[]>(ALL_CITIES);
  const [maxRating, setMaxRating] = useState(5.0);
  const [minReviews, setMinReviews] = useState(50);
  const [roomMin, setRoomMin] = useState(15);
  const [roomMax, setRoomMax] = useState(60);
  const [selectedPriceLevels, setSelectedPriceLevels] = useState<number[]>([
    2, 3,
  ]);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Filter hotels
  const filtered = useMemo(() => {
    return hotels
      .filter((h) => selectedCities.includes(h.city))
      .filter((h) => h.rating <= maxRating)
      .filter((h) => h.review_count >= minReviews)
      .filter((h) => selectedPriceLevels.includes(h.price_level))
      .filter((h) => h.room_count >= roomMin && h.room_count <= roomMax)
      .sort((a, b) => b.acquisition_score - a.acquisition_score);
  }, [
    selectedCities,
    maxRating,
    minReviews,
    roomMin,
    roomMax,
    selectedPriceLevels,
  ]);

  // Stats
  const priorityCount = filtered.filter(
    (h) => h.acquisition_score >= 70,
  ).length;
  const avgScore =
    filtered.length > 0
      ? Math.round(
          filtered.reduce((s, h) => s + h.acquisition_score, 0) /
            filtered.length,
        )
      : 0;
  const avgRate =
    filtered.length > 0
      ? Math.round(
          filtered.reduce((s, h) => s + h.avg_nightly_rate, 0) /
            filtered.length,
        )
      : 0;

  // Chat handler
  const handleChat = async (prompt: string) => {
    if (!prompt.trim() || chatLoading) return;

    const contextHotels = filtered.slice(0, 30).map((h) => ({
      name: h.name,
      city: h.city,
      rating: h.rating,
      review_count: h.review_count,
      price_level: h.price_level,
      room_count: h.room_count,
      avg_nightly_rate: h.avg_nightly_rate,
      cleanliness_rating: h.cleanliness_rating,
      service_rating: h.service_rating,
      value_rating: h.value_rating,
      rating_trend: h.rating_trend,
      acquisition_score: h.acquisition_score,
    }));

    const fullPrompt = `Current filtered hotel data (top 30 by acquisition score):\n\n${JSON.stringify(contextHotels, null, 2)}\n\nActive filters: Cities = ${selectedCities.join(", ") || "All"}, Max rating = ${maxRating}, Min reviews = ${minReviews}, Room count = ${roomMin}-${roomMax}\n\nQuestion: ${prompt}`;

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

  const toggleCity = (city: string) => {
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city],
    );
  };

  const togglePrice = (level: number) => {
    setSelectedPriceLevels((prev) =>
      prev.includes(level) ? prev.filter((p) => p !== level) : [...prev, level],
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
              bohopo
            </h1>
            <p className="text-xs text-zinc-600 font-mono mt-1">
              acquisition intelligence // eu city centers
            </p>
            <p className="text-[10px] text-green-500/70 font-mono mt-1.5">
              ● live — last sync 4m ago
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Cities */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Cities
          </label>
          <div className="flex gap-1.5">
            {ALL_CITIES.map((city) => (
              <button
                key={city}
                onClick={() => toggleCity(city)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                  selectedCities.includes(city)
                    ? "bg-zinc-800 text-zinc-300 border-zinc-700"
                    : "bg-transparent text-zinc-600 border-zinc-800/60 hover:border-zinc-700"
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        </div>

        {/* Max Rating */}
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

        {/* Min Reviews */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Min Reviews
          </label>
          <input
            type="number"
            value={minReviews}
            onChange={(e) => setMinReviews(parseInt(e.target.value) || 0)}
            className="w-20 px-2 py-1 text-xs bg-transparent border border-zinc-800 rounded text-zinc-400 font-mono"
          />
        </div>

        {/* Room Count */}
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

        {/* Price Level */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Price
          </label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((level) => (
              <button
                key={level}
                onClick={() => togglePrice(level)}
                className={`px-2 py-1 text-xs rounded border transition-colors font-mono ${
                  selectedPriceLevels.includes(level)
                    ? "bg-zinc-800 text-zinc-300 border-zinc-700"
                    : "bg-transparent text-zinc-600 border-zinc-800/60 hover:border-zinc-700"
                }`}
              >
                {PRICE_LABELS[level]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Properties Monitored", value: filtered.length.toString() },
          {
            label: "Priority Targets",
            value: priorityCount.toString(),
            sub: "score >= 70",
          },
          { label: "Avg Acquisition Score", value: avgScore.toString() },
          { label: "Avg Nightly Rate", value: `€${avgRate}` },
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

      {/* Section: Targets */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono font-medium">
          targets
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
                  {[
                    "Property",
                    "City",
                    "Rooms",
                    "Rating",
                    "30d Δ",
                    "Reviews",
                    "Avg Rate",
                    "Price",
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
                {filtered.map((hotel, i) => (
                  <tr
                    key={`${hotel.name}-${hotel.city}-${i}`}
                    className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors"
                  >
                    <td className="px-3 py-2">
                      <a
                        href={hotel.maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-400 hover:text-zinc-200 font-medium transition-colors"
                      >
                        {hotel.name}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-zinc-500 text-xs">
                      {hotel.flag} {hotel.city}
                    </td>
                    <td className="px-3 py-2 text-zinc-500 font-mono text-xs text-center">
                      {hotel.room_count}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5">
                        <RatingCell hotel={hotel} />
                        <TrendIcon trend={hotel.rating_trend} />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <RatingChange change={hotel.rating_30d_change} />
                    </td>
                    <td className="px-3 py-2 text-zinc-600 font-mono text-xs text-right">
                      {hotel.review_count.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 font-mono text-xs">
                      €{Math.round(hotel.avg_nightly_rate)}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 text-xs">
                      {PRICE_LABELS[hotel.price_level]}
                    </td>
                    <td className="px-3 py-2">
                      <AcquisitionBadge score={hotel.acquisition_score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[10px] text-zinc-700 font-mono mb-8">
        {filtered.length} properties // sorted by acquisition score // hover
        rating for breakdown // click property for map
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
            query targets, markets, or operator risk signals...
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
          placeholder="Ask about acquisition targets, market conditions, or specific cities..."
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
          bohopo acquisition intelligence // powered by dealwire
        </p>
      </div>
    </DashboardPageShell>
  );
}
