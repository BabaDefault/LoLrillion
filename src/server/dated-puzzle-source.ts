import type { GeneratedPuzzle } from "@/builder";
import { puzzleDayOf, type Entity } from "@/engine";
import type { PuzzleSource } from "./puzzle-source";

export interface DatedPuzzleSourceOptions {
  /** Generated Puzzles keyed by Puzzle Day. Server-only: they hold Answer Sets. */
  puzzles: Readonly<Record<string, GeneratedPuzzle>>;
  entities: readonly Entity[];
  /** Serves a day with no generated Puzzle (e.g. the sample, so dev keeps working). */
  fallback: PuzzleSource;
}

/**
 * Serves the Puzzle generated for a Puzzle Day (Sydney time), else the fallback. No scheduled
 * job: the date alone picks it.
 */
export function createDatedPuzzleSource({ puzzles, entities, fallback }: DatedPuzzleSourceOptions): PuzzleSource {
  return {
    async forDay(puzzleDay) {
      const dated = Object.hasOwn(puzzles, puzzleDay) ? puzzles[puzzleDay] : undefined;
      if (!dated) return fallback.forDay(puzzleDay);
      return {
        puzzleDay,
        puzzleNumber: dated.puzzleNumber,
        puzzle: {
          prompts: dated.prompts.map(({ text, answerType, rule, answerSet }) => ({ text, answerType, rule, answerSet })),
        },
        entities,
        generated: true,
      };
    },

    async pastDays(now) {
      const today = puzzleDayOf(now);
      // `YYYY-MM-DD` strings sort chronologically.
      return Object.keys(puzzles)
        .filter((day) => day < today)
        .sort()
        .reverse()
        .map((puzzleDay) => ({ puzzleDay, puzzleNumber: puzzles[puzzleDay].puzzleNumber }));
    },

    async upcomingDays(now) {
      const today = puzzleDayOf(now);
      return Object.keys(puzzles)
        .filter((day) => day > today)
        .sort()
        .map((puzzleDay) => ({ puzzleDay, puzzleNumber: puzzles[puzzleDay].puzzleNumber }));
    },
  };
}
