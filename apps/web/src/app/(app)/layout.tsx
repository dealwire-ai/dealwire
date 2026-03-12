import { Suspense } from "react";
import { Sidebar } from "@/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-zinc-950 text-white overflow-hidden p-2 gap-2">
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <main className="flex-1 overflow-y-auto bg-zinc-900 rounded-xl min-w-0 border border-white/[0.06] shadow-2xl shadow-black/60">
        <Suspense fallback={null}>{children}</Suspense>
      </main>
    </div>
  );
}
