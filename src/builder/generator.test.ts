import { describe, expect, it } from "vitest";
import { addDays, type AnswerType, type Tier } from "@/engine";
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

  it("only uses Answer Sets of about 8-100 with at least a few Triple Kill-or-better answers", () => {
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

  it("puts at most one esports Prompt in a Puzzle", () => {
    const esports = Array.from({ length: 30 }, (_, i) => prompt(`pro-${i}`, "pro-player"));
    const days = ["2026-11-20", "2026-11-21", "2026-11-22", "2026-11-23", "2026-11-24"];
    const counts = days.map((day) => {
      const [puzzle] = generatePuzzles({ ...base, dates: [day], prompts: [...esports, ...pool] });
      return puzzle.prompts.filter((p) => p.answerType === "pro-player").length;
    });
    expect(counts.every((n) => n === 1)).toBe(true);
  });

  it("never repeats a Template within the no-repeat window, counting earlier Puzzles", () => {
    const history = { "2026-11-19": ["champ-0", "item-0", "skin-0"] };
    const puzzles = generatePuzzles({ ...base, dates: ["2026-11-20", "2026-11-21"], history, noRepeatDays: 2 });
    expect(ids(puzzles[0])).not.toContain("champ-0");
    expect(ids(puzzles[0])).not.toContain("skin-0");
    const first = new Set(ids(puzzles[0]));
    expect(ids(puzzles[1]).filter((id) => first.has(id))).toEqual([]);
  });

  it("never puts two Templates of one family in a Puzzle", () => {
    // champ-0..3 overlap (e.g. pull, melee pull, pull + stun); item-0 and item-1 share "health".
    const families = {
      "champ-0": ["pull"],
      "champ-1": ["pull"],
      "champ-2": ["pull", "stun"],
      "champ-3": ["stun"],
      "item-0": ["health"],
      "item-1": ["armor", "health"],
    };
    const dates = Array.from({ length: 10 }, (_, i) => addDays("2026-11-20", i));
    for (const puzzle of generatePuzzles({ ...base, dates, families, noRepeatDays: 1 })) {
      const today = ids(puzzle).flatMap((id) => families[id as keyof typeof families] ?? []);
      expect(new Set(today).size, puzzle.puzzleDay).toBe(today.length);
    }
  });

  it("holds back a Template whose sibling ran yesterday while fresher Templates are free", () => {
    const families = { "champ-0": ["pull"], "champ-1": ["pull"] };
    const history = { "2026-11-19": ["champ-0"] };
    const [puzzle] = generatePuzzles({ ...base, families, history });
    expect(ids(puzzle)).not.toContain("champ-1");
  });

  it("spreads Templates evenly: over five weeks every Template is used about as often", () => {
    const big = [
      ...Array.from({ length: 30 }, (_, i) => prompt(`champ-${i}`, "champion")),
      ...Array.from({ length: 20 }, (_, i) => prompt(`item-${i}`, "item")),
    ];
    const dates = Array.from({ length: 35 }, (_, i) => addDays("2026-11-20", i));
    const uses = new Map<string, number>();
    for (const p of generatePuzzles({ ...base, prompts: big, dates })) {
      for (const id of ids(p)) uses.set(id, (uses.get(id) ?? 0) + 1);
    }
    // 245 Prompts over 50 Templates is 4.9 each.
    expect(uses.size).toBe(50);
    expect(Math.max(...uses.values()) - Math.min(...uses.values())).toBeLessThanOrEqual(2);
  });

  it("narrows the no-repeat window for a day when the pool is too small, repeating the stalest Templates", () => {
    const small = [
      ...Array.from({ length: 8 }, (_, i) => prompt(`champ-${i}`, "champion")),
      ...Array.from({ length: 6 }, (_, i) => prompt(`item-${i}`, "item")),
    ];
    const dates = ["2026-11-20", "2026-11-21", "2026-11-22"];
    const puzzles = generatePuzzles({ ...base, prompts: small, dates, noRepeatDays: 5 });
    expect(ids(puzzles[1]).filter((id) => ids(puzzles[0]).includes(id))).toEqual([]);
    expect(ids(puzzles[2]).filter((id) => ids(puzzles[1]).includes(id))).toEqual([]);
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
