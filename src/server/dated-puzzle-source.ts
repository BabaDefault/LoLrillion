import type { GeneratedPuzzle } from "@/builder";
import { puzzleDayOf, type Entity } from "@/engine";
import type { DailyPuzzle, PuzzleSource } from "./puzzle-source";

export interface DatedPuzzleSourceOptions {
  /** Generated Puzzles keyed by Puzzle Day. Server-only: they hold Answer Sets. */
  puzzles: Readonly<Record<string, GeneratedPuzzle>>;
  entities: readonly Entity[];
  /** Used when no Puzzle is generated for today (e.g. the sample, so dev keeps working). */
  fallback: PuzzleSource;
}

/** Serves the Puzzle dated today in Sydney time. No scheduled job: the date alone picks it. */
export function createDatedPuzzleSource({ puzzles, entities, fallback }: DatedPuzzleSourceOptions): Required<PuzzleSource> {
  function daily(puzzleDay: string): DailyPuzzle | null {
    const dated = Object.hasOwn(puzzles, puzzleDay) ? puzzles[puzzleDay] : undefined;
    if (!dated) return null;
    return {
      puzzleDay,
      puzzleNumber: dated.puzzleNumber,
      puzzle: {
        prompts: dated.prompts.map(({ text, answerType, rule, answerSet }) => ({ text, answerType, rule, answerSet })),
      },
      entities,
    };
  }

  return {
    async current(now) {
      const puzzleDay = puzzleDayOf(now);
      return daily(puzzleDay) ?? { ...(await fallback.current(now)), puzzleDay };
    },

    async forDay(puzzleDay) {
      return daily(puzzleDay);
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
  };
}
