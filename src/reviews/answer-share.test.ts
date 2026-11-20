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
  const yordles = prompt("yordles", { "champion:Teemo": "minion", "champion:Gnar": "too-clever", "champion:Kled": "pentakill" });
  const ionia = prompt("ionia", { "champion:Ahri": "minion", "champion:Irelia": "kill" });

  it("adds up a Template's counts over every Puzzle Day it was played, as a share of that day's players", () => {
    const report = answerShareReport(
      [puzzle("2026-11-20", [yordles, ionia]), puzzle("2026-11-24", [ionia, yordles])],
      {
        "2026-11-20": { players: 10, byPrompt: [{ "champion:Teemo": 6, "champion:Gnar": 3 }, { "champion:Ahri": 9 }] },
        "2026-11-24": { players: 30, byPrompt: [{ "champion:Irelia": 12 }, { "champion:Teemo": 10, "champion:Gnar": 15, "champion:Kled": 1 }] },
      },
    );
    const y = report.find((r) => r.templateId === "yordles")!;
    expect(y.days).toEqual(["2026-11-20", "2026-11-24"]);
    expect(y.players).toBe(40);
    expect(y.answers).toEqual([
      { entity: "champion:Gnar", tier: "too-clever", count: 18, share: 0.45 },
      { entity: "champion:Teemo", tier: "minion", count: 16, share: 0.4 },
      { entity: "champion:Kled", tier: "pentakill", count: 1, share: 0.025 },
    ]);
  });

  it("lists never-chosen answers with a share of 0, and skips days with no counts", () => {
    const report = answerShareReport([puzzle("2026-11-20", [ionia]), puzzle("2026-11-21", [ionia])], {
      "2026-11-20": { players: 4, byPrompt: [{ "champion:Ahri": 1 }] },
    });
    expect(report).toEqual([
      {
        templateId: "ionia",
        days: ["2026-11-20"],
        players: 4,
        answers: [
          { entity: "champion:Ahri", tier: "minion", count: 1, share: 0.25 },
          { entity: "champion:Irelia", tier: "kill", count: 0, share: 0 },
        ],
      },
    ]);
  });
});
