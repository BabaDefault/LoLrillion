import { describe, expect, it } from "vitest";
import { percentileBetterThan, scoreDistribution } from "./index";

describe("score distribution curve", () => {
  it("splits 0..maxTotal into equal bins, counts each total, and marks your bin", () => {
    // 7 Prompts × 100 max = 700; 7 bins of width 100: [0,100) [100,200) ... [600,700].
    const d = scoreDistribution([0, 40, 100, 150, 199, 350, 700], { maxTotal: 700, binCount: 7 }, 150);
    expect(d.bins).toEqual([
      { from: 0, to: 100, count: 2 },
      { from: 100, to: 200, count: 3 },
      { from: 200, to: 300, count: 0 },
      { from: 300, to: 400, count: 1 },
      { from: 400, to: 500, count: 0 },
      { from: 500, to: 600, count: 0 },
      { from: 600, to: 700, count: 1 },
    ]);
    expect(d.yourBin).toBe(1);
  });

  it("puts a perfect score in the last bin", () => {
    const d = scoreDistribution([700], { maxTotal: 700, binCount: 7 }, 700);
    expect(d.yourBin).toBe(6);
    expect(d.bins[6].count).toBe(1);
  });

  it("clamps totals outside 0..maxTotal into the end bins", () => {
    const d = scoreDistribution([-5, 900], { maxTotal: 100, binCount: 2 }, 900);
    expect(d.bins.map((b) => b.count)).toEqual([1, 1]);
    expect(d.yourBin).toBe(1);
  });
});

describe("percentile among today's players", () => {
  it("is the share of other players' totals strictly below yours, rounded down", () => {
    // You (200) beat 100 and 150; tie with one 200; lose to 300. Others = 4 → 2/4.
    expect(percentileBetterThan(200, [100, 150, 200, 200, 300])).toBe(50);
  });

  it("is 0 when you are the only player", () => {
    expect(percentileBetterThan(120, [120])).toBe(0);
  });

  it("is 100 when you beat everyone else", () => {
    expect(percentileBetterThan(500, [10, 20, 500])).toBe(100);
  });

  it("rounds down so nobody is 'better than 100%' unless they beat all", () => {
    // Beat 2 of 3 others → 66.67 → 66.
    expect(percentileBetterThan(50, [10, 20, 50, 90])).toBe(66);
  });
});
