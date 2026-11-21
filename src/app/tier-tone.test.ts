import { describe, expect, it } from "vitest";
import { tierTone } from "./tier-tone";

describe("tierTone", () => {
  it("gives each Tier the colour of its share emoji", () => {
    expect(tierTone("minion")).toBe("blue"); // 🟦
    expect(tierTone("too-clever")).toBe("clown"); // 🤡
    expect(tierTone("kill")).toBe("green"); // 🟩
    expect(tierTone("triple-kill")).toBe("yellow"); // 🟨
    expect(tierTone("quadra-kill")).toBe("orange"); // 🟧
    expect(tierTone("pentakill")).toBe("gem"); // 💎
  });

  it("gives a Miss the black-square tone", () => {
    expect(tierTone(null)).toBe("miss"); // ⬛
  });
});
