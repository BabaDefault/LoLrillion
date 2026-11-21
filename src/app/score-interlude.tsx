"use client";

import { MISS_EMOJI, TIER_EMOJI, TIER_NAMES } from "@/engine";
import type { PromptResultView } from "@/server/game-service";
import { tierTone } from "./tier-tone";

/**
 * The score animation between Prompts: Tier name, emoji and Points. Never reveals the Answer Set.
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
  return (
    <section className="card center">
      <p className="kicker">
        Prompt <span className="num">{index + 1}</span> of <span className="num">{promptCount}</span>
      </p>
      <div className={`score-pop tone-${tierTone(accepted ? result.tier : null)}`} key={index} aria-live="polite">
        <span className="score-emoji" aria-hidden="true">
          {accepted ? TIER_EMOJI[result.tier] : MISS_EMOJI}
        </span>
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
