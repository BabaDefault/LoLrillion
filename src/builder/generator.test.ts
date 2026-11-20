import { describe, expect, it } from "vitest";
import type { AnswerType, Tier } from "@/engine";
import { generatePuzzles, type BuiltPrompt, type GenerateInput } from "./index";

/** A built Prompt with `size` answers, `rare` of them Triple Kill or better. */
function prompt(templateId: string, answerType: AnswerType, size = 20, rare = 6): BuiltPrompt {
  const answerSet: Record<string, Tier> = {};
  for (let i = 0; i < size; i++) answerSet[`${answerType}:${templateId}-${i}`] = i < rare ? "triple-kill" : "minion";
  return { templateId, text: `Name a ${templateId}`, answerType, rule: "", answerSet };
}

const pool: BuiltPrompt[] = [
  ...Array.from({ length: 10 }, (_, i) => prompt(`champ-${i}`, "champion")),
  ...Array.from({ length: 6 }, (_, i) => prompt(`item-${i}`, "item")),
  ...Array.from({ length: 6 }, (_, i) => prompt(`skin-${i}`, "skin")),
];

const base: GenerateInput = {
  dates: ["2026-11-20"],
  prompts: pool,
  firstPuzzleDay: "2026-11-20",
  dataVersion: "16.23.1",
};

const ids = (p: { prompts: readonly BuiltPrompt[] }) => p.prompts.map((x) => x.templateId);

describe("Puzzle generator", () => {
  it("picks seven different Templates and stores the Puzzle Day, number and data version", () => {
    const [puzzle] = generatePuzzles({ ...base, dates: ["2026-11-22"] });
    expect(puzzle).toMatchObject({ puzzleDay: "2026-11-22", puzzleNumber: 3, dataVersion: "16.23.1" });
    expect(new Set(ids(puzzle)).size).toBe(7);
  });

  it("is deterministic for a date", () => {
    expect(ids(generatePuzzles(base)[0])).toEqual(ids(generatePuzzles(base)[0]));
  });

  it("only uses Answer Sets of about 8-80 with at least a few Triple Kill-or-better answers", () => {
    const tooSmall = prompt("too-small", "item", 5, 3);
    const tooBig = prompt("too-big", "skin", 120, 30);
    const noRare = prompt("no-rare", "champion", 30, 1);
    const onlyGood = Array.from({ length: 7 }, (_, i) => prompt(`ok-${i}`, i < 4 ? "champion" : "item"));
    const [puzzle] = generatePuzzles({ ...base, prompts: [tooSmall, tooBig, noRare, ...onlyGood] });
    expect(ids(puzzle).sort()).toEqual(onlyGood.map((p) => p.templateId).sort());
  });

  it("mixes Answer Types: no more than four Prompts of one type", () => {
    for (const day of ["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23"]) {
      const [puzzle] = generatePuzzles({ ...base, dates: [day] });
      const counts = new Map<string, number>();
      for (const p of puzzle.prompts) counts.set(p.answerType, (counts.get(p.answerType) ?? 0) + 1);
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(4);
      expect(counts.size).toBeGreaterThanOrEqual(2);
    }
  });

  it("never repeats a Template within the no-repeat window, counting earlier Puzzles", () => {
    const history = { "2026-11-19": ["champ-0", "item-0", "skin-0"] };
    const puzzles = generatePuzzles({ ...base, dates: ["2026-11-20", "2026-11-21"], history, noRepeatDays: 2 });
    expect(ids(puzzles[0])).not.toContain("champ-0");
    expect(ids(puzzles[0])).not.toContain("skin-0");
    const first = new Set(ids(puzzles[0]));
    expect(ids(puzzles[1]).filter((id) => first.has(id))).toEqual([]);
  });

  it("uses a manual override for a date as given", () => {
    const override = ["skin-5", "skin-4", "champ-9", "champ-8", "item-5", "item-4", "item-3"];
    const [puzzle] = generatePuzzles({ ...base, overrides: { "2026-11-20": override } });
    expect(ids(puzzle)).toEqual(override);
  });

  it("fails loudly when the constraints can't be met", () => {
    expect(() => generatePuzzles({ ...base, prompts: pool.slice(0, 5) })).toThrow(/2026-11-20/);
    expect(() => generatePuzzles({ ...base, overrides: { "2026-11-20": ["nope"] } })).toThrow(/nope/);
  });
});
