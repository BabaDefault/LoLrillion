import { describe, expect, it } from "vitest";
import { personalStats } from "./index";

describe("personal stats", () => {
  it("is empty before any finished game", () => {
    expect(personalStats([])).toEqual({
      gamesPlayed: 0,
      averageScore: null,
      tierCounts: { minion: 0, "too-clever": 0, kill: 0, "triple-kill": 0, "quadra-kill": 0, pentakill: 0, miss: 0 },
      gemsFound: 0,
      bestDay: null,
    });
  });

  it("counts games, averages totals, tallies Tiers and Misses, and counts Gems", () => {
    const stats = personalStats([
      // 10 + 100 + 0 = 110
      { puzzleDay: "2026-11-20", results: ["minion", "pentakill", null] },
      // 15 + 60 + 85 = 160
      { puzzleDay: "2026-11-21", results: ["too-clever", "triple-kill", "quadra-kill"] },
      // 30 + 100 + 100 = 230
      { puzzleDay: "2026-11-22", results: ["kill", "pentakill", "pentakill"] },
    ]);
    expect(stats.gamesPlayed).toBe(3);
    expect(stats.averageScore).toBe(500 / 3);
    expect(stats.tierCounts).toEqual({
      minion: 1,
      "too-clever": 1,
      kill: 1,
      "triple-kill": 1,
      "quadra-kill": 1,
      pentakill: 3,
      miss: 1,
    });
    expect(stats.gemsFound).toBe(3);
    expect(stats.bestDay).toEqual({ puzzleDay: "2026-11-22", total: 230 });
  });

  it("keeps the earliest day as best day when totals tie", () => {
    const stats = personalStats([
      { puzzleDay: "2026-11-21", results: ["kill"] },
      { puzzleDay: "2026-11-20", results: ["kill"] },
    ]);
    expect(stats.bestDay).toEqual({ puzzleDay: "2026-11-20", total: 30 });
  });
});
