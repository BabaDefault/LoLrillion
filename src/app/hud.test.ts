import { describe, expect, it } from "vitest";
import { promptPips, runningScore, timerFraction } from "./hud";

describe("promptPips", () => {
  it("shows finished Prompts in their Tier tone, the current one lit, and the rest empty", () => {
    const results = [
      { status: "accepted" as const, entityId: "teemo", entityName: "Teemo", tier: "kill" as const, points: 30 },
      { status: "missed" as const, points: 0 },
      null,
      null,
    ];
    expect(promptPips(results, 2)).toEqual(["green", "miss", "current", "empty"]);
  });
});

describe("runningScore", () => {
  it("adds up the Points of every finished Prompt so far", () => {
    const results = [
      { status: "accepted" as const, entityId: "teemo", entityName: "Teemo", tier: "kill" as const, points: 30 },
      { status: "missed" as const, points: 0 },
      { status: "accepted" as const, entityId: "kassadin", entityName: "Kassadin", tier: "pentakill" as const, points: 100 },
      null,
    ];
    expect(runningScore(results)).toBe(130);
  });
});

describe("timerFraction", () => {
  it("is the share of the answer window still left, clamped to 0..1", () => {
    expect(timerFraction(10_000, 35_000, 22_500)).toBe(0.5);
    expect(timerFraction(10_000, 35_000, 5_000)).toBe(1);
    expect(timerFraction(10_000, 35_000, 40_000)).toBe(0);
  });
});
