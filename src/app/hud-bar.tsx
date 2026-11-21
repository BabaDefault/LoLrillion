import type { PromptResultView } from "@/server/game-service";
import { promptPips, runningScore } from "./hud";

/** The in-game HUD: banked score on the left, one pip per Prompt in the middle, the Prompt number on the right. */
export function HudBar({ results, currentIndex }: { results: ReadonlyArray<PromptResultView | null>; currentIndex: number }) {
  const promptNumber = currentIndex + 1;
  return (
    <div className="hud">
      <div className="hud-panel">
        <span className="hud-label">Score</span>
        <span className="hud-value" data-testid="hud-score">
          {runningScore(results)}
        </span>
      </div>
      <ol className="pips" aria-label={`Progress: Prompt ${promptNumber} out of ${results.length}`}>
        {promptPips(results, currentIndex).map((pip, i) => (
          <li key={i} className={`pip pip-${pip}`} />
        ))}
      </ol>
      <div className="hud-panel hud-panel-right" aria-hidden="true">
        <span className="hud-label">Prompt</span>
        <span className="hud-value">
          {promptNumber}
          <small>/{results.length}</small>
        </span>
      </div>
    </div>
  );
}

const RING_RADIUS = 26;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/**
 * The circular answer timer: a ring that drains as the window closes, with the seconds left inside.
 * `announce` is the screen-reader text ("Read… 3", "12", "Time's up").
 */
export function TimerRing({
  fraction,
  reading,
  seconds,
  announce,
}: {
  fraction: number;
  reading: boolean;
  seconds: number;
  announce: string;
}) {
  return (
    <div className={`timer${reading ? " reading" : ""}${!reading && fraction <= 0.2 ? " low" : ""}`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle className="timer-track" cx="32" cy="32" r={RING_RADIUS} />
        <circle
          className="timer-fill"
          cx="32"
          cy="32"
          r={RING_RADIUS}
          strokeDasharray={RING_LENGTH}
          strokeDashoffset={RING_LENGTH * (1 - fraction)}
        />
      </svg>
      <span className="countdown" aria-hidden="true">
        {seconds}
      </span>
      <span className="sr-only" aria-live="polite">
        {announce}
      </span>
    </div>
  );
}
