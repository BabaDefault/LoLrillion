import { describe, expect, it } from "vitest";
import type { GeneratedPuzzle } from "@/builder";
import type { Entity } from "@/engine";
import { ManualClock } from "./clock";
import { createDatedPuzzleSource } from "./dated-puzzle-source";
import { createGameService } from "./game-service";
import { samplePuzzleSource } from "./puzzle-source";
import { InMemoryPlayStore } from "./storage/in-memory-play-store";

const entities: Entity[] = [
  { id: "teemo", name: "Teemo", answerType: "champion", aliases: [] },
  { id: "tristana", name: "Tristana", answerType: "champion", aliases: [] },
  { id: "amumu", name: "Amumu", answerType: "champion", aliases: [] },
];

const dated = (puzzleDay: string, puzzleNumber: number): GeneratedPuzzle => ({
  puzzleDay,
  puzzleNumber,
  dataVersion: "16.23.1",
  prompts: [0, 1].map((i) => ({
    templateId: "champions-dash",
    text: `Name a champion with a dash ${i + 1}`,
    answerType: "champion" as const,
    rule: "Dashes.",
    answerSet: { teemo: "minion" as const, tristana: "kill" as const, amumu: "pentakill" as const },
  })),
});

/** Noon in Sydney (AEDT, UTC+11) on a November day. */
const noon = (day: number) => Date.parse(`2026-11-${day}T01:00:00Z`);

function setup(start: number) {
  const clock = new ManualClock(start);
  const puzzles = createDatedPuzzleSource({
    puzzles: {
      "2026-11-20": dated("2026-11-20", 1),
      "2026-11-21": dated("2026-11-21", 2),
      "2026-11-22": dated("2026-11-22", 3),
      "2026-11-23": dated("2026-11-23", 4),
    },
    entities,
    fallback: samplePuzzleSource,
  });
  const game = createGameService({ clock, store: new InMemoryPlayStore(), puzzles });

  /** Play a run's Prompts with these Guesses (null = let the window run out). */
  async function play(deviceId: string, guesses: Array<string | null>, archiveDay?: string) {
    for (const [i, guess] of guesses.entries()) {
      await game.startPrompt(deviceId, archiveDay);
      clock.advance(6_000);
      if (guess === null) clock.advance(30_000);
      else await game.submitAttempt(deviceId, i, guess, archiveDay);
      clock.advance(1_000);
    }
  }
  return { clock, game, play };
}

describe("personal stats, through the Game Service", () => {
  it("covers every finished game of this device, live and archive, but not unfinished ones", async () => {
    const { clock, game, play } = setup(noon(20));
    await play("me", ["Amumu", null]); // 20th live: 100 + 0
    await play("someone-else", ["Amumu", "Amumu"]);
    clock.set(noon(22));
    await play("me", ["Tristana", "Teemo"], "2026-11-21"); // 21st archive: 30 + 10
    await play("me", ["Teemo"]); // 22nd live, unfinished

    expect(await game.getStats("me")).toEqual({
      gamesPlayed: 2,
      averageScore: 70,
      tierCounts: { minion: 1, "too-clever": 0, kill: 1, "triple-kill": 0, "quadra-kill": 0, pentakill: 1, miss: 1 },
      gemsFound: 1,
      bestDay: { puzzleDay: "2026-11-20", total: 100 },
    });
  });

  it("keeps a finished run from a past day that served the sample Puzzle (none generated)", async () => {
    const { clock, game, play } = setup(noon(24));
    const { promptCount } = await game.getState("me");
    await play("me", Array.from({ length: promptCount }, () => null));
    clock.set(noon(26));
    expect(await game.getStats("me")).toMatchObject({ gamesPlayed: 1, averageScore: 0 });
  });

  it("is empty for a new device", async () => {
    const { game } = setup(noon(20));
    expect(await game.getStats("new")).toMatchObject({ gamesPlayed: 0, averageScore: null, bestDay: null });
  });
});

describe("the archive list, through the Game Service", () => {
  it("lists past Puzzle Days only, newest first, marking the ones this device finished", async () => {
    const { clock, game, play } = setup(noon(21));
    await play("me", ["Teemo", "Teemo"]);
    clock.set(noon(22));
    expect(await game.listArchive("me")).toEqual([
      { puzzleDay: "2026-11-21", puzzleNumber: 2, finished: true, upcoming: false },
      { puzzleDay: "2026-11-20", puzzleNumber: 1, finished: false, upcoming: false },
    ]);
  });
});
