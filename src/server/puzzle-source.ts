import { sampleEntities, samplePuzzle } from "@/content/sample-puzzle";
import { FIRST_PUZZLE_DAY } from "@/content/puzzles/config";
import { puzzleNumberOf, type Entity, type Puzzle } from "@/engine";

/** The Puzzle served on one Puzzle Day, plus the Entities its Guesses resolve against. */
export interface DailyPuzzle {
  puzzleDay: string;
  /** The Puzzle's number, shown as `LoLrillion #N`: calendar days since the first Puzzle Day. */
  puzzleNumber: number;
  puzzle: Puzzle;
  entities: readonly Entity[];
  /** False when no Puzzle was generated for the day and the fallback (the sample) was served. */
  generated: boolean;
}

/**
 * The one lookup of "the Puzzle for a Puzzle Day", shared by play, results, stats and
 * leaderboards so they always agree on which Puzzle a day served.
 */
export interface PuzzleSource {
  /**
   * The Puzzle served on `puzzleDay`: the one generated for it, else the fallback. Callers decide
   * whether that day may be played (today live, past days in the archive, never the future).
   */
  forDay(puzzleDay: string): Promise<DailyPuzzle>;
  /** The archive: Puzzle Days with a generated Puzzle strictly before today's, newest first. */
  pastDays(now: number): Promise<ArchiveDay[]>;
}

/** One past Puzzle listed in the archive. */
export interface ArchiveDay {
  puzzleDay: string;
  puzzleNumber: number;
}

/** Always serves the hand-written sample Puzzle, numbered by its Puzzle Day. It has no archive. */
export const samplePuzzleSource: PuzzleSource = {
  async forDay(puzzleDay) {
    return {
      puzzleDay,
      puzzleNumber: puzzleNumberOf(puzzleDay, FIRST_PUZZLE_DAY),
      puzzle: samplePuzzle,
      entities: sampleEntities,
      generated: false,
    };
  },
  async pastDays() {
    return [];
  },
};
