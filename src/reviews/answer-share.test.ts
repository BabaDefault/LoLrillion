import { describe, expect, it } from "vitest";
import type { BuiltPrompt, GeneratedPuzzle } from "@/builder";
import { answerShareReport } from "./index";

const prompt = (templateId: string, answerSet: BuiltPrompt["answerSet"]): BuiltPrompt => ({
  templateId,
  text: templateId,
  answerType: "champion",
  rule: "",
  answerSet,
});

const puzzle = (puzzleDay: string, prompts: BuiltPrompt[]): GeneratedPuzzle => ({
  puzzleDay,
  puzzleNumber: 1,
  dataVersion: "16.23.1",
  prompts,
});

describe("Answer Share report", () => {
  const dashes = prompt("dashes", { "champion:Yasuo": "minion", "champion:Kindred": "too-clever", "champion:Rell": "pentakill" });
  const stuns = prompt("stuns", { "champion:Annie": "minion", "champion:Irelia": "kill" });

  it("adds up a Template's counts over every Puzzle Day it was played, as a share of that day's players", () => {
    const report = answerShareReport(
      [puzzle("2026-11-20", [dashes, stuns]), puzzle("2026-11-24", [stuns, dashes])],
      {
        "2026-11-20": { players: 10, byPrompt: [{ "champion:Yasuo": 6, "champion:Kindred": 3 }, { "champion:Annie": 9 }] },
        "2026-11-24": { players: 30, byPrompt: [{ "champion:Irelia": 12 }, { "champion:Yasuo": 10, "champion:Kindred": 15, "champion:Rell": 1 }] },
      },
    );
    const y = report.find((r) => r.templateId === "dashes")!;
    expect(y.days).toEqual(["2026-11-20", "2026-11-24"]);
    expect(y.players).toBe(40);
    expect(y.answers).toEqual([
      { entity: "champion:Kindred", tier: "too-clever", count: 18, share: 0.45 },
      { entity: "champion:Yasuo", tier: "minion", count: 16, share: 0.4 },
      { entity: "champion:Rell", tier: "pentakill", count: 1, share: 0.025 },
    ]);
  });

  it("lists never-chosen answers with a share of 0, and skips days with no counts", () => {
    const report = answerShareReport([puzzle("2026-11-20", [stuns]), puzzle("2026-11-21", [stuns])], {
      "2026-11-20": { players: 4, byPrompt: [{ "champion:Annie": 1 }] },
    });
    expect(report).toEqual([
      {
        templateId: "stuns",
        days: ["2026-11-20"],
        players: 4,
        answers: [
          { entity: "champion:Annie", tier: "minion", count: 1, share: 0.25 },
          { entity: "champion:Irelia", tier: "kill", count: 0, share: 0 },
        ],
      },
    ]);
  });
});
