import { describe, expect, it } from "vitest";
import { puzzleDayOf } from "@/engine";
import {
  generateGroupCode,
  leaderboardPhase,
  momentOnPuzzleDay,
  parseGroupCode,
  rankLeaderboard,
  validateGroupName,
  validateNickname,
} from "./index";

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

  it("lists tied players by nickname, with players who have no nickname last", () => {
    const ranked = rankLeaderboard([
      { playerKey: "x", nickname: null, total: 50 },
      { playerKey: "z", nickname: "Zed", total: 50 },
      { playerKey: "a", nickname: "ana", total: 50 },
    ]);
    expect(ranked.map((r) => r.nickname)).toEqual(["ana", "Zed", null]);
    expect(ranked.every((r) => r.rank === 1)).toBe(true);
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

describe("friend groups", () => {
  it("makes short codes from letters and digits that can't be misread (no 0/O, 1/I/L)", () => {
    const random = sequence([0, 0.5, 0.999, 0.25, 0.75, 0.1]);
    const code = generateGroupCode(random);
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(code).not.toMatch(/[01OIL]/);
  });

  it("makes different codes from different randomness", () => {
    expect(generateGroupCode(sequence([0.1]))).not.toBe(generateGroupCode(sequence([0.9])));
  });

  it("reads a typed code however it's spaced or capitalized", () => {
    const code = generateGroupCode(sequence([0.3, 0.6]));
    const typed = ` ${code.slice(0, 3).toLowerCase()}-${code.slice(3)} `;
    expect(parseGroupCode(typed)).toBe(code);
  });

  it("refuses something that can't be a code", () => {
    expect(parseGroupCode("ABC")).toBeNull();
    expect(parseGroupCode("ABCDEFG")).toBeNull();
    expect(parseGroupCode("ABCD0O")).toBeNull();
  });

  it("names a group like a nickname, up to 30 characters", () => {
    expect(validateGroupName("  the   boys ")).toEqual({ ok: true, value: "the boys" });
    expect(validateGroupName("")).toEqual({ ok: false, error: "empty" });
    expect(validateGroupName("x".repeat(31))).toEqual({ ok: false, error: "too-long" });
  });
});

describe("when a Puzzle Day's leaderboard is final", () => {
  it("is live on its own Puzzle Day, final once it has passed, and not open before it starts", () => {
    expect(leaderboardPhase("2026-11-20", "2026-11-20")).toBe("live");
    expect(leaderboardPhase("2026-11-19", "2026-11-20")).toBe("final");
    expect(leaderboardPhase("2025-12-31", "2026-01-01")).toBe("final");
    expect(leaderboardPhase("2026-11-21", "2026-11-20")).toBe("future");
  });

  it("finds a moment inside any Puzzle Day, including both daylight-saving changeover days", () => {
    for (const day of ["2026-04-05", "2026-10-04", "2026-11-20", "2026-07-01"]) {
      expect(puzzleDayOf(momentOnPuzzleDay(day))).toBe(day);
    }
  });
});

/** A repeatable stand-in for Math.random that cycles through the given values. */
function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}
