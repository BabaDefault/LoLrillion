import { describe, expect, it } from "vitest";
import { puzzleDayOf, type Entity } from "@/engine";
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
  async forDay(puzzleDay) {
    return { puzzleDay, puzzleNumber: 99, puzzle: { prompts: [] }, entities: [], generated: false };
  },
  async pastDays() {
    return [];
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
    const served = await source.forDay(puzzleDayOf(Date.parse("2026-11-20T13:30:00Z")));
    expect(served).toMatchObject({ puzzleDay: "2026-11-21", puzzleNumber: 2, entities, generated: true });
    expect(served.puzzle.prompts[0]).toEqual({
      text: "Name a Yordle (2026-11-21)",
      answerType: "champion",
      rule: "Yordles.",
      answerSet: { "champion:Teemo": "pentakill" },
    });
  });

  it("falls back (keyed by the Puzzle Day) when nothing is generated for that day", async () => {
    const served = await source.forDay("2027-01-01");
    expect(served).toMatchObject({ puzzleDay: "2027-01-01", puzzleNumber: 99, puzzle: { prompts: [] }, generated: false });
  });
});

describe("dated Puzzle source: the archive", () => {
  const three = createDatedPuzzleSource({
    puzzles: {
      "2026-11-20": dated("2026-11-20", 1),
      "2026-11-21": dated("2026-11-21", 2),
      "2026-11-22": dated("2026-11-22", 3),
    },
    entities,
    fallback,
  });

  it("lists past Puzzle Days only, newest first: never today or a future day", async () => {
    // 00:30 on the 22nd in Sydney.
    const past = await three.pastDays(Date.parse("2026-11-21T13:30:00Z"));
    expect(past).toEqual([
      { puzzleDay: "2026-11-21", puzzleNumber: 2 },
      { puzzleDay: "2026-11-20", puzzleNumber: 1 },
    ]);
  });

  it("serves a Puzzle by its day, and the fallback for a day with no generated Puzzle", async () => {
    const served = await three.forDay("2026-11-20");
    expect(served).toMatchObject({ puzzleDay: "2026-11-20", puzzleNumber: 1, entities, generated: true });
    expect(served.puzzle.prompts[0].text).toBe("Name a Yordle (2026-11-20)");
    expect(await three.forDay("2025-01-01")).toMatchObject({ generated: false });
  });
});
