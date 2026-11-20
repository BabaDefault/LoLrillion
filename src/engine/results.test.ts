import { describe, expect, it } from "vitest";
import { dayTitle, shareLine } from "./index";

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

describe("share line", () => {
  it("shows the Puzzle number, total, day title and one Tier emoji per Prompt, with ⬛ for a Miss", () => {
    const line = shareLine({
      puzzleNumber: 12,
      results: ["minion", "triple-kill", "pentakill", null, "too-clever", "quadra-kill", "kill"],
    });
    // 10 + 60 + 100 + 0 + 15 + 85 + 30 = 300
    expect(line).toBe("LoLrillion #12 · 300/700 · Gold\n🟦🟨💎⬛🤡🟧🟩");
  });

  it("adds the link on its own line when given", () => {
    const line = shareLine({ puzzleNumber: 1, results: Array(7).fill(null), link: "https://lolrillion.example" });
    expect(line).toBe("LoLrillion #1 · 0/700 · Iron\n⬛⬛⬛⬛⬛⬛⬛\nhttps://lolrillion.example");
  });
});
