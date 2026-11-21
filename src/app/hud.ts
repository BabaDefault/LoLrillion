import type { PromptResultView } from "@/server/game-service";
import { tierTone, type TierTone } from "./tier-tone";

/** One progress pip in the HUD: a finished Prompt's tone, the Prompt being played, or one still to come. */
export type Pip = TierTone | "current" | "empty";

/** The HUD's progress row: one pip per Prompt, coloured like the share line once played. */
export function promptPips(results: ReadonlyArray<PromptResultView | null>, currentIndex: number): Pip[] {
  return results.map((result, i) => {
    if (result) return tierTone(result.status === "accepted" ? result.tier : null);
    return i === currentIndex ? "current" : "empty";
  });
}

/** The HUD score: the Points banked on every finished Prompt so far. */
export function runningScore(results: ReadonlyArray<PromptResultView | null>): number {
  return results.reduce((sum, r) => sum + (r?.points ?? 0), 0);
}

/** How much of the answer window is left at `now`, from 1 (just opened) to 0 (closed): drives the timer ring. */
export function timerFraction(opensAt: number, closesAt: number, now: number): number {
  const span = closesAt - opensAt;
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (closesAt - now) / span));
}
