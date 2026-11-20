import { describe, expect, it } from "vitest";
import {
  confirmSuggestion,
  normalizeGuess,
  openPrompt,
  promptOutcome,
  promptWindow,
  puzzleProgress,
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
  { id: "kassadin", name: "Kassadin", answerType: "champion", aliases: [] },
  { id: "kayle", name: "Kayle", answerType: "champion", aliases: [] },
  { id: "kayn", name: "Kayn", answerType: "champion", aliases: [] },
  { id: "zac", name: "Zac", answerType: "champion", aliases: [] },
  { id: "kassadil", name: "Kassadill", answerType: "champion", aliases: [] },
  { id: "mf-arcade", name: "Arcade Miss Fortune", answerType: "skin", aliases: [] },
];

const ranged: PromptDefinition = {
  text: "Name a ranged champion",
  answerType: "champion",
  rule: "Champions whose basic attacks are ranged.",
  answerSet: { missfortune: "minion", twistedfate: "kill" },
};

const T0 = 1_700_000_000_000;
/** A moment inside the answer window of a Prompt opened at T0. */
const answering = T0 + 5_000 + 1_000;

function attempt(guess: string, prompt = ranged, now = answering) {
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
    ...ranged,
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
    const gem = { ...ranged, answerSet: { teemo: "pentakill" as const } };
    expect(attempt("Teemo", gem)).toMatchObject({ tier: "pentakill", points: 100 });
  });
});

describe("window timing", () => {
  const opened = T0 + 5_000; // the answer window opens after the 5s read window

  it("rejects Attempts during the 5s read window", () => {
    expect(attempt("MF", ranged, T0 + 4_999)).toMatchObject({ kind: "rejected", reason: "read-window" });
    expect(attempt("MF", ranged, opened)).toMatchObject({ kind: "accepted" });
  });

  it("accepts Attempts up to 25s plus ~2s network grace after the answer window opens", () => {
    expect(attempt("MF", ranged, opened + 25_000 + 1_999)).toMatchObject({ kind: "accepted" });
  });

  it("rejects Attempts once the answer window and grace have closed", () => {
    expect(attempt("MF", ranged, opened + 27_000)).toMatchObject({
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
    const { play } = submitAttempt({ prompt: ranged, entities, play: openPrompt(T0), guess: "TF", now: opened });
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

describe("Puzzle progress and the daily total", () => {
  const promptOpenedAt = (i: number) => T0 + i * 60_000;
  const acceptedPlay = (i: number, guess: string, prompt = ranged) =>
    submitAttempt({ prompt, entities, play: openPrompt(promptOpenedAt(i)), guess, now: promptOpenedAt(i) + 6_000 })
      .play;
  const gemPrompt: PromptDefinition = { ...ranged, answerSet: { teemo: "pentakill" } };

  it("starts at the first Prompt with nothing scored", () => {
    const progress = puzzleProgress(7, [], T0);
    expect(progress).toMatchObject({ currentIndex: 0, finished: false, total: 0 });
    expect(progress.outcomes[0]).toEqual({ status: "not-started" });
  });

  it("moves to the next Prompt once one is Accepted or Missed", () => {
    const plays = [acceptedPlay(0, "TF"), openPrompt(promptOpenedAt(1))];
    const missedSecond = promptOpenedAt(1) + 5_000 + 27_000;
    expect(puzzleProgress(7, plays, promptOpenedAt(1) + 1_000)).toMatchObject({ currentIndex: 1, total: 30 });
    expect(puzzleProgress(7, plays, missedSecond)).toMatchObject({ currentIndex: 2, total: 30 });
  });

  it("finishes after seven Prompts with the sum of their Points", () => {
    const plays = [
      acceptedPlay(0, "MF"), // 10
      acceptedPlay(1, "TF"), // 30
      openPrompt(promptOpenedAt(2)), // Miss
      acceptedPlay(3, "Teemo", gemPrompt), // 100
      acceptedPlay(4, "Teemo", gemPrompt), // 100
      acceptedPlay(5, "MF"), // 10
      acceptedPlay(6, "Teemo", gemPrompt), // 100
    ];
    expect(puzzleProgress(7, plays, promptOpenedAt(10))).toMatchObject({
      currentIndex: null,
      finished: true,
      total: 350,
    });
  });

  it("totals 700 when every Prompt finds the Gem", () => {
    const plays = Array.from({ length: 7 }, (_, i) => acceptedPlay(i, "Teemo", gemPrompt));
    expect(puzzleProgress(7, plays, promptOpenedAt(10)).total).toBe(700);
  });
});

describe("retries and locking", () => {
  it("lets the player retry after a Rejected Attempt, and locks on the first Accepted Guess", () => {
    let play = openPrompt(T0);
    const first = submitAttempt({ prompt: ranged, entities, play, guess: "Garen", now: answering });
    expect(first.result.kind).toBe("rejected");
    play = first.play;

    const second = submitAttempt({ prompt: ranged, entities, play, guess: "MF", now: answering + 1 });
    expect(second.result).toMatchObject({ kind: "accepted", entityId: "missfortune" });
    play = second.play;

    const third = submitAttempt({ prompt: ranged, entities, play, guess: "TF", now: answering + 2 });
    expect(third.result).toMatchObject({ kind: "rejected", reason: "locked" });
    expect(third.play.accepted).toMatchObject({ entityId: "missfortune", points: 10 });
  });
});

describe("Did you mean", () => {
  it("suggests a real Entity of the Answer Type for a near-miss, even one outside the Answer Set", () => {
    expect(attempt("Kassadn")).toEqual({
      kind: "did-you-mean",
      candidates: [{ id: "kassadin", name: "Kassadin" }],
    });
  });

  it("suggests Miss Fortune for 'Miss Fortun'", () => {
    expect(attempt("Miss Fortun")).toEqual({
      kind: "did-you-mean",
      candidates: [{ id: "missfortune", name: "Miss Fortune" }],
    });
  });

  it("lists every close Entity when several are near", () => {
    expect(attempt("Kassadil")).toEqual({
      kind: "did-you-mean",
      candidates: [
        { id: "kassadil", name: "Kassadill" },
        { id: "kassadin", name: "Kassadin" },
      ],
    });
  });

  it("never offers an Entity whose name is 4 characters or fewer", () => {
    expect(attempt("Kaynn")).toEqual({ kind: "rejected", reason: "no-match" });
    expect(attempt("Kayne")).toEqual({
      kind: "did-you-mean",
      candidates: [{ id: "kayle", name: "Kayle" }],
    });
  });

  it("never suggests for Guesses of 4 characters or fewer", () => {
    expect(attempt("Zak")).toEqual({ kind: "rejected", reason: "no-match" });
  });

  it("tells the player a SKIN Prompt asks for a skin when they type a champion", () => {
    const skins: PromptDefinition = {
      text: "Name a Miss Fortune skin",
      answerType: "skin",
      rule: "Skins for Miss Fortune.",
      answerSet: { "mf-arcade": "kill" },
    };
    const out = submitAttempt({ prompt: skins, entities, play: openPrompt(T0), guess: "Miss Fortune", now: answering });
    expect(out.result).toEqual({ kind: "wrong-answer-type", expected: "skin" });
    expect(out.play).toEqual(openPrompt(T0));
  });

  it("confirming an offered suggestion submits that Entity as the Attempt", () => {
    const yes = (entityId: string) =>
      confirmSuggestion({ prompt: ranged, entities, play: openPrompt(T0), entityId, offered: ["missfortune", "kassadin"], now: answering });
    expect(yes("missfortune").result).toMatchObject({ kind: "accepted", entityId: "missfortune", points: 10 });
    expect(yes("missfortune").play.accepted).toMatchObject({ entityId: "missfortune" });
    expect(yes("kassadin").result).toEqual({ kind: "rejected", reason: "not-in-answer-set" });
  });

  it("rejects a confirmed Entity ID that wasn't among the offered candidates", () => {
    const out = confirmSuggestion({
      prompt: ranged,
      entities,
      play: openPrompt(T0),
      entityId: "twistedfate",
      offered: ["missfortune"],
      now: answering,
    });
    expect(out.result).toEqual({ kind: "rejected", reason: "not-offered" });
  });

  it("does not use up an Attempt or touch the Prompt's state", () => {
    const play = openPrompt(T0);
    const out = submitAttempt({ prompt: ranged, entities, play, guess: "Kassadn", now: answering });
    expect(out.play).toEqual(play);
  });
});
