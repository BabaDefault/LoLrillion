import { describe, expect, it } from "vitest";
import { puzzleDayOf, puzzleNumberOf } from "./index";

const at = (iso: string) => Date.parse(iso);

describe("Sydney Puzzle Day", () => {
  it("rolls over at midnight Sydney time, not UTC", () => {
    // 2026-11-20 is AEDT (UTC+11): midnight Sydney is 13:00 UTC the day before.
    expect(puzzleDayOf(at("2026-11-19T12:59:59Z"))).toBe("2026-11-19");
    expect(puzzleDayOf(at("2026-11-19T13:00:00Z"))).toBe("2026-11-20");
  });

  it("handles the day daylight saving ends (first Sunday of April, a 25-hour day)", () => {
    // 2026-04-05 starts at 00:00 AEDT (13:00Z on the 4th) and ends at 00:00 AEST (14:00Z on the 5th).
    expect(puzzleDayOf(at("2026-04-04T12:59:59Z"))).toBe("2026-04-04");
    expect(puzzleDayOf(at("2026-04-04T13:00:00Z"))).toBe("2026-04-05");
    expect(puzzleDayOf(at("2026-04-05T13:30:00Z"))).toBe("2026-04-05");
    expect(puzzleDayOf(at("2026-04-05T14:00:00Z"))).toBe("2026-04-06");
  });

  it("handles the day daylight saving starts (first Sunday of October, a 23-hour day)", () => {
    // 2026-10-04 starts at 00:00 AEST (14:00Z on the 3rd) and ends at 00:00 AEDT (13:00Z on the 4th).
    expect(puzzleDayOf(at("2026-10-03T13:30:00Z"))).toBe("2026-10-03");
    expect(puzzleDayOf(at("2026-10-03T14:00:00Z"))).toBe("2026-10-04");
    expect(puzzleDayOf(at("2026-10-04T12:59:59Z"))).toBe("2026-10-04");
    expect(puzzleDayOf(at("2026-10-04T13:00:00Z"))).toBe("2026-10-05");
  });
});

describe("Puzzle number", () => {
  it("is 1 on the first Puzzle Day and counts calendar days after it", () => {
    expect(puzzleNumberOf("2026-11-20", "2026-11-20")).toBe(1);
    expect(puzzleNumberOf("2026-11-21", "2026-11-20")).toBe(2);
    expect(puzzleNumberOf("2027-04-05", "2026-11-20")).toBe(137);
  });
});
