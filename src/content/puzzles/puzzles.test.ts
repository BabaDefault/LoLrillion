import { describe, expect, it } from "vitest";
import { gameDataSnapshot } from "@/content/game-data/snapshot-data";
import { entityRegistry } from "@/content/game-data";
import { puzzleNumberOf } from "@/engine";
import { FIRST_PUZZLE_DAY } from "./config";
import { datedPuzzles } from "./index";

const known = new Map(entityRegistry.map((e) => [e.id, e.answerType]));

describe("committed dated Puzzles", () => {
  const entries = Object.entries(datedPuzzles);

  it("exist", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)("%s: seven Prompts, numbered, with the data version and one Gem each", (day, puzzle) => {
    expect(puzzle.puzzleDay).toBe(day);
    expect(puzzle.puzzleNumber).toBe(puzzleNumberOf(day, FIRST_PUZZLE_DAY));
    expect(puzzle.dataVersion).toBe(gameDataSnapshot.patch);
    expect(puzzle.prompts).toHaveLength(7);
    for (const prompt of puzzle.prompts) {
      expect(Object.values(prompt.answerSet).filter((t) => t === "pentakill"), prompt.templateId).toHaveLength(1);
      for (const id of Object.keys(prompt.answerSet)) expect(known.get(id), id).toBe(prompt.answerType);
    }
  });
});
