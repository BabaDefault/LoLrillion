import { describe, expect, it } from "vitest";
import { activeNavHref, NAV_ITEMS } from "./nav";

describe("activeNavHref", () => {
  it("marks Today on the home page", () => {
    expect(activeNavHref("/")).toBe("/");
  });

  it("leaves out the archive, which is admin-only", () => {
    expect(NAV_ITEMS.map((i) => i.href)).not.toContain("/archive");
    expect(activeNavHref("/archive")).toBeNull();
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
