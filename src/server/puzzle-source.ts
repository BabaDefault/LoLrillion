import { sampleEntities, samplePuzzle } from "@/content/sample-puzzle";
import type { Entity, Puzzle } from "@/engine";

/** The live Puzzle for a moment in time, plus the Entities its Guesses resolve against. */
export interface DailyPuzzle {
  puzzleDay: string;
  puzzle: Puzzle;
  entities: readonly Entity[];
}

/**
 * Supplies the live Puzzle. Later: a dated source keyed by the Sydney Puzzle Day,
 * and an Entity registry built from game data.
 */
export interface PuzzleSource {
  current(now: number): Promise<DailyPuzzle>;
}

/** Always serves the hand-written sample Puzzle. */
export const samplePuzzleSource: PuzzleSource = {
  async current() {
    return { puzzleDay: "sample", puzzle: samplePuzzle, entities: sampleEntities };
  },
};
