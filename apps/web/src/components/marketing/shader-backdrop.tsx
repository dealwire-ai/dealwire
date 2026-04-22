"use client";

import { NeuroNoise, Dithering } from "@paper-design/shaders-react";

type ShaderBackdropProps = {
  /**
   * hero      — slightly more visible neural lines
   * closing   — dimmer, sits behind the radial gold glow
   */
  variant?: "hero" | "closing";
};

/**
 * Two shaders stacked to evoke a neural + digital-terminal vibe:
 *   1. NeuroNoise — glowing web of fluid lines (the "intelligence fabric")
 *   2. Dithering  — Bayer-dithered simplex noise overlaid with `overlay` blend
 *                   mode, which adds the CRT/ASCII pixel texture on top
 *
 * Colors are pulled far below page luminosity and a radial vignette + flat
 * darken keep the backdrop beneath hero copy and the intelligence demo card.
 */
export function ShaderBackdrop({ variant = "hero" }: ShaderBackdropProps) {
  const isHero = variant === "hero";

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      {/* Base layer: neural web */}
      <div className="absolute inset-0">
        <NeuroNoise
          style={{ width: "100%", height: "100%" }}
          colorBack="#080808"
          colorMid="#1a1410"
          colorFront={isHero ? "#7a6335" : "#5a4a2a"}
          brightness={isHero ? 0.55 : 0.4}
          contrast={0.7}
          speed={isHero ? 0.35 : 0.2}
          scale={isHero ? 0.85 : 0.7}
        />
      </div>

      {/* Digital overlay: Bayer-dithered simplex noise, blended into the web */}
      <div
        className="absolute inset-0 mix-blend-overlay"
        style={{ opacity: isHero ? 0.5 : 0.35 }}
      >
        <Dithering
          style={{ width: "100%", height: "100%" }}
          colorBack="#000000"
          colorFront="#C8A96E"
          shape="simplex"
          type="8x8"
          size={isHero ? 2.5 : 3}
          speed={isHero ? 0.25 : 0.15}
          scale={isHero ? 0.9 : 0.7}
        />
      </div>

      {/* Radial vignette: center shows the pattern, edges fall off to black */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(8,8,8,0.55)_70%,rgba(8,8,8,0.85)_100%)]" />

      {/* Flat darken so the shader never rises above page luminosity */}
      <div
        className={
          isHero
            ? "absolute inset-0 bg-[#080808]/40"
            : "absolute inset-0 bg-[#080808]/55"
        }
      />
    </div>
  );
}
