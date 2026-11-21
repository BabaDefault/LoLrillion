import { describe, expect, it } from "vitest";
import { activeNavHref } from "./nav";

describe("activeNavHref", () => {
  it("marks Today on the home page", () => {
    expect(activeNavHref("/")).toBe("/");
  });

  it("marks Archive on the archive list and on a past Puzzle Day being replayed", () => {
    expect(activeNavHref("/archive")).toBe("/archive");
    expect(activeNavHref("/archive/2026-11-01")).toBe("/archive");
  });

  it("marks Stats and Leaderboard on their pages", () => {
    expect(activeNavHref("/stats")).toBe("/stats");
    expect(activeNavHref("/leaderboard")).toBe("/leaderboard");
  });

  it("marks nothing on a page outside the nav, even one sharing a prefix", () => {
    expect(activeNavHref("/archived")).toBeNull();
    expect(activeNavHref("/admin")).toBeNull();
  });
});
