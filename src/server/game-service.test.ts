import { beforeEach, describe, expect, it } from "vitest";
import { READ_WINDOW_MS, type Entity, type Puzzle } from "@/engine";
import { ManualClock } from "./clock";
import { createGameService, type GameService } from "./game-service";
import type { PuzzleSource } from "./puzzle-source";
import { InMemoryPlayStore } from "./storage/in-memory-play-store";

const entities: Entity[] = [
  { id: "missfortune", name: "Miss Fortune", answerType: "champion", aliases: ["MF"] },
  { id: "twistedfate", name: "Twisted Fate", answerType: "champion", aliases: ["TF"] },
  { id: "kassadin", name: "Kassadin", answerType: "champion", aliases: [] },
];

const puzzle: Puzzle = {
  prompts: [
    {
      text: "Name a champion from Bilgewater",
      answerType: "champion",
      rule: "Champions whose official home region is Bilgewater.",
      answerSet: { missfortune: "minion", twistedfate: "kill" },
    },
  ],
};

const puzzles: PuzzleSource = {
  async forDay(puzzleDay) {
    return { puzzleDay, puzzleNumber: 1, puzzle, entities, generated: true };
  },
  async pastDays() {
    return [];
  },
};

const DEVICE = "device-1";
const T0 = 1_700_000_000_000;

describe("Did you mean, through the Game Service", () => {
  let clock: ManualClock;
  let game: GameService;

  beforeEach(async () => {
    clock = new ManualClock(T0);
    game = createGameService({ clock, store: new InMemoryPlayStore(), puzzles });
    await game.startPrompt(DEVICE);
    clock.advance(READ_WINDOW_MS + 1_000);
  });

  it("offers candidates without using an Attempt, then accepts a confirmed one", async () => {
    const before = await game.getState(DEVICE);
    const popup = await game.submitAttempt(DEVICE, 0, "Miss Fortun");
    expect(popup).toMatchObject({
      ok: true,
      result: { kind: "did-you-mean", candidates: [{ id: "missfortune", name: "Miss Fortune" }] },
    });
    expect(popup.state.current).toEqual(before.current);

    const yes = await game.confirmSuggestion(DEVICE, 0, "missfortune");
    expect(yes).toMatchObject({ ok: true, result: { kind: "accepted", entityId: "missfortune" } });
  });

  it("logs a confirmation as the confirmed Entity, with the typed Guess, not as a Guess of the Entity ID", async () => {
    const store = new InMemoryPlayStore();
    game = createGameService({ clock, store, puzzles });
    await game.startPrompt(DEVICE);
    clock.advance(READ_WINDOW_MS + 1_000);
    await game.submitAttempt(DEVICE, 0, "Miss Fortun");
    await game.confirmSuggestion(DEVICE, 0, "twistedfate");
    await game.confirmSuggestion(DEVICE, 0, "missfortune", undefined, "Miss Fortun");

    const confirmations = store.attempts.filter((a) => a.confirmedEntityId !== undefined);
    expect(confirmations.map((a) => [a.guess, a.confirmedEntityId])).toEqual([
      [null, "twistedfate"],
      ["Miss Fortun", "missfortune"],
    ]);
    expect(store.attempts.some((a) => a.guess === "missfortune" || a.guess === "twistedfate")).toBe(false);
  });

  it("rejects a confirmed Entity ID that wasn't among the offered candidates", async () => {
    await game.submitAttempt(DEVICE, 0, "Kassadn");
    const out = await game.confirmSuggestion(DEVICE, 0, "twistedfate");
    expect(out).toMatchObject({ ok: true, result: { kind: "rejected", reason: "not-offered" } });
  });
});
