import Link from "next/link";
import { DashboardPageShell } from "@/components/dashboard-page-shell";
import { demos } from "./config";

export default function DemosIndexPage() {
  return (
    <DashboardPageShell title="Demos">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {demos.map((demo) => (
          <Link
            key={demo.slug}
            href={`/demos/${demo.slug}`}
            className="group block rounded-lg border border-zinc-800/60 bg-zinc-900/50 p-5 hover:border-zinc-700 hover:bg-zinc-800/40 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <h2 className="text-sm font-semibold text-white group-hover:text-zinc-100">
                {demo.client}
              </h2>
              <span
                className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded ${
                  demo.status === "active"
                    ? "bg-green-900/30 text-green-400"
                    : "bg-zinc-800 text-zinc-500"
                }`}
              >
                {demo.status}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mb-1">{demo.domain}</p>
            <p className="text-xs text-zinc-600">{demo.description}</p>
            <p className="text-[10px] text-zinc-700 mt-3">
              Created {demo.createdAt}
            </p>
          </Link>
        ))}
      </div>
    </DashboardPageShell>
  );
}
