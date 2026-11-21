"use client";

import { TIER_NAMES } from "@/engine";
import type { PromptResultView } from "@/server/game-service";
import { TierPoro } from "./poro";
import { tierTone } from "./tier-tone";

/**
 * The score animation between Prompts: a poro in the Tier's colour drops in with the Tier name and
 * Points, while the backdrop sinks one step deeper. Never reveals the Answer Set.
 */
export function ScoreInterlude({
  index,
  promptCount,
  result,
  finished,
  onContinue,
}: {
  index: number;
  promptCount: number;
  result: PromptResultView;
  finished: boolean;
  onContinue: () => void;
}) {
  const accepted = result.status === "accepted";
  const tone = tierTone(accepted ? result.tier : null);
  return (
    <section className="card center">
      <p className="kicker">
        Prompt <span className="num">{index + 1}</span> of <span className="num">{promptCount}</span>
      </p>
      <div className={`score-pop tone-${tone}`} key={index} aria-live="polite">
        <TierPoro tone={tone} cell={5} />
        <span className="score-tier">{accepted ? TIER_NAMES[result.tier] : "Miss"}</span>
        <span className="score-points">+{result.points}</span>
      </div>
      <p className="muted">{accepted ? `Locked in: ${result.entityName}` : "Time's up."}</p>
      <button className="primary" onClick={onContinue} autoFocus>
        {finished ? "See your results" : "Next Prompt"}
      </button>
    </section>
  );
}
