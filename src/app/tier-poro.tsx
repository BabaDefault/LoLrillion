"use client";

import { useEffect, useState } from "react";
import { PixelArt, PORO, PORO_COLOURS, PORO_MISS } from "./poro";
import type { TierTone } from "./tier-tone";

/** The Tiers in rising order; the poro climbs these colours and stops on the one earned. */
const LADDER: readonly TierTone[] = ["blue", "green", "yellow", "orange", "gem"];

const DROP_MS = 800; // matches poro-drop in globals.css
const STEP_MS = 520; // matches poro-step in globals.css
const CHARGE_MS = 900; // matches poro-charge in globals.css
const FLASH_MS = 240;
const FIZZLE_MS = 700;

/**
 * The rungs the poro glows through before the Tier earned (that last rung is held back for the
 * flash). Too Clever sits just above Minion.
 */
function climbFor(tone: TierTone): TierTone[] {
  if (tone === "miss") return [];
  if (tone === "clown") return ["blue"];
  return LADDER.slice(0, LADDER.indexOf(tone));
}

type Phase =
  | { kind: "drop" }
  | { kind: "climb"; step: TierTone }
  | { kind: "charge"; from: TierTone | null }
  | { kind: "fizzle" }
  | { kind: "flash" }
  | { kind: "done" };

/**
 * The poro shown when a Prompt is scored. It drops in plain, glows up the Tier ladder
 * (Minion → Pentakill), trembles as it charges, then bursts into the Tier earned with a flash and a
 * round shockwave that leaves a glowing halo; on a Miss the charge fizzles to grey. Calls `onReveal`
 * once the Tier is showing. Decorative.
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
    for (const step of climb) {
      at.push([t, { kind: "climb", step }]);
      t += STEP_MS;
    }
    at.push([t, { kind: "charge", from: climb.at(-1) ?? null }]);
    t += CHARGE_MS;
    if (tone === "miss") {
      at.push([t, { kind: "fizzle" }]);
      t += FIZZLE_MS;
    } else {
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
  const fur: TierTone | null =
    phase.kind === "climb" ? phase.step : phase.kind === "charge" ? phase.from : phase.kind === "flash" || done ? tone : null;
  const glow =
    phase.kind === "climb"
      ? `glow-${phase.step}`
      : phase.kind === "charge"
        ? `is-charging ${phase.from ? `glow-${phase.from}` : ""}`
        : phase.kind === "flash"
          ? "is-flash"
          : phase.kind === "fizzle"
            ? "is-fizzle"
            : done
              ? `glow-${tone} is-settled`
              : "";

  return (
    <span className="tier-poro" aria-hidden="true">
      {done && tone !== "miss" && <span className={`tier-poro-halo glow-${tone}`} />}
      <span
        className={`tier-poro-charge ${glow} ${fur ? `poro-${fur}` : ""}`}
        key={phase.kind === "climb" ? phase.step : phase.kind}
      >
        <PixelArt rows={done && tone === "miss" ? PORO_MISS : PORO} cell={cell} className="tier-poro-art" palette={PORO_COLOURS} />
      </span>
      {done && tone !== "miss" && (
        <>
          <span className={`tier-poro-burst glow-${tone}`} />
          <span className={`tier-poro-burst is-echo glow-${tone}`} />
        </>
      )}
    </span>
  );
}
