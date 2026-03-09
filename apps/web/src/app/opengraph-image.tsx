import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Levine & Weinstein — Deal Intelligence";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  const spaceGrotesk = await fetch(
    new URL(
      "https://fonts.gstatic.com/s/spacegrotesk/v16/V8mDoQDjQSkFtoMM3T6r8E7mPbF4Cw.woff",
    ),
  ).then((res) => res.arrayBuffer());

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "#080808",
        fontFamily: "Space Grotesk",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle gold radial glow */}
      <div
        style={{
          position: "absolute",
          top: "-200px",
          right: "-100px",
          width: "800px",
          height: "800px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(200,169,110,0.06) 0%, transparent 70%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-200px",
          left: "-100px",
          width: "600px",
          height: "600px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(200,169,110,0.08) 0%, transparent 70%)",
        }}
      />

      {/* Signal wave mark */}
      <svg
        width="72"
        height="44"
        viewBox="0 0 36 22"
        fill="none"
        style={{ marginBottom: "32px" }}
      >
        <path
          d="M0 11 H12 L14 3 L16 19 L18 3 L20 11 H36"
          stroke="#C8A96E"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Brand name */}
      <div
        style={{
          fontSize: 52,
          fontWeight: 500,
          color: "rgba(255,255,255,0.92)",
          letterSpacing: "-0.02em",
          marginBottom: "16px",
        }}
      >
        Levine & Weinstein
      </div>

      {/* Tagline */}
      <div
        style={{
          fontSize: 22,
          color: "rgba(200,169,110,0.7)",
          letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
          fontWeight: 400,
        }}
      >
        Deal Intelligence
      </div>

      {/* Domain */}
      <div
        style={{
          position: "absolute",
          bottom: "36px",
          fontSize: 14,
          color: "rgba(255,255,255,0.2)",
          letterSpacing: "0.15em",
          textTransform: "uppercase" as const,
          fontFamily: "monospace",
        }}
      >
        deals.frontstep.ai
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "Space Grotesk",
          data: spaceGrotesk,
          style: "normal",
          weight: 500,
        },
      ],
    },
  );
}
