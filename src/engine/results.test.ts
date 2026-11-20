import { describe, expect, it } from "vitest";
import { dayTitle } from "./index";

describe("day title", () => {
  it.each([
    [0, "Iron"],
    [150, "Iron"],
    [151, "Silver"],
    [250, "Silver"],
    [251, "Gold"],
    [350, "Gold"],
    [351, "Diamond"],
    [449, "Diamond"],
    [450, "Challenger"],
    [700, "Challenger"],
  ])("a total of %i is %s", (total, title) => {
    expect(dayTitle(total)).toBe(title);
  });
});
