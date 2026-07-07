"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { loadParcels, isPinelandsRestrictive, type NjParcel } from "./data";
import { NjMap, scoreColor } from "./nj-map";
import { ScoreHistogram, CountyBars } from "./charts";
import { ParcelDetailSheet } from "./detail-sheet";

// ── Constants ──────────────────────────────────────────────

const PAGE_SIZE = 100;

const SYSTEM_PROMPT = `You are a land acquisition analyst for Denholtz Properties, a New Jersey-based developer sourcing development land statewide.

The buy box: vacant land (NJ property class 1), 5 to 100 acres, anywhere in New Jersey, suitable for residential or commercial development. Farms are excluded by class. The data is built entirely from public records: NJGIN Parcels + MOD-IV composite, NJDEP Wetlands 2020, FEMA NFHL flood zones, NJ Highlands and Pinelands boundaries, statewide sewer service areas, and preserved-land layers.

Developability score (0-99) — every parcel starts at base 50, then:
- Sewer service area: +25
- Wetlands coverage: -0.4 x percent covered (max -40); "pct unknown" overlap: -10
- FEMA flood: SFHA (1%-annual-chance) -15; 0.2% shaded X -5; unmapped -3
- Highlands Preservation Area: score CAPPED at 15 (greenfield development effectively off the table); Planning Area -10
- Pinelands: Preservation/Forest/Agricultural areas CAPPED at 15; Rural Development -15; Regional Growth Area / Towns / Villages +5
- Preserved-land overlap 5-50%: -20 (parcels >50% preserved were removed entirely)
- Acreage 10-40 ac: +10 (else +5)
- Assessed land value per acre: <$5k +10; $5-15k +6; $15-40k +3
The score_notes field shows the exact arithmetic per parcel.

Score interpretation: 70+ priority target; 40-69 worth investigating; <40 constrained.

Critical caveats you must respect when advising:
- All flags are SCREENING-GRADE. Wetlands come from photo-interpreted 2020 land-cover mapping, not field delineations — a formal call needs an NJDEP Letter of Interpretation.
- flood_sfha "no-data" means FEMA has no digital mapping there, NOT that the parcel is clear.
- Tax figure is prior-year billed tax; delinquency status is not in this data.
- No owner information exists in this data (NJ redacts it under Daniel's Law); ownership for specific targets comes from county deed records.

When asked for recommendations, return a ranked list (top 3-5) with 1-2 sentences per parcel referencing specific data: acreage, assessed value per acre, sewer status, blocker flags, and the score arithmetic. Be concise and actionable.`;

const SUGGESTIONS = [
  "Top targets in sewer service areas over 20 acres",
  "Which counties have the cleanest large parcels?",
  "Find low-cost parcels with zero wetlands and no flood risk",
  "What should I know before trusting the wetlands flags?",
];

// ── Chat Message Type ──────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Sort State ─────────────────────────────────────────────

type SortField = "score" | "acres" | "landVal" | "county" | "wetlandsPct";

// ── Main Page ──────────────────────────────────────────────

export default function DenholtzNjDemoPage() {
  // Dataset — fetched at runtime (7.7MB of real screened parcels; too heavy
  // to bundle). null = still loading.
  const [parcels, setParcels] = useState<NjParcel[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const ALL_COUNTIES = useMemo(
    () => [...new Set((parcels ?? []).map((p) => p.county))].sort(),
    [parcels],
  );

  // Filters
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
  const [minAcres, setMinAcres] = useState(0);
  const [maxAcres, setMaxAcres] = useState(0);
  const [minScore, setMinScore] = useState(0);
  const [maxWetlands, setMaxWetlands] = useState(100);
  const [sewerOnly, setSewerOnly] = useState(false);
  const [hideRestrictive, setHideRestrictive] = useState(false);
  const [excludeSfha, setExcludeSfha] = useState(false);
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedPin, setSelectedPin] = useState<string | null>(null);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    loadParcels()
      .then((rows) => {
        setParcels(rows);
        setSelectedCounties([...new Set(rows.map((p) => p.county))].sort());
      })
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "failed to load"),
      );
  }, []);

  // Filter parcels
  const filtered = useMemo(() => {
    const result = (parcels ?? [])
      .filter((p) => selectedCounties.includes(p.county))
      .filter((p) => p.acres >= minAcres)
      .filter((p) => maxAcres <= 0 || p.acres <= maxAcres)
      .filter((p) => p.score >= minScore)
      .filter(
        (p) => maxWetlands >= 100 || (p.wetlandsPct ?? 100) <= maxWetlands,
      )
      .filter((p) => !sewerOnly || p.sewer)
      .filter(
        (p) =>
          !hideRestrictive ||
          (p.highlands !== "preservation" &&
            !isPinelandsRestrictive(p.pinelands)),
      )
      .filter((p) => !excludeSfha || p.floodSfha !== "yes");

    return result.sort((a, b) => {
      const aVal = a[sortField] ?? -1;
      const bVal = b[sortField] ?? -1;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
  }, [
    parcels,
    selectedCounties,
    minAcres,
    maxAcres,
    minScore,
    maxWetlands,
    sewerOnly,
    hideRestrictive,
    excludeSfha,
    sortField,
    sortAsc,
  ]);

  const filteredPins = useMemo(
    () => new Set(filtered.map((p) => p.pin)),
    [filtered],
  );

  // Reset to first page whenever the filtered set changes
  useEffect(() => {
    setPage(0);
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const selectedParcel = useMemo(
    () =>
      selectedPin
        ? ((parcels ?? []).find((p) => p.pin === selectedPin) ?? null)
        : null,
    [selectedPin, parcels],
  );

  // Stats
  const priorityCount = filtered.filter((p) => p.score >= 70).length;
  const totalAcreage = filtered.reduce((s, p) => s + p.acres, 0);
  const medianPerAcre = useMemo(() => {
    const vals = filtered
      .filter((p) => p.landVal !== null && p.landVal > 0 && p.acres > 0)
      .map((p) => (p.landVal as number) / p.acres)
      .sort((a, b) => a - b);
    if (vals.length === 0) return 0;
    return Math.round(vals[Math.floor(vals.length / 2)]);
  }, [filtered]);

  // Chat handler
  const handleChat = async (prompt: string) => {
    if (!prompt.trim() || chatLoading) return;

    const contextParcels = [...filtered]
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((p) => ({
        pin: p.pin,
        address: p.address,
        muni: p.muni,
        county: p.county,
        acres: p.acres,
        assessed_land: p.landVal,
        assessed_net: p.netVal,
        prior_year_tax: p.taxPrior,
        wetlands_pct: p.wetlandsPct,
        flood_zone: p.floodZone,
        flood_sfha: p.floodSfha,
        highlands: p.highlands,
        pinelands: p.pinelands,
        sewer: p.sewer,
        preserved_pct: p.preservedPct,
        score: p.score,
        score_notes: p.scoreNotes,
      }));

    const fullPrompt = `Current filtered parcel data (top 30 of ${filtered.length} by score):\n\n${JSON.stringify(contextParcels, null, 2)}\n\nActive filters: Counties = ${selectedCounties.length === ALL_COUNTIES.length ? "all" : selectedCounties.join(", ")}, Acres = ${minAcres || 5}–${maxAcres || 100}, Min score = ${minScore}, Max wetlands % = ${maxWetlands}, Sewer only = ${sewerOnly}, Hide Highlands/Pinelands-restricted = ${hideRestrictive}, Exclude SFHA = ${excludeSfha}\n\nQuestion: ${prompt}`;

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

  const allCountiesSelected = selectedCounties.length === ALL_COUNTIES.length;

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

  const thSortable =
    "text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium cursor-pointer hover:text-zinc-400";
  const thPlain =
    "text-left px-3 py-2 text-[10px] uppercase tracking-wider text-zinc-600 font-mono font-medium";

  // This demo owns its background (always dark) instead of following the
  // viewer's OS theme — a screen-shared client demo can't depend on the
  // presenter's color scheme.
  if (!parcels) {
    return (
      <div className="min-h-full bg-zinc-950">
        <div className="flex h-[70vh] flex-col items-center justify-center gap-3">
          <h1 className="text-lg font-semibold tracking-wider text-zinc-400 uppercase font-mono">
            denholtz properties
          </h1>
          {loadError ? (
            <p className="text-sm text-red-400 font-mono">
              failed to load parcel data — {loadError}
            </p>
          ) : (
            <>
              <div className="h-1 w-48 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-zinc-500" />
              </div>
              <p className="text-xs text-zinc-600 font-mono">
                loading 13,751 screened parcels…
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-zinc-950 text-zinc-300">
      <div className="mx-auto max-w-[1400px] px-8 py-6">
        {/* Header */}
        <div className="mb-5 pb-4 border-b border-zinc-800/60">
          <div className="flex items-end justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-wider text-zinc-300 uppercase font-mono">
                denholtz properties
              </h1>
              <p className="text-xs text-zinc-600 font-mono mt-1">
                nj land intelligence // statewide vacant-land screen // class 1,
                5–100 acres
              </p>
              <p className="text-[10px] text-green-500/70 font-mono mt-1.5">
                ● live public records — njgin parcels+mod-iv · njdep wetlands ·
                fema nfhl · highlands · pinelands · sewer service
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono border border-zinc-800 px-2.5 py-1 rounded">
                internal // confidential
              </span>
              <p className="text-[10px] text-zinc-700 font-mono">
                {parcels.length.toLocaleString()} parcels screened
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-3">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
              Acres
            </label>
            <div className="flex gap-1.5 items-center">
              <input
                type="number"
                value={minAcres || ""}
                onChange={(e) => setMinAcres(parseFloat(e.target.value) || 0)}
                placeholder="5"
                className="w-16 px-2 py-1 text-xs bg-transparent border border-zinc-800 rounded text-zinc-400 font-mono"
              />
              <span className="text-zinc-700 text-xs">–</span>
              <input
                type="number"
                value={maxAcres || ""}
                onChange={(e) => setMaxAcres(parseFloat(e.target.value) || 0)}
                placeholder="100"
                className="w-16 px-2 py-1 text-xs bg-transparent border border-zinc-800 rounded text-zinc-400 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
              Min Score
            </label>
            <input
              type="number"
              value={minScore || ""}
              onChange={(e) => setMinScore(parseInt(e.target.value) || 0)}
              placeholder="0"
              className="w-16 px-2 py-1 text-xs bg-transparent border border-zinc-800 rounded text-zinc-400 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
              Max Wetlands %
            </label>
            <input
              type="number"
              value={maxWetlands >= 100 ? "" : maxWetlands}
              onChange={(e) => {
                const v =
                  e.target.value === "" ? 100 : parseInt(e.target.value);
                setMaxWetlands(Number.isNaN(v) ? 100 : v);
              }}
              placeholder="Any"
              className="w-20 px-2 py-1 text-xs bg-transparent border border-zinc-800 rounded text-zinc-400 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
              Constraints
            </label>
            <div className="flex gap-1.5">
              {(
                [
                  ["Sewer Only", sewerOnly, () => setSewerOnly(!sewerOnly)],
                  [
                    "Hide HL/PL Restricted",
                    hideRestrictive,
                    () => setHideRestrictive(!hideRestrictive),
                  ],
                  [
                    "No SFHA Flood",
                    excludeSfha,
                    () => setExcludeSfha(!excludeSfha),
                  ],
                ] as [string, boolean, () => void][]
              ).map(([label, active, toggle]) => (
                <button
                  key={label}
                  onClick={toggle}
                  className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                    active
                      ? "bg-zinc-800 text-zinc-300 border-zinc-700"
                      : "bg-transparent text-zinc-600 border-zinc-800/60 hover:border-zinc-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* County chips */}
        <div className="space-y-1.5 mb-5">
          <div className="flex items-center gap-2">
            <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
              County
            </label>
            <button
              onClick={() =>
                setSelectedCounties(allCountiesSelected ? [] : ALL_COUNTIES)
              }
              className="text-[10px] text-zinc-600 font-mono underline hover:text-zinc-400"
            >
              {allCountiesSelected ? "clear all" : "select all"}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ALL_COUNTIES.map((county) => (
              <button
                key={county}
                onClick={() => toggleCounty(county)}
                className={`px-2 py-0.5 text-[10px] rounded border transition-colors font-mono ${
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

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            {
              label: "Qualifying Parcels",
              value: filtered.length.toLocaleString(),
              sub: `of ${parcels.length.toLocaleString()} screened`,
            },
            {
              label: "Priority Targets",
              value: priorityCount.toLocaleString(),
              sub: "score ≥ 70",
              accent: true,
            },
            {
              label: "Total Acreage",
              value: totalAcreage.toLocaleString(undefined, {
                maximumFractionDigits: 0,
              }),
              sub: "acres in view",
            },
            {
              label: "Median Assessed $/Acre",
              value: `$${medianPerAcre.toLocaleString()}`,
              sub: "land value only",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-zinc-950/50 border border-zinc-800/60 rounded-md px-4 py-3"
            >
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
                {stat.label}
              </p>
              <p
                className="text-2xl font-semibold mt-1"
                style={
                  stat.accent ? { color: scoreColor(85) } : { color: "#e4e4e7" }
                }
              >
                {stat.value}
              </p>
              <p className="text-[10px] text-zinc-600 font-mono">{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Map + charts */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="col-span-2 h-[540px] rounded-md border border-zinc-800/60 bg-zinc-950/50 overflow-hidden">
            <NjMap
              parcels={parcels}
              filteredPins={filteredPins}
              selectedPin={selectedPin}
              onSelect={setSelectedPin}
            />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex-1 rounded-md border border-zinc-800/60 bg-zinc-950/50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono mb-3">
                score distribution
              </p>
              <ScoreHistogram parcels={filtered} />
            </div>
            <div className="flex-1 rounded-md border border-zinc-800/60 bg-zinc-950/50 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono mb-3">
                parcels by county · top 8
              </p>
              <CountyBars parcels={filtered} />
            </div>
          </div>
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
            <div className="max-h-[440px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-zinc-900 z-10">
                  <tr className="border-b border-zinc-800/60">
                    <th className={thPlain}>Parcel</th>
                    <th
                      className={thSortable}
                      onClick={() => handleSort("county")}
                    >
                      Municipality{sortIndicator("county")}
                    </th>
                    <th
                      className={thSortable}
                      onClick={() => handleSort("acres")}
                    >
                      Acres{sortIndicator("acres")}
                    </th>
                    <th
                      className={thSortable}
                      onClick={() => handleSort("landVal")}
                    >
                      Assessed Land{sortIndicator("landVal")}
                    </th>
                    <th
                      className={thSortable}
                      onClick={() => handleSort("wetlandsPct")}
                    >
                      Wetlands{sortIndicator("wetlandsPct")}
                    </th>
                    <th className={thPlain}>Flood</th>
                    <th className={thPlain}>Regime</th>
                    <th className={thPlain}>Sewer</th>
                    <th
                      className={thSortable}
                      onClick={() => handleSort("score")}
                    >
                      Score{sortIndicator("score")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((parcel) => (
                    <tr
                      key={parcel.pin}
                      onClick={() => setSelectedPin(parcel.pin)}
                      className={`border-b border-zinc-800/30 cursor-pointer transition-colors ${
                        selectedPin === parcel.pin
                          ? "bg-zinc-800/40"
                          : "hover:bg-zinc-800/20"
                      }`}
                    >
                      <td className="px-3 py-2">
                        <div>
                          <span className="text-zinc-400 font-medium text-xs">
                            {parcel.address || "(no situs address)"}
                          </span>
                          <p className="text-[10px] text-zinc-600 font-mono">
                            {parcel.pin}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-zinc-500 text-xs">
                        {parcel.muni}
                        <span className="text-zinc-700 ml-1 text-[10px]">
                          {parcel.county}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-400 font-mono text-xs tabular-nums">
                        {parcel.acres.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 text-zinc-500 font-mono text-xs tabular-nums">
                        {parcel.landVal === null
                          ? ""
                          : `$${parcel.landVal.toLocaleString()}`}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs tabular-nums">
                        {parcel.wetlandsPct === null ? (
                          <span className="text-zinc-600 italic">unknown</span>
                        ) : parcel.wetlandsPct > 0 ? (
                          <span
                            className={
                              parcel.wetlandsPct > 50
                                ? "text-red-400"
                                : "text-amber-400"
                            }
                          >
                            {parcel.wetlandsPct}%
                          </span>
                        ) : (
                          <span className="text-zinc-600">0%</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {parcel.floodSfha === "yes" ? (
                          <span className="text-red-400">
                            {parcel.floodZone}
                          </span>
                        ) : parcel.floodSfha === "no-data" ? (
                          <span className="text-zinc-600 italic">unmapped</span>
                        ) : parcel.floodZone === "X-shaded" ? (
                          <span className="text-amber-400">0.2%</span>
                        ) : (
                          <span className="text-zinc-600">clear</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {parcel.highlands === "preservation" ||
                        isPinelandsRestrictive(parcel.pinelands) ? (
                          <span className="text-red-400">restricted</span>
                        ) : parcel.highlands === "planning" ||
                          parcel.pinelands !== "none" ? (
                          <span className="text-amber-400">
                            {parcel.highlands === "planning"
                              ? "highlands"
                              : "pinelands"}
                          </span>
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {parcel.sewer ? (
                          <span className="text-emerald-400">✓</span>
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="font-mono text-sm font-semibold tabular-nums"
                          style={{ color: scoreColor(parcel.score) }}
                        >
                          {parcel.score}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between mb-8">
          <p className="text-[10px] text-zinc-700 font-mono">
            showing {filtered.length === 0 ? 0 : page * PAGE_SIZE + 1}–
            {Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{" "}
            {filtered.length.toLocaleString()} parcels {"//"} click a row or map
            dot for detail
          </p>
          {pageCount > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="px-2.5 py-1 text-xs rounded border border-zinc-800/60 text-zinc-500 hover:border-zinc-700 disabled:opacity-40"
              >
                ← prev
              </button>
              <span className="text-[10px] text-zinc-600 font-mono">
                {page + 1} / {pageCount}
              </span>
              <button
                onClick={() => setPage(Math.min(pageCount - 1, page + 1))}
                disabled={page >= pageCount - 1}
                className="px-2.5 py-1 text-xs rounded border border-zinc-800/60 text-zinc-500 hover:border-zinc-700 disabled:opacity-40"
              >
                next →
              </button>
            </div>
          )}
        </div>

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
              query parcels, blockers, counties, or the score formula...
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
            placeholder="Ask about parcels, blockers, counties, or development potential..."
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
            denholtz properties land intelligence {"//"} screening-grade flags —
            not delineations {"//"} powered by dealwire
          </p>
        </div>

        {/* Detail sheet */}
        {selectedParcel && (
          <ParcelDetailSheet
            parcel={selectedParcel}
            onClose={() => setSelectedPin(null)}
          />
        )}
      </div>
    </div>
  );
}
