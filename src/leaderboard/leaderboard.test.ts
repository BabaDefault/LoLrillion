import { describe, expect, it } from "vitest";
import { rankLeaderboard, validateNickname } from "./index";

describe("ranking a Puzzle Day's leaderboard", () => {
  it("ranks by total, highest first, with tied totals sharing a rank", () => {
    const ranked = rankLeaderboard([
      { playerKey: "a", nickname: "Ana", total: 120 },
      { playerKey: "b", nickname: "Bo", total: 450 },
      { playerKey: "c", nickname: "Cy", total: 300 },
      { playerKey: "d", nickname: "Di", total: 300 },
    ]);
    expect(ranked.map((r) => [r.rank, r.nickname, r.total])).toEqual([
      [1, "Bo", 450],
      [2, "Cy", 300],
      [2, "Di", 300],
      [4, "Ana", 120],
    ]);
  });
});

describe("nicknames", () => {
  it("trims and collapses spaces, keeping the player's capitalization", () => {
    expect(validateNickname("  Faker   Fan ")).toEqual({ ok: true, value: "Faker Fan" });
  });

  it("refuses an empty nickname", () => {
    expect(validateNickname("   ")).toEqual({ ok: false, error: "empty" });
  });

  it("refuses a nickname longer than 20 characters", () => {
    expect(validateNickname("a".repeat(20))).toEqual({ ok: true, value: "a".repeat(20) });
    expect(validateNickname("a".repeat(21))).toEqual({ ok: false, error: "too-long" });
  });

  it("drops control characters", () => {
    expect(validateNickname("Te\u0000emo\n")).toEqual({ ok: true, value: "Teemo" });
  });
});
