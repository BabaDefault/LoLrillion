import { describe, expect, it } from "vitest";
import {
  normalizeGuess,
  openPrompt,
  promptOutcome,
  promptWindow,
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

describe("Tier → Points", () => {
  const ids = ["kaisa", "missfortune", "twistedfate", "teemo", "garen"] as const;
  const everyTier: PromptDefinition = {
    ...bilgewater,
    answerSet: {
      kaisa: "minion",
      missfortune: "too-clever",
      twistedfate: "kill",
      teemo: "triple-kill",
      garen: "quadra-kill",
    },
  };

  it.each([
    ["kaisa", 10],
    ["missfortune", 15],
    ["twistedfate", 30],
    ["teemo", 60],
    ["garen", 85],
  ] satisfies [(typeof ids)[number], number][])("%s scores %i", (id, points) => {
    const name = entities.find((e) => e.id === id)!.name;
    expect(attempt(name, everyTier)).toMatchObject({ points });
  });

  it("the Gem (Pentakill) scores 100", () => {
    const gem = { ...bilgewater, answerSet: { teemo: "pentakill" as const } };
    expect(attempt("Teemo", gem)).toMatchObject({ tier: "pentakill", points: 100 });
  });
});

describe("window timing", () => {
  const opened = T0 + 5_000; // the answer window opens after the 5s read window

  it("rejects Attempts during the 5s read window", () => {
    expect(attempt("MF", bilgewater, T0 + 4_999)).toMatchObject({ kind: "rejected", reason: "read-window" });
    expect(attempt("MF", bilgewater, opened)).toMatchObject({ kind: "accepted" });
  });

  it("accepts Attempts up to 25s plus ~2s network grace after the answer window opens", () => {
    expect(attempt("MF", bilgewater, opened + 25_000 + 1_999)).toMatchObject({ kind: "accepted" });
  });

  it("rejects Attempts once the answer window and grace have closed", () => {
    expect(attempt("MF", bilgewater, opened + 27_000)).toMatchObject({
      kind: "rejected",
      reason: "window-closed",
    });
  });

  it("reports the Prompt's status as reading, answering, then missed with 0 Points", () => {
    const play = openPrompt(T0);
    expect(promptOutcome(play, T0 + 1_000)).toEqual({ status: "reading" });
    expect(promptOutcome(play, opened + 10_000)).toEqual({ status: "answering" });
    expect(promptOutcome(play, opened + 27_000)).toEqual({ status: "missed", points: 0 });
  });

  it("reports an Accepted Prompt as accepted, even after its window closes", () => {
    const { play } = submitAttempt({ prompt: bilgewater, entities, play: openPrompt(T0), guess: "TF", now: opened });
    expect(promptOutcome(play, opened + 60_000)).toMatchObject({
      status: "accepted",
      tier: "kill",
      points: 30,
    });
  });

  it("exposes when the read window ends and the answer window closes (for countdowns)", () => {
    expect(promptWindow(openPrompt(T0))).toEqual({ answerOpensAt: opened, answerClosesAt: opened + 25_000 });
  });
});

describe("retries and locking", () => {
  it("lets the player retry after a Rejected Attempt, and locks on the first Accepted Guess", () => {
    let play = openPrompt(T0);
    const first = submitAttempt({ prompt: bilgewater, entities, play, guess: "Garen", now: answering });
    expect(first.result.kind).toBe("rejected");
    play = first.play;

    const second = submitAttempt({ prompt: bilgewater, entities, play, guess: "MF", now: answering + 1 });
    expect(second.result).toMatchObject({ kind: "accepted", entityId: "missfortune" });
    play = second.play;

    const third = submitAttempt({ prompt: bilgewater, entities, play, guess: "TF", now: answering + 2 });
    expect(third.result).toMatchObject({ kind: "rejected", reason: "locked" });
    expect(third.play.accepted).toMatchObject({ entityId: "missfortune", points: 10 });
  });
});
