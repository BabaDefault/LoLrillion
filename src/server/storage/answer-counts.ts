import type { EntityId } from "@/engine";

/** How many of a Puzzle Day's players chose each Entity, per Prompt. Drives Answer Share only, never Points. */
export interface AnswerCounts {
  /** Today's players: the denominator for Answer Share. */
  players: number;
  /** Indexed by Prompt; a missing Prompt or Entity means a count of zero. */
  byPrompt: ReadonlyArray<Readonly<Record<EntityId, number>> | undefined>;
}

/** Supplies Answer Counts for the end screen. Every PlayStore implements this. */
export interface AnswerCountSource {
  getAnswerCounts(puzzleDay: string, promptCount: number): Promise<AnswerCounts>;
}
