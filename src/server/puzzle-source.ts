import { sampleEntities, samplePuzzle } from "@/content/sample-puzzle";
import type { Entity, Puzzle } from "@/engine";

/** The live Puzzle for a moment in time, plus the Entities its Guesses resolve against. */
export interface DailyPuzzle {
  puzzleDay: string;
  /** The Puzzle's number, shown as `LoLrillion #N`. */
  puzzleNumber: number;
  puzzle: Puzzle;
  entities: readonly Entity[];
}

/**
 * Supplies the live Puzzle. Later: a dated source keyed by the Sydney Puzzle Day,
 * and an Entity registry built from game data.
 */
export interface PuzzleSource {
  current(now: number): Promise<DailyPuzzle>;
  /** The Puzzle dated `puzzleDay`, or null when there is none. Callers decide whether it may be played. */
  forDay?(puzzleDay: string): Promise<DailyPuzzle | null>;
  /** The archive: Puzzle Days strictly before today's (never today or a future day), newest first. */
  pastDays?(now: number): Promise<ArchiveDay[]>;
}

/** One past Puzzle listed in the archive. */
export interface ArchiveDay {
  puzzleDay: string;
  puzzleNumber: number;
}

/** Always serves the hand-written sample Puzzle. It has no archive. */
export const samplePuzzleSource: PuzzleSource = {
  async current() {
    // Placeholder number until dated Puzzles number themselves.
    return { puzzleDay: "sample", puzzleNumber: 1, puzzle: samplePuzzle, entities: sampleEntities };
  },
};
