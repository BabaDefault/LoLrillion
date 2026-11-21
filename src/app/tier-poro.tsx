"use client";

import { useEffect, useState } from "react";
import { PixelArt, PORO, PORO_COLOURS, PORO_MISS } from "./poro";
import type { TierTone } from "./tier-tone";

/** The Tiers in rising order; the poro climbs these colours and stops on the one earned. */
const LADDER: readonly TierTone[] = ["blue", "green", "yellow", "orange", "gem"];

const DROP_MS = 800; // matches poro-drop in globals.css
const STEP_MS = 320;
const FLASH_MS = 160;
const FIZZLE_MS = 600;

/** The colours the poro glows through on its way to a Tier. Too Clever sits just above Minion. */
function climbFor(tone: TierTone): TierTone[] {
  if (tone === "miss") return [];
  if (tone === "clown") return ["blue", "clown"];
  return LADDER.slice(0, LADDER.indexOf(tone) + 1);
}

type Phase = { kind: "drop" } | { kind: "climb"; step: TierTone } | { kind: "fizzle" } | { kind: "flash" } | { kind: "done" };

/**
 * The poro shown when a Prompt is scored. It drops in plain, then glows up the Tier ladder
 * (Minion → Pentakill) and stops on the Tier earned with a flash and a burst; on a Miss it fizzles
 * to grey. Calls `onReveal` once the Tier is showing. Decorative.
 */
export function TierPoro({ tone, cell, onReveal }: { tone: TierTone; cell: number; onReveal: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: "drop" });

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase({ kind: "done" });
      onReveal();
      return;
    }
    const climb = climbFor(tone);
    const at: [number, Phase][] = [];
    let t = DROP_MS;
    if (climb.length === 0) {
      at.push([t, { kind: "fizzle" }]);
      t += FIZZLE_MS;
    } else {
      for (const step of climb) {
        at.push([t, { kind: "climb", step }]);
        t += STEP_MS;
      }
      at.push([t, { kind: "flash" }]);
      t += FLASH_MS;
    }
    const timers = at.map(([ms, p]) => setTimeout(() => setPhase(p), ms));
    timers.push(
      setTimeout(() => {
        setPhase({ kind: "done" });
        onReveal();
      }, t),
    );
    return () => timers.forEach(clearTimeout);
    // Runs once per mount; the parent keys this per Prompt.
  }, []);

  const done = phase.kind === "done";
  const fur: TierTone | null = phase.kind === "climb" ? phase.step : phase.kind === "flash" || done ? tone : null;
  const glow = phase.kind === "climb" ? `glow-${phase.step}` : phase.kind === "flash" ? "is-flash" : phase.kind === "fizzle" ? "is-fizzle" : done ? `glow-${tone} is-settled` : "";

  return (
    <span className="tier-poro" aria-hidden="true">
      <span
        className={`tier-poro-charge ${glow} ${fur ? `poro-${fur}` : ""}`}
        key={phase.kind === "climb" ? phase.step : phase.kind}
      >
        <PixelArt rows={done && tone === "miss" ? PORO_MISS : PORO} cell={cell} className="tier-poro-art" palette={PORO_COLOURS} />
      </span>
      {done && tone !== "miss" && <span className={`tier-poro-burst glow-${tone}`} />}
    </span>
  );
}
