import { describe, expect, it } from "vitest";
import {
  normalizeGuess,
  openPrompt,
  submitAttempt,
  type Entity,
  type PromptDefinition,
} from "./index";

const entities: Entity[] = [
  { id: "kaisa", name: "Kai'Sa", answerType: "champion", aliases: [] },
  { id: "missfortune", name: "Miss Fortune", answerType: "champion", aliases: ["MF"] },
  { id: "twistedfate", name: "Twisted Fate", answerType: "champion", aliases: ["TF"] },
  { id: "teemo", name: "Teemo", answerType: "champion", aliases: [] },
  { id: "garen", name: "Garen", answerType: "champion", aliases: [] },
];

const bilgewater: PromptDefinition = {
  text: "Name a champion from Bilgewater",
  answerType: "champion",
  rule: "Champions whose official home region is Bilgewater.",
  answerSet: { missfortune: "minion", twistedfate: "kill" },
};

const T0 = 1_700_000_000_000;
/** A moment inside the answer window of a Prompt opened at T0. */
const answering = T0 + 5_000 + 1_000;

function attempt(guess: string, prompt = bilgewater, now = answering) {
  return submitAttempt({ prompt, entities, play: openPrompt(T0), guess, now }).result;
}

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

describe("resolving a Guess", () => {
  it("accepts an exact canonical name in the Answer Set and scores its Tier's Points", () => {
    expect(attempt("twisted fate")).toEqual({
      kind: "accepted",
      entityId: "twistedfate",
      entityName: "Twisted Fate",
      tier: "kill",
      points: 30,
    });
  });

  it("accepts an Alias of an Entity in the Answer Set", () => {
    expect(attempt("mf")).toMatchObject({ kind: "accepted", entityId: "missfortune", points: 10 });
  });

  it("rejects a real Entity that is not in the Answer Set", () => {
    expect(attempt("Garen")).toMatchObject({ kind: "rejected" });
  });

  it("rejects a Guess that matches no Entity", () => {
    expect(attempt("Gangplonk")).toMatchObject({ kind: "rejected" });
  });
});
