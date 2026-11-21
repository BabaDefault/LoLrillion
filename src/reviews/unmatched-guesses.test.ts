import { describe, expect, it } from "vitest";
import type { BuiltPrompt, GeneratedPuzzle } from "@/builder";
import type { Entity } from "@/engine";
import { unmatchedGuessReport, type LoggedAttempt } from "./index";

const prompt = (templateId: string, answerType: BuiltPrompt["answerType"], answerSet: BuiltPrompt["answerSet"]): BuiltPrompt => ({
  templateId,
  text: `Prompt ${templateId}`,
  answerType,
  rule: "",
  answerSet,
});

const puzzle = (puzzleDay: string, prompts: BuiltPrompt[]): GeneratedPuzzle => ({
  puzzleDay,
  puzzleNumber: 1,
  dataVersion: "16.23.1",
  prompts,
});

const entities: Entity[] = [
  { id: "champion:Teemo", name: "Teemo", answerType: "champion", aliases: [] },
  { id: "champion:Gnar", name: "Gnar", answerType: "champion", aliases: [] },
  { id: "champion:MonkeyKing", name: "Wukong", answerType: "champion", aliases: ["Monkey King"] },
  { id: "item:3157", name: "Zhonya's Hourglass", answerType: "item", aliases: [] },
];

const dashes = prompt("dashes", "champion", { "champion:Teemo": "minion" });
const items = prompt("items", "item", { "item:3157": "minion" });

const rejection = (over: Partial<LoggedAttempt>): LoggedAttempt => ({
  playerId: "p1",
  puzzleDay: "2026-11-20",
  promptIndex: 0,
  guess: "x",
  result: "rejected",
  reason: "no-match",
  confirmedEntityId: null,
  ...over,
});

describe("unmatched Guess report", () => {
  it("groups a Template's Rejected Guesses by normalized text, with counts and distinct players, most frequent first", () => {
    const report = unmatchedGuessReport([puzzle("2026-11-20", [dashes])], entities, [
      rejection({ playerId: "p1", guess: "Tristanna" }),
      rejection({ playerId: "p2", guess: "Smolder" }),
      rejection({ playerId: "p3", guess: "tristanna " }),
      rejection({ playerId: "p3", guess: "TRISTANNA" }),
    ]);
    expect(report).toEqual([
      {
        templateId: "dashes",
        prompt: "Prompt dashes",
        answerType: "champion",
        days: ["2026-11-20"],
        guesses: [
          { normalized: "tristanna", spellings: ["Tristanna", "tristanna ", "TRISTANNA"], count: 3, players: 2, entity: null },
          { normalized: "smolder", spellings: ["Smolder"], count: 1, players: 1, entity: null },
        ],
      },
    ]);
  });

  it("counts only Guesses rejected as answers: not Did-you-mean, wrong Answer Type, closed windows, or days with no dated Puzzle", () => {
    const report = unmatchedGuessReport([puzzle("2026-11-20", [dashes])], entities, [
      rejection({ guess: "Tristanna" }),
      rejection({ guess: "Tristan", result: "did-you-mean", reason: null }),
      rejection({ guess: "Zhonyas", result: "wrong-answer-type", reason: null }),
      rejection({ guess: "Teemo", result: "accepted", reason: null }),
      rejection({ guess: "Late", reason: "window-closed" }),
      rejection({ guess: "Early", reason: "read-window" }),
      rejection({ guess: "Again", reason: "locked" }),
      rejection({ guess: "Smoke", puzzleDay: "2027-01-15" }),
      rejection({ guess: "Beyond", promptIndex: 5 }),
    ]);
    expect(report.map((r) => r.guesses.map((g) => g.normalized))).toEqual([["tristanna"]]);
  });

  it("marks Guesses that name an Entity of the Answer Type (by name, Alias or confirmed Entity) apart from those that name none", () => {
    const report = unmatchedGuessReport([puzzle("2026-11-20", [dashes, items])], entities, [
      rejection({ guess: "gnar", reason: "not-in-answer-set" }),
      rejection({ guess: "Monkey King", reason: "not-in-answer-set" }),
      rejection({ guess: null, reason: "not-in-answer-set", confirmedEntityId: "champion:MonkeyKing", playerId: "p2" }),
      rejection({ guess: "Gnarr", reason: "not-in-answer-set", confirmedEntityId: "champion:Gnar", playerId: "p3" }),
      // An Entity of another Answer Type is not a likely missing answer here.
      rejection({ guess: "Teemo", promptIndex: 1 }),
    ]);
    expect(report.find((r) => r.templateId === "dashes")!.guesses).toEqual([
      { normalized: "gnar", spellings: ["gnar"], count: 1, players: 1, entity: { id: "champion:Gnar", name: "Gnar" } },
      { normalized: "gnarr", spellings: ["Gnarr"], count: 1, players: 1, entity: { id: "champion:Gnar", name: "Gnar" } },
      { normalized: "monkeyking", spellings: ["Monkey King"], count: 1, players: 1, entity: { id: "champion:MonkeyKing", name: "Wukong" } },
      // A confirmed "Did you mean" logged without its typed Guess counts under the Entity's name.
      { normalized: "wukong", spellings: ["Wukong"], count: 1, players: 1, entity: { id: "champion:MonkeyKing", name: "Wukong" } },
    ]);
    expect(report.find((r) => r.templateId === "items")!.guesses[0].entity).toBeNull();
  });
});
