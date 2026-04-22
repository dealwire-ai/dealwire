import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col items-center justify-center relative overflow-hidden font-sans">
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 w-[600px] h-[600px] bg-[#C8A96E]/5 rounded-full blur-[160px] -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="relative z-10 text-center px-6">
        {/* Flatlined signal */}
        <svg
          width="120"
          height="32"
          viewBox="0 0 120 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="mx-auto mb-8 opacity-30"
        >
          <path
            d="M0 16 H120"
            stroke="#C8A96E"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>

        <p className="text-[#C8A96E] font-mono text-sm tracking-widest uppercase mb-4">
          404
        </p>

        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3">
          This deal is off market
        </h1>

        <p className="text-zinc-500 text-base max-w-md mx-auto mb-10">
          The page you&apos;re looking for has been taken off the table.
          <br />
          Maybe the seller got cold feet.
        </p>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#C8A96E] hover:bg-[#d9bb80] text-black font-semibold text-sm rounded-md transition-colors"
        >
          Back to the lobby
        </Link>
      </div>
    </div>
  );
}
