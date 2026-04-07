"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { DashboardPageShell } from "@/components/dashboard-page-shell";
import { Badge } from "@/components/ui/badge";
import { parcels, type Parcel } from "./data";

// ── Constants ──────────────────────────────────────────────

const ALL_TOWNS = [...new Set(parcels.map((p) => p.town))].sort();
const BELKNAP_TOWNS = ALL_TOWNS.filter(
  (t) => parcels.find((p) => p.town === t)?.county === "Belknap",
);
const CARROLL_TOWNS = ALL_TOWNS.filter(
  (t) => parcels.find((p) => p.town === t)?.county === "Carroll",
);

const LAND_USES: Parcel["land_use"][] = [
  "Vacant",
  "Residential",
  "Commercial",
  "Agricultural",
  "Industrial",
];

const SYSTEM_PROMPT = `You are a land development analyst for a real estate developer sourcing parcels in Belknap and Carroll County, New Hampshire.

The developer's workflow:
- Identifies vacant or underutilized parcels across NH towns
- Evaluates parcels based on zoning (residential, multifamily, mixed use), lot size, assessed value, and development potential
- Sends direct mail letters to landowners of promising parcels
- Focuses on parcels where the zoning supports the intended use and the land cost makes the project pencil

You have parcel data including: parcel ID, address, town, county, owner, acreage, land use (Vacant/Residential/Commercial/Agricultural/Industrial), assessed land value, assessed total value, last sale date/price, zoning district & description, minimum lot size, max building height, whether the zoning allows residential/multifamily/ADU, and a development score (0-100).

Development score interpretation:
- 70-100: Priority target — vacant land, good acreage, favorable zoning, low cost per acre
- 40-69: Worth investigating — some positive signals but may have constraints
- 0-39: Low priority — developed, poor zoning fit, or high cost

When asked for recommendations, return a ranked list (top 3-5) with 1-2 sentences per parcel explaining why. Reference specific data: acreage, zoning, assessed value, cost per acre, what the zoning allows. Be concise and actionable — this is for a developer who sends letters and needs to prioritize.`;

const SUGGESTIONS = [
  "What are the top development opportunities in Belknap County?",
  "Which towns have the most vacant land zoned for multifamily?",
  "Find parcels over 5 acres under $100k assessed value",
  "Compare Carroll vs Belknap for residential development",
];

// ── Score Badge ────────────────────────────────────────────

function DevScoreBadge({ score }: { score: number }) {
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

// ── Land Use Badge ─────────────────────────────────────────

function LandUseBadge({ use }: { use: string }) {
  const colors: Record<string, string> = {
    Vacant: "text-emerald-400",
    Residential: "text-blue-400",
    Commercial: "text-purple-400",
    Agricultural: "text-amber-400",
    Industrial: "text-zinc-400",
  };
  return (
    <span className={`text-xs ${colors[use] ?? "text-zinc-500"}`}>{use}</span>
  );
}

// ── Chat Message Type ──────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Sort State ─────────────────────────────────────────────

type SortField =
  | "development_score"
  | "acreage"
  | "assessed_total"
  | "town"
  | "land_use";

// ── Main Page ──────────────────────────────────────────────

export default function FroggyDemoPage() {
  // Filters
  const [selectedCounties, setSelectedCounties] = useState<string[]>([
    "Belknap",
    "Carroll",
  ]);
  const [selectedTowns, setSelectedTowns] = useState<string[]>(ALL_TOWNS);
  const [selectedLandUses, setSelectedLandUses] =
    useState<Parcel["land_use"][]>(LAND_USES);
  const [minAcreage, setMinAcreage] = useState(0);
  const [maxAssessed, setMaxAssessed] = useState(10000000);
  const [allowsMfOnly, setAllowsMfOnly] = useState(false);
  const [sortField, setSortField] = useState<SortField>("development_score");
  const [sortAsc, setSortAsc] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Sync town selection with county toggles
  useEffect(() => {
    const towns: string[] = [];
    if (selectedCounties.includes("Belknap")) towns.push(...BELKNAP_TOWNS);
    if (selectedCounties.includes("Carroll")) towns.push(...CARROLL_TOWNS);
    setSelectedTowns(towns);
  }, [selectedCounties]);

  // Filter parcels
  const filtered = useMemo(() => {
    const result = parcels
      .filter((p) => selectedCounties.includes(p.county))
      .filter((p) => selectedTowns.includes(p.town))
      .filter((p) => selectedLandUses.includes(p.land_use))
      .filter((p) => p.acreage >= minAcreage)
      .filter((p) => p.assessed_total <= maxAssessed)
      .filter((p) => !allowsMfOnly || p.allows_multifamily);

    return result.sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [
    selectedCounties,
    selectedTowns,
    selectedLandUses,
    minAcreage,
    maxAssessed,
    allowsMfOnly,
    sortField,
    sortAsc,
  ]);

  // Stats
  const priorityCount = filtered.filter(
    (p) => p.development_score >= 70,
  ).length;
  const totalAcreage = filtered.reduce((s, p) => s + p.acreage, 0);
  const avgPerAcre =
    filtered.length > 0
      ? Math.round(
          filtered.reduce((s, p) => s + p.assessed_land, 0) /
            Math.max(totalAcreage, 1),
        )
      : 0;

  // Chat handler
  const handleChat = async (prompt: string) => {
    if (!prompt.trim() || chatLoading) return;

    const contextParcels = filtered.slice(0, 30).map((p) => ({
      parcel_id: p.parcel_id,
      address: p.address,
      town: p.town,
      county: p.county,
      owner: p.owner,
      acreage: p.acreage,
      land_use: p.land_use,
      assessed_land: p.assessed_land,
      assessed_total: p.assessed_total,
      zoning_district: p.zoning_district,
      zoning_description: p.zoning_description,
      allows_residential: p.allows_residential,
      allows_multifamily: p.allows_multifamily,
      development_score: p.development_score,
    }));

    const fullPrompt = `Current filtered parcel data (top 30 by development score):\n\n${JSON.stringify(contextParcels, null, 2)}\n\nActive filters: Counties = ${selectedCounties.join(", ")}, Land uses = ${selectedLandUses.join(", ")}, Min acreage = ${minAcreage}, Max assessed = $${maxAssessed.toLocaleString()}, Multifamily only = ${allowsMfOnly}\n\nQuestion: ${prompt}`;

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

  const toggleCounty = (county: string) => {
    setSelectedCounties((prev) =>
      prev.includes(county)
        ? prev.filter((c) => c !== county)
        : [...prev, county],
    );
  };

  const toggleLandUse = (use: Parcel["land_use"]) => {
    setSelectedLandUses((prev) =>
      prev.includes(use) ? prev.filter((u) => u !== use) : [...prev, use],
    );
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortAsc ? " ▲" : " ▼") : "";

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
              froggy companies
            </h1>
            <p className="text-xs text-zinc-600 font-mono mt-1">
              parcel intelligence // belknap & carroll county, nh
            </p>
            <p className="text-[10px] text-green-500/70 font-mono mt-1.5">
              ● live — nh granit + zoning atlas
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        {/* County */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            County
          </label>
          <div className="flex gap-1.5">
            {["Belknap", "Carroll"].map((county) => (
              <button
                key={county}
                onClick={() => toggleCounty(county)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                  selectedCounties.includes(county)
                    ? "bg-zinc-800 text-zinc-300 border-zinc-700"
                    : "bg-transparent text-zinc-600 border-zinc-800/60 hover:border-zinc-700"
                }`}
              >
                {county}
              </button>
            ))}
          </div>
        </div>

        {/* Land Use */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Land Use
          </label>
          <div className="flex gap-1.5">
            {LAND_USES.map((use) => (
              <button
                key={use}
                onClick={() => toggleLandUse(use)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                  selectedLandUses.includes(use)
                    ? "bg-zinc-800 text-zinc-300 border-zinc-700"
                    : "bg-transparent text-zinc-600 border-zinc-800/60 hover:border-zinc-700"
                }`}
              >
                {use}
              </button>
            ))}
          </div>
        </div>

        {/* Min Acreage */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Min Acres
          </label>
          <input
            type="number"
            value={minAcreage || ""}
            onChange={(e) => setMinAcreage(parseFloat(e.target.value) || 0)}
            placeholder="0"
            className="w-20 px-2 py-1 text-xs bg-transparent border border-zinc-800 rounded text-zinc-400 font-mono"
          />
        </div>

        {/* Max Assessed */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Max Assessed
          </label>
          <input
            type="number"
            value={maxAssessed >= 10000000 ? "" : maxAssessed}
            onChange={(e) =>
              setMaxAssessed(parseInt(e.target.value) || 10000000)
            }
            placeholder="No limit"
            className="w-28 px-2 py-1 text-xs bg-transparent border border-zinc-800 rounded text-zinc-400 font-mono"
          />
        </div>

        {/* Multifamily Toggle */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Zoning
          </label>
          <button
            onClick={() => setAllowsMfOnly(!allowsMfOnly)}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              allowsMfOnly
                ? "bg-zinc-800 text-zinc-300 border-zinc-700"
                : "bg-transparent text-zinc-600 border-zinc-800/60 hover:border-zinc-700"
            }`}
          >
            Multifamily Only
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Parcels", value: filtered.length.toString() },
          {
            label: "Priority Targets",
            value: priorityCount.toString(),
            sub: "score >= 70",
          },
          {
            label: "Total Acreage",
            value: totalAcreage.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            }),
          },
          {
            label: "Avg Assessed $/Acre",
            value: `$${avgPerAcre.toLocaleString()}`,
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

      {/* Section: Parcels */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono font-medium">
          parcels
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
          <div className="max-h-[480px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900 z-10">
                <tr className="border-b border-zinc-800/60">
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium">
                    Parcel
                  </th>
                  <th
                    className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium cursor-pointer hover:text-zinc-400"
                    onClick={() => handleSort("town")}
                  >
                    Town{sortIndicator("town")}
                  </th>
                  <th
                    className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium cursor-pointer hover:text-zinc-400"
                    onClick={() => handleSort("acreage")}
                  >
                    Acres{sortIndicator("acreage")}
                  </th>
                  <th
                    className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium cursor-pointer hover:text-zinc-400"
                    onClick={() => handleSort("land_use")}
                  >
                    Use{sortIndicator("land_use")}
                  </th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium">
                    Zoning
                  </th>
                  <th
                    className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium cursor-pointer hover:text-zinc-400"
                    onClick={() => handleSort("assessed_total")}
                  >
                    Assessed{sortIndicator("assessed_total")}
                  </th>
                  <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium">
                    Owner
                  </th>
                  <th
                    className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium cursor-pointer hover:text-zinc-400"
                    onClick={() => handleSort("development_score")}
                  >
                    Score{sortIndicator("development_score")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((parcel, i) => (
                  <tr
                    key={`${parcel.parcel_id}-${i}`}
                    className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors"
                  >
                    <td className="px-3 py-2">
                      <div>
                        <span className="text-zinc-400 font-medium text-xs">
                          {parcel.address}
                        </span>
                        <p className="text-[10px] text-zinc-600 font-mono">
                          {parcel.parcel_id}
                        </p>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-zinc-500 text-xs">
                      {parcel.town}
                      <span className="text-zinc-700 ml-1 text-[10px]">
                        {parcel.county === "Belknap" ? "BK" : "CR"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-400 font-mono text-xs">
                      {parcel.acreage.toLocaleString()}
                    </td>
                    <td className="px-3 py-2">
                      <LandUseBadge use={parcel.land_use} />
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className="text-zinc-500 text-xs cursor-help"
                        title={`${parcel.zoning_description} | Min lot: ${(parcel.min_lot_size_sf / 43560).toFixed(1)} ac | Max height: ${parcel.max_building_height}ft | Res: ${parcel.allows_residential ? "Yes" : "No"} | MF: ${parcel.allows_multifamily ? "Yes" : "No"} | ADU: ${parcel.allows_adu ? "Yes" : "No"}`}
                      >
                        {parcel.zoning_district}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-500 font-mono text-xs">
                      ${parcel.assessed_total.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 text-xs max-w-[160px] truncate">
                      {parcel.owner}
                    </td>
                    <td className="px-3 py-2">
                      <DevScoreBadge score={parcel.development_score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[10px] text-zinc-700 font-mono mb-8">
        {filtered.length} parcels {"//"} sorted by {sortField.replace("_", " ")}{" "}
        {"//"} hover zoning for details
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
            query parcels, zoning, development potential, or specific towns...
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
          placeholder="Ask about parcels, zoning, towns, or development potential..."
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
          froggy companies parcel intelligence // powered by dealwire
        </p>
      </div>
    </DashboardPageShell>
  );
}
