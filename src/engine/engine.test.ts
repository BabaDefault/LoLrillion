import { describe, expect, it } from "vitest";
import { normalizeGuess } from "./index";

describe("normalizeGuess", () => {
  it("treats Kai'Sa, kaisa and Kai Sa as the same Guess", () => {
    expect(normalizeGuess("Kai'Sa")).toBe("kaisa");
    expect(normalizeGuess("kaisa")).toBe("kaisa");
    expect(normalizeGuess("Kai Sa")).toBe("kaisa");
  });

  it("ignores periods, ampersands and surrounding whitespace", () => {
    expect(normalizeGuess("  Dr. Mundo ")).toBe("drmundo");
    expect(normalizeGuess("Nunu & Willump")).toBe("nunuwillump");
  });
});
