import { Suspense } from "react";
import { Sidebar } from "@/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#111111] text-white overflow-hidden">
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <main className="flex-1 overflow-y-auto">
        <Suspense fallback={null}>{children}</Suspense>
      </main>
    </div>
  );
}
