import type { GeneratedPuzzle } from "@/builder";
import { puzzleDayOf, type Entity } from "@/engine";
import type { PuzzleSource } from "./puzzle-source";

export interface DatedPuzzleSourceOptions {
  /** Generated Puzzles keyed by Puzzle Day. Server-only: they hold Answer Sets. */
  puzzles: Readonly<Record<string, GeneratedPuzzle>>;
  entities: readonly Entity[];
  /** Used when no Puzzle is generated for today (e.g. the sample, so dev keeps working). */
  fallback: PuzzleSource;
}

/** Serves the Puzzle dated today in Sydney time. No scheduled job: the date alone picks it. */
export function createDatedPuzzleSource({ puzzles, entities, fallback }: DatedPuzzleSourceOptions): PuzzleSource {
  return {
    async current(now) {
      const puzzleDay = puzzleDayOf(now);
      const dated = puzzles[puzzleDay];
      if (!dated) return { ...(await fallback.current(now)), puzzleDay };
      return {
        puzzleDay,
        puzzleNumber: dated.puzzleNumber,
        puzzle: {
          prompts: dated.prompts.map(({ text, answerType, rule, answerSet }) => ({ text, answerType, rule, answerSet })),
        },
        entities,
      };
    },
  };
}
