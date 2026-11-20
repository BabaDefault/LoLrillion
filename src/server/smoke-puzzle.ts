import { FIRST_PUZZLE_DAY } from "@/content/puzzles/config";
import { puzzleNumberOf, type Entity, type Puzzle } from "@/engine";
import type { PuzzleSource } from "./puzzle-source";

/**
 * The fixed Puzzle the Playwright smoke test plays (served only in smoke-test mode). It has its
 * own tiny Entity list so it never changes when the real game data or dated Puzzles do.
 * `e2e/smoke.spec.ts` relies on these names and Tiers.
 */
export const smokeEntities: readonly Entity[] = [
  { id: "smoke:teemo", name: "Teemo", answerType: "champion", aliases: [] },
  { id: "smoke:annie", name: "Annie", answerType: "champion", aliases: [] },
  { id: "smoke:garen", name: "Garen", answerType: "champion", aliases: [] },
  { id: "smoke:lux", name: "Lux", answerType: "champion", aliases: [] },
  { id: "smoke:ahri", name: "Ahri", answerType: "champion", aliases: [] },
  { id: "smoke:kassadin", name: "Kassadin", answerType: "champion", aliases: [] },
  { id: "smoke:infinityedge", name: "Infinity Edge", answerType: "item", aliases: ["IE"] },
  { id: "smoke:zhonyas", name: "Zhonya's Hourglass", answerType: "item", aliases: ["Zhonyas"] },
];

const rule = "Smoke-test Prompt.";

export const smokePuzzle: Puzzle = {
  prompts: [
    { text: "Smoke 1: name a Yordle", answerType: "champion", rule, answerSet: { "smoke:teemo": "minion", "smoke:annie": "kill" } },
    { text: "Smoke 2: name a mage", answerType: "champion", rule, answerSet: { "smoke:ahri": "minion", "smoke:kassadin": "pentakill" } },
    { text: "Smoke 3: name a champion", answerType: "champion", rule, answerSet: { "smoke:garen": "minion", "smoke:lux": "kill" } },
    { text: "Smoke 4: name an item", answerType: "item", rule, answerSet: { "smoke:infinityedge": "triple-kill", "smoke:zhonyas": "minion" } },
    { text: "Smoke 5: name a champion", answerType: "champion", rule, answerSet: { "smoke:lux": "kill", "smoke:ahri": "minion" } },
    { text: "Smoke 6: name a champion", answerType: "champion", rule, answerSet: { "smoke:garen": "quadra-kill", "smoke:annie": "minion" } },
    { text: "Smoke 7: name a champion", answerType: "champion", rule, answerSet: { "smoke:annie": "too-clever", "smoke:teemo": "minion" } },
  ],
};

/** Serves the smoke Puzzle on every Puzzle Day; no archive. */
export const smokePuzzleSource: PuzzleSource = {
  async forDay(puzzleDay) {
    return {
      puzzleDay,
      puzzleNumber: puzzleNumberOf(puzzleDay, FIRST_PUZZLE_DAY),
      puzzle: smokePuzzle,
      entities: smokeEntities,
      generated: true,
    };
  },
  async pastDays() {
    return [];
  },
};
