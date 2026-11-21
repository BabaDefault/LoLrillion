"use client";

import { useState } from "react";
import { TIER_NAMES } from "@/engine";
import type { PromptResultView } from "@/server/game-service";
import { TierPoro } from "./tier-poro";
import { tierTone } from "./tier-tone";

/**
 * The score animation between Prompts: a plain poro drops in and glows up the Tier ladder, stopping
 * on the Tier earned, then the Tier name and Points appear, while the backdrop sinks one step deeper.
 * Never reveals the Answer Set.
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
      <ScorePop key={index} result={result} />
      <p className="muted">{accepted ? `Locked in: ${result.entityName}` : "Time's up."}</p>
      <button className="primary" onClick={onContinue} autoFocus>
        {finished ? "See your results" : "Next Prompt"}
      </button>
    </section>
  );
}

/** The poro, then the Tier name and Points once it has landed on its colour. Keyed per Prompt. */
function ScorePop({ result }: { result: PromptResultView }) {
  const accepted = result.status === "accepted";
  const tone = tierTone(accepted ? result.tier : null);
  const [revealed, setRevealed] = useState(false);
  const shown = revealed ? "score-reveal" : "is-pending";
  return (
    <div className={`score-pop tone-${tone}`} aria-live="polite">
      <TierPoro tone={tone} cell={5} onReveal={() => setRevealed(true)} />
      <span className={`score-tier ${shown}`}>{accepted ? TIER_NAMES[result.tier] : "Miss"}</span>
      <span className={`score-points ${shown}`}>+{result.points}</span>
    </div>
  );
}
