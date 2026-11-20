import { describe, expect, it } from "vitest";
import type { Entity, Puzzle } from "@/engine";
import { ManualClock } from "./clock";
import { createGameService } from "./game-service";
import type { PuzzleSource } from "./puzzle-source";
import { InMemoryPlayStore } from "./storage/in-memory-play-store";

const champ = (id: string): Entity => ({ id, name: id, answerType: "champion", aliases: [] });
const entities = [champ("Teemo"), champ("Lulu"), champ("Garen"), champ("Darius")];

const puzzle: Puzzle = {
  prompts: [
    {
      text: "Name a Yordle",
      answerType: "champion",
      rule: "",
      answerSet: { Teemo: "minion", Lulu: "pentakill" }, // 10, 100
    },
    {
      text: "Name a Demacian or Noxian",
      answerType: "champion",
      rule: "",
      answerSet: { Garen: "minion", Darius: "kill" }, // 10, 30
    },
  ],
};

const puzzles: PuzzleSource = {
  async current() {
    return { puzzleDay: "2026-11-20", puzzle, entities };
  },
};

const T0 = 1_700_000_000_000;

function setup() {
  const clock = new ManualClock(T0);
  const store = new InMemoryPlayStore();
  const game = createGameService({ clock, store, puzzles });
  /** Play the whole Puzzle as `deviceId`, answering each Prompt with the given Guess (null = Miss). */
  async function playThrough(deviceId: string, guesses: Array<string | null>) {
    for (let i = 0; i < guesses.length; i++) {
      await game.startPrompt(deviceId);
      clock.advance(6_000); // past the read window
      const guess = guesses[i];
      if (guess) await game.submitAttempt(deviceId, i, guess);
      else clock.advance(60_000); // let the window close: a Miss
    }
  }
  return { clock, store, game, playThrough };
}

describe("resuming and reloading", () => {
  it("reloading mid-Prompt keeps the original window-open time", async () => {
    const { clock, game } = setup();
    const first = await game.startPrompt("me");
    clock.advance(10_000);
    const again = await game.startPrompt("me"); // e.g. a reload that re-sends start
    const cur = (s: typeof first) => (s.current?.status === "answering" || s.current?.status === "reading" ? s.current : null);
    expect(cur(again)?.answerOpensAt).toBe(cur(first)?.answerOpensAt);
  });

  it("a returning player resumes at the next unplayed Prompt", async () => {
    const { clock, store, playThrough } = setup();
    await playThrough("me", ["Lulu"]);
    // A new server instance over the same store (e.g. a later visit).
    const later = createGameService({ clock, store, puzzles });
    const state = await later.getState("me");
    expect(state.current).toEqual({ index: 1, status: "not-started" });
    expect(state.results[0]).toMatchObject({ status: "accepted", points: 100 });
  });
});

describe("end-screen stats", () => {
  it("are withheld until the player has finished the Puzzle", async () => {
    const { game, playThrough } = setup();
    await playThrough("me", ["Teemo"]);
    expect(await game.getDayStats("me")).toBeNull();
  });

  it("give Answer Share counts, the percentile and the marked distribution", async () => {
    const { game, playThrough } = setup();
    await playThrough("a", ["Teemo", "Garen"]); // 20
    await playThrough("b", ["Teemo", null]); // 10
    await playThrough("c", ["Lulu", "Darius"]); // 130
    await playThrough("me", ["Teemo", "Darius"]); // 40

    const stats = await game.getDayStats("me");
    expect(stats).not.toBeNull();
    expect(stats!.total).toBe(40);
    expect(stats!.playerCount).toBe(4);
    expect(stats!.percentile).toBe(66); // beat a and b, not c
    expect(stats!.answerCounts).toEqual([
      { Teemo: 3, Lulu: 1 },
      { Garen: 1, Darius: 2 },
    ]);
    // "N players chose this" for the player's own answers.
    expect(stats!.chosenBy).toEqual([3, 2]);
    // 2 Prompts × 100 max = 200, 10 bins of 20.
    expect(stats!.distribution.bins).toHaveLength(10);
    expect(stats!.distribution.bins.map((b) => b.count)).toEqual([1, 1, 1, 0, 0, 0, 1, 0, 0, 0]);
    expect(stats!.distribution.yourBin).toBe(2);
  });
});
