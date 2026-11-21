import { promptOutcome, type PromptOutcome, type PromptPlay } from "./play";

export type PromptProgress = PromptOutcome | { status: "not-started" };

export interface PuzzleProgress {
  /** One entry per Prompt, in order. */
  outcomes: PromptProgress[];
  /** The Prompt the player is on (the first not yet Accepted or Missed), or null when finished. */
  currentIndex: number | null;
  finished: boolean;
  /** The daily total so far: the sum of Points of Accepted Prompts (Misses score 0). */
  total: number;
}

function isResolved(o: PromptProgress): boolean {
  return o.status === "accepted" || o.status === "missed";
}

/**
 * Where a player stands in a Puzzle at `now`, given their PromptPlay for each Prompt
 * (indexed by Prompt; missing or null entries are Prompts not yet started).
 */
export function puzzleProgress(
  promptCount: number,
  plays: ReadonlyArray<PromptPlay | null | undefined>,
  now: number,
): PuzzleProgress {
  const outcomes: PromptProgress[] = Array.from({ length: promptCount }, (_, i) => {
    const play = plays[i];
    return play ? promptOutcome(play, now) : { status: "not-started" };
  });
  const firstOpen = outcomes.findIndex((o) => !isResolved(o));
  const total = outcomes.reduce((sum, o) => sum + ("points" in o ? o.points : 0), 0);
  return {
    outcomes,
    currentIndex: firstOpen === -1 ? null : firstOpen,
    finished: firstOpen === -1,
    total,
  };
}
