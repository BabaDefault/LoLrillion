import { describe, expect, it } from "vitest";
import type { Entity, PromptDefinition } from "@/engine";
import { ManualClock } from "./clock";
import { createGameService } from "./game-service";
import type { PuzzleSource } from "./puzzle-source";
import type { AnswerCountSource } from "./storage/answer-counts";
import { InMemoryPlayStore } from "./storage/in-memory-play-store";

const T0 = 1_700_000_000_000;
const DEVICE = "device-1";

const entities: Entity[] = [
  { id: "teemo", name: "Teemo", answerType: "champion", aliases: [] },
  { id: "tristana", name: "Tristana", answerType: "champion", aliases: [] },
  { id: "amumu", name: "Amumu", answerType: "champion", aliases: [] },
];

const prompt = (i: number): PromptDefinition => ({
  text: `Name a champion with a dash ${i + 1}`,
  answerType: "champion",
  rule: "Dashes.",
  answerSet: { teemo: "minion", tristana: "kill", amumu: "pentakill" },
});

const puzzles: PuzzleSource = {
  async forDay(puzzleDay) {
    return {
      puzzleDay,
      puzzleNumber: 4,
      puzzle: { prompts: Array.from({ length: 7 }, (_, i) => prompt(i)) },
      entities,
      generated: true,
    };
  },
  async pastDays() {
    return [];
  },
  async upcomingDays() {
    return [];
  },
};

function setup(answerCounts?: AnswerCountSource) {
  const clock = new ManualClock(T0);
  const game = createGameService({ clock, store: new InMemoryPlayStore(), puzzles, answerCounts });

  /** Play one Prompt: a Guess, or null to let the answer window run out (a Miss). */
  async function play(index: number, guess: string | null) {
    await game.startPrompt(DEVICE);
    clock.advance(6_000);
    if (guess === null) clock.advance(30_000);
    else await game.submitAttempt(DEVICE, index, guess);
    clock.advance(1_000);
  }
  return { game, play };
}

describe("end-of-day results", () => {
  it("withholds the results until all seven Prompts are finished", async () => {
    const { game, play } = setup();
    for (let i = 0; i < 6; i++) await play(i, "Teemo");
    expect(await game.getResults(DEVICE)).toEqual({ ok: false, error: "not-finished" });
  });

  it("reveals the total, day title, each answer and the full Answer Set with the Gem marked", async () => {
    const { game, play } = setup();
    const guesses = ["Amumu", "Teemo", null, "Tristana", "Amumu", "Teemo", "Amumu"];
    for (const [i, guess] of guesses.entries()) await play(i, guess);

    const response = await game.getResults(DEVICE);
    if (!response.ok) throw new Error("expected results");
    const { results } = response;
    // 100 + 10 + 0 + 30 + 100 + 10 + 100
    expect(results).toMatchObject({ puzzleNumber: 4, total: 350, maxTotal: 700, dayTitle: "Gold" });
    expect(results.prompts).toHaveLength(7);
    expect(results.prompts[0].text).toBe("Name a champion with a dash 1");
    expect(results.prompts[0].result).toEqual({
      status: "accepted",
      entityId: "amumu",
      entityName: "Amumu", tier: "pentakill", points: 100 });
    expect(results.prompts[2].result).toEqual({ status: "missed", points: 0 });
    // The only player today is this one, so their own pick is the whole Answer Share.
    expect(results.prompts[0].answerSet).toEqual(
      expect.arrayContaining([
        { entityId: "teemo", name: "Teemo", tier: "minion", points: 10, gem: false, count: 0, share: 0 },
        { entityId: "amumu", name: "Amumu", tier: "pentakill", points: 100, gem: true, count: 1, share: 1 },
      ]),
    );
    expect(results).toMatchObject({ playerCount: 1, percentile: 0 });
    expect(results.prompts[0].answerSet).toHaveLength(3);
  });

  it("shows how many of today's players chose each Entity", async () => {
    const counts: AnswerCountSource = {
      async getAnswerCounts() {
        return { players: 4, byPrompt: [{ teemo: 3, amumu: 1 }] };
      },
    };
    const { game, play } = setup(counts);
    for (let i = 0; i < 7; i++) await play(i, "Teemo");

    const response = await game.getResults(DEVICE);
    if (!response.ok) throw new Error("expected results");
    const [first, second] = response.results.prompts;
    expect(first.answerSet.find((e) => e.entityId === "teemo")).toMatchObject({ count: 3, share: 0.75 });
    expect(first.answerSet.find((e) => e.entityId === "tristana")).toMatchObject({ count: 0, share: 0 });
    expect(second.answerSet.find((e) => e.entityId === "teemo")).toMatchObject({ count: 0, share: 0 });
  });
});
