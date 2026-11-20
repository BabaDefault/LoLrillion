import { describe, expect, it } from "vitest";
import type { Entity } from "@/engine";
import type { GeneratedPuzzle } from "@/builder";
import { createDatedPuzzleSource } from "./dated-puzzle-source";
import type { PuzzleSource } from "./puzzle-source";

const entities: Entity[] = [{ id: "champion:Teemo", name: "Teemo", answerType: "champion", aliases: [] }];

const dated = (puzzleDay: string, puzzleNumber: number): GeneratedPuzzle => ({
  puzzleDay,
  puzzleNumber,
  dataVersion: "16.23.1",
  prompts: [
    {
      templateId: "champions-yordle",
      text: `Name a Yordle (${puzzleDay})`,
      answerType: "champion",
      rule: "Yordles.",
      answerSet: { "champion:Teemo": "pentakill" },
    },
  ],
});

const fallback: PuzzleSource = {
  async current() {
    return { puzzleDay: "sample", puzzleNumber: 1, puzzle: { prompts: [] }, entities: [] };
  },
};

const source = createDatedPuzzleSource({
  puzzles: { "2026-11-20": dated("2026-11-20", 1), "2026-11-21": dated("2026-11-21", 2) },
  entities,
  fallback,
});

describe("dated Puzzle source", () => {
  it("serves the Puzzle dated today in Sydney, with its number", async () => {
    // 13:30 UTC on the 20th is 00:30 on the 21st in Sydney (AEDT).
    const daily = await source.current(Date.parse("2026-11-20T13:30:00Z"));
    expect(daily).toMatchObject({ puzzleDay: "2026-11-21", puzzleNumber: 2, entities });
    expect(daily.puzzle.prompts[0]).toEqual({
      text: "Name a Yordle (2026-11-21)",
      answerType: "champion",
      rule: "Yordles.",
      answerSet: { "champion:Teemo": "pentakill" },
    });
  });

  it("falls back (keyed by today's Puzzle Day) when nothing is generated for today", async () => {
    const daily = await source.current(Date.parse("2027-01-01T03:00:00Z"));
    expect(daily).toMatchObject({ puzzleDay: "2027-01-01", puzzleNumber: 1, puzzle: { prompts: [] } });
  });
});
