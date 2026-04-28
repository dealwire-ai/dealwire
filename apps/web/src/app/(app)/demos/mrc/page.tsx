"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { DashboardPageShell } from "@/components/dashboard-page-shell";
import { Badge } from "@/components/ui/badge";
import {
  projects,
  type Project,
  type ProjectType,
  type ApprovalStatus,
} from "./data";

// ── Constants ──────────────────────────────────────────────

const ALL_CITIES: Project["city"][] = [
  "Los Angeles",
  "Miami",
  "West Palm Beach",
  "Seattle",
];

const CITY_FLAGS: Record<Project["city"], string> = {
  "Los Angeles": "LA",
  Miami: "MIA",
  "West Palm Beach": "WPB",
  Seattle: "SEA",
};

const PROJECT_TYPES: ProjectType[] = [
  "Multifamily",
  "Mixed-Use",
  "Condo",
  "Hospitality",
  "Office Conversion",
];

const APPROVAL_STATUSES: ApprovalStatus[] = [
  "Permits Approved",
  "Site Plan Approved",
  "Entitled",
  "Under Review",
];

const SYSTEM_PROMPT = `You are a construction loan origination analyst for Madison Realty Capital (MRC), a NYC-based vertically integrated real estate investment firm. You are advising Marc Schwartz, Managing Director of Originations & Acquisitions.

MRC's lending profile:
- Senior construction loans, balance-sheet (no syndication required)
- Sweet spot: $50M-$300M loan size; will go larger on the right deal
- Asset classes: multifamily, condo, mixed-use, hospitality, office-to-residential conversions
- Geographies in this dataset: Los Angeles, Miami, West Palm Beach, Seattle
- Values strong sponsor track record but will lend first-time relationships when basis and project economics are compelling
- Speed is a differentiator — has closed in 30 days when needed

You have project data for newly-announced/approved development sites pulled from local business journals and permit feeds. Each project includes: developer, city, submarket, project type, unit count, GSF, est. project cost, est. construction loan need, approval status, announcement date, source headline, sponsor track record score, prior lender, contact, and an origination score (0-100, where higher = stronger MRC fit).

Origination score interpretation:
- 80-100: Priority — reach out this week
- 60-79: Warm — get on the watch list
- 0-59: Lower priority — monitor only

When asked for recommendations, return a ranked list (top 3-5) with 1-2 sentences per project explaining the fit. Reference: developer name, loan size, project type, sub-market dynamics, and the angle for the cold outreach (e.g. "first-time relationship," "rare permit-in-hand basis," "sponsor with strong track record"). Be concise, specific, and useful for someone about to pick up the phone.`;

const SUGGESTIONS = [
  "Top 5 LA opportunities to reach out to this week",
  "Which developers have multiple projects across our markets?",
  "Compare construction loan flow in Seattle vs Miami",
  "Find Class A multifamily over $100M with permits approved",
];

// ── Helpers ────────────────────────────────────────────────

function fmtMoney(m: number): string {
  if (m >= 1000) return `$${(m / 1000).toFixed(1)}B`;
  return `$${m}M`;
}

function fmtUnits(n: number): string {
  return n.toLocaleString();
}

function daysAgo(dateStr: string): string {
  const days = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

// ── Score / Status Badges ──────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  let className: string;
  if (score >= 80) {
    className = "bg-red-900/30 text-red-400 border-red-900/50";
  } else if (score >= 60) {
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

function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const colors: Record<ApprovalStatus, string> = {
    "Permits Approved": "text-emerald-400",
    "Site Plan Approved": "text-blue-400",
    Entitled: "text-amber-400",
    "Under Review": "text-zinc-500",
  };
  return (
    <span className={`text-[10px] font-mono ${colors[status]}`}>
      {status.toLowerCase()}
    </span>
  );
}

function OutreachIndicator({ status }: { status: Project["outreach_status"] }) {
  if (status === "Sent")
    return <span className="text-[10px] font-mono text-blue-400">● sent</span>;
  if (status === "Drafted")
    return (
      <span className="text-[10px] font-mono text-emerald-400">
        ● draft ready
      </span>
    );
  return <span className="text-[10px] font-mono text-zinc-700">○ pending</span>;
}

// ── Chat Type ──────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Outreach Modal ─────────────────────────────────────────

function OutreachModal({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-800 p-5 flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono mb-1">
              drafted outreach
            </p>
            <h2 className="text-zinc-200 font-medium">
              {project.project_name}
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              {project.developer} · {project.submarket}, {project.city}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-300 text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Project facts */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
                Project Type
              </p>
              <p className="text-zinc-300 font-mono mt-0.5">
                {project.project_type}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
                Units
              </p>
              <p className="text-zinc-300 font-mono mt-0.5">
                {fmtUnits(project.units)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
                Project Cost
              </p>
              <p className="text-zinc-300 font-mono mt-0.5">
                {fmtMoney(project.est_project_cost_m)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
                Loan Need
              </p>
              <p className="text-emerald-400 font-mono mt-0.5">
                {fmtMoney(project.est_loan_need_m)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
                Approval
              </p>
              <p className="text-zinc-300 font-mono mt-0.5">
                {project.approval_status}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
                Sponsor Score
              </p>
              <p className="text-zinc-300 font-mono mt-0.5">
                {project.developer_track_record_score} /{" "}
                {project.developer_active_projects} active
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
                Prior Lender
              </p>
              <p className="text-zinc-400 mt-0.5">{project.prior_lender}</p>
            </div>
            <div className="col-span-2">
              <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
                Source
              </p>
              <p className="text-zinc-400 mt-0.5 italic">
                &ldquo;{project.source_headline}&rdquo; — {project.source} ·{" "}
                {daysAgo(project.announcement_date)}
              </p>
            </div>
          </div>

          {/* Contact */}
          <div className="border-t border-zinc-800/60 pt-4">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono mb-2">
              extracted contact
            </p>
            <p className="text-sm text-zinc-300">{project.contact_name}</p>
            <p className="text-xs text-zinc-500">{project.contact_title}</p>
            <p className="text-xs text-blue-400 font-mono mt-1">
              {project.contact_email}
            </p>
          </div>

          {/* Email */}
          <div className="border-t border-zinc-800/60 pt-4">
            <p className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono mb-2">
              draft email
            </p>
            <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed bg-zinc-900/50 border border-zinc-800/60 rounded p-3">
              {project.draft_email}
            </pre>
          </div>

          <div className="flex gap-2 pt-2">
            <button className="flex-1 px-3 py-2 text-xs bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors font-mono">
              send via outlook
            </button>
            <button className="px-3 py-2 text-xs bg-transparent text-zinc-500 border border-zinc-800 rounded hover:border-zinc-700 hover:text-zinc-300 transition-colors font-mono">
              regenerate
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────

export default function MrcDemoPage() {
  // Filters
  const [selectedCities, setSelectedCities] =
    useState<Project["city"][]>(ALL_CITIES);
  const [selectedTypes, setSelectedTypes] =
    useState<ProjectType[]>(PROJECT_TYPES);
  const [minLoan, setMinLoan] = useState(50);
  const [minScore, setMinScore] = useState(0);
  const [selectedApprovals, setSelectedApprovals] =
    useState<ApprovalStatus[]>(APPROVAL_STATUSES);

  // Modal
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Filter
  const filtered = useMemo(() => {
    return projects
      .filter((p) => selectedCities.includes(p.city))
      .filter((p) => selectedTypes.includes(p.project_type))
      .filter((p) => p.est_loan_need_m >= minLoan)
      .filter((p) => p.origination_score >= minScore)
      .filter((p) => selectedApprovals.includes(p.approval_status))
      .sort((a, b) => b.origination_score - a.origination_score);
  }, [selectedCities, selectedTypes, minLoan, minScore, selectedApprovals]);

  // Stats
  const priorityCount = filtered.filter(
    (p) => p.origination_score >= 80,
  ).length;
  const totalLoanNeed = filtered.reduce((s, p) => s + p.est_loan_need_m, 0);
  const avgLoan =
    filtered.length > 0 ? Math.round(totalLoanNeed / filtered.length) : 0;
  const draftCount = filtered.filter(
    (p) => p.outreach_status === "Drafted",
  ).length;

  // Chat handler
  const handleChat = async (prompt: string) => {
    if (!prompt.trim() || chatLoading) return;

    const contextProjects = filtered.slice(0, 30).map((p) => ({
      project: p.project_name,
      developer: p.developer,
      city: p.city,
      submarket: p.submarket,
      type: p.project_type,
      units: p.units,
      project_cost_m: p.est_project_cost_m,
      loan_need_m: p.est_loan_need_m,
      approval: p.approval_status,
      announced: p.announcement_date,
      sponsor_score: p.developer_track_record_score,
      sponsor_active_projects: p.developer_active_projects,
      prior_lender: p.prior_lender,
      origination_score: p.origination_score,
    }));

    const fullPrompt = `Current filtered project pipeline (top 30 by origination score):\n\n${JSON.stringify(contextProjects, null, 2)}\n\nActive filters: Cities = ${selectedCities.join(", ") || "All"}, Types = ${selectedTypes.join(", ") || "All"}, Min loan = $${minLoan}M, Min score = ${minScore}\n\nQuestion: ${prompt}`;

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

  const toggleCity = (city: Project["city"]) => {
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city],
    );
  };

  const toggleType = (type: ProjectType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  const toggleApproval = (status: ApprovalStatus) => {
    setSelectedApprovals((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
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
      {activeProject && (
        <OutreachModal
          project={activeProject}
          onClose={() => setActiveProject(null)}
        />
      )}

      {/* Header */}
      <div className="mb-6 pb-5 border-b border-zinc-800/60">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-wider text-zinc-400 uppercase font-mono">
              madison realty capital
            </h1>
            <p className="text-xs text-zinc-600 font-mono mt-1">
              construction loan origination intelligence // la · mia · wpb · sea
            </p>
            <p className="text-[10px] text-green-500/70 font-mono mt-1.5">
              ● live — last sync 6m ago // 47 sources monitored
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Cities */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Markets
          </label>
          <div className="flex gap-1.5">
            {ALL_CITIES.map((city) => (
              <button
                key={city}
                onClick={() => toggleCity(city)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors font-mono ${
                  selectedCities.includes(city)
                    ? "bg-zinc-800 text-zinc-300 border-zinc-700"
                    : "bg-transparent text-zinc-600 border-zinc-800/60 hover:border-zinc-700"
                }`}
              >
                {CITY_FLAGS[city]}
              </button>
            ))}
          </div>
        </div>

        {/* Project Type */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Asset Class
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {PROJECT_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                  selectedTypes.includes(type)
                    ? "bg-zinc-800 text-zinc-300 border-zinc-700"
                    : "bg-transparent text-zinc-600 border-zinc-800/60 hover:border-zinc-700"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Min Loan */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Min Loan
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={350}
              step={10}
              value={minLoan}
              onChange={(e) => setMinLoan(parseInt(e.target.value))}
              className="w-28 accent-zinc-500"
            />
            <span className="text-xs text-zinc-500 font-mono w-12">
              ${minLoan}M
            </span>
          </div>
        </div>

        {/* Min Score */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Min Score
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={minScore}
              onChange={(e) => setMinScore(parseInt(e.target.value))}
              className="w-24 accent-zinc-500"
            />
            <span className="text-xs text-zinc-500 font-mono w-8">
              {minScore}
            </span>
          </div>
        </div>

        {/* Approval Status */}
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-wider text-zinc-600 font-mono">
            Status
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {APPROVAL_STATUSES.map((status) => (
              <button
                key={status}
                onClick={() => toggleApproval(status)}
                className={`px-2 py-1 text-[11px] rounded border transition-colors ${
                  selectedApprovals.includes(status)
                    ? "bg-zinc-800 text-zinc-300 border-zinc-700"
                    : "bg-transparent text-zinc-600 border-zinc-800/60 hover:border-zinc-700"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          {
            label: "Projects Monitored",
            value: filtered.length.toString(),
            sub: "across 4 markets",
          },
          {
            label: "Priority Targets",
            value: priorityCount.toString(),
            sub: "score ≥ 80",
          },
          {
            label: "Avg Loan Need",
            value: fmtMoney(avgLoan),
            sub: `${fmtMoney(totalLoanNeed)} total`,
          },
          {
            label: "Outreach Drafted",
            value: draftCount.toString(),
            sub: "ready to send",
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

      {/* Section: Pipeline */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono font-medium">
          pipeline
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
          <div className="max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-zinc-900 z-10">
                <tr className="border-b border-zinc-800/60">
                  {[
                    "Project",
                    "Developer",
                    "Mkt",
                    "Type",
                    "Units",
                    "Loan",
                    "Status",
                    "Announced",
                    "Outreach",
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
                {filtered.map((p, i) => (
                  <tr
                    key={`${p.project_name}-${i}`}
                    className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors cursor-pointer"
                    onClick={() => setActiveProject(p)}
                  >
                    <td className="px-3 py-2">
                      <span className="text-zinc-300 font-medium">
                        {p.project_name}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-500 text-xs">
                      {p.developer}
                    </td>
                    <td className="px-3 py-2 text-zinc-600 font-mono text-[10px]">
                      {CITY_FLAGS[p.city]}
                    </td>
                    <td className="px-3 py-2 text-zinc-500 text-xs">
                      {p.project_type}
                    </td>
                    <td className="px-3 py-2 text-zinc-500 font-mono text-xs text-right">
                      {fmtUnits(p.units)}
                    </td>
                    <td className="px-3 py-2 text-emerald-400/80 font-mono text-xs">
                      {fmtMoney(p.est_loan_need_m)}
                    </td>
                    <td className="px-3 py-2">
                      <ApprovalBadge status={p.approval_status} />
                    </td>
                    <td className="px-3 py-2 text-zinc-600 font-mono text-[10px]">
                      {daysAgo(p.announcement_date)}
                    </td>
                    <td className="px-3 py-2">
                      <OutreachIndicator status={p.outreach_status} />
                    </td>
                    <td className="px-3 py-2">
                      <ScoreBadge score={p.origination_score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[10px] text-zinc-700 font-mono mb-8">
        {filtered.length} projects // sorted by origination score // click row
        to view drafted outreach
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
            ask about origination targets, sponsor activity, or market flow...
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
          placeholder="Ask about targets, sponsors, market flow, or specific submarkets..."
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
          madison realty capital origination intelligence // powered by dealwire
        </p>
      </div>
    </DashboardPageShell>
  );
}
