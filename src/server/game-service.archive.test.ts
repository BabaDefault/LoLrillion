import { describe, expect, it } from "vitest";
import type { GeneratedPuzzle } from "@/builder";
import type { Entity } from "@/engine";
import { ManualClock } from "./clock";
import { createDatedPuzzleSource } from "./dated-puzzle-source";
import { ArchiveUnavailableError, createGameService } from "./game-service";
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
    templateId: "champions-yordle",
    text: `Name a Yordle ${i + 1} (${puzzleDay})`,
    answerType: "champion" as const,
    rule: "Yordles.",
    answerSet: { teemo: "minion" as const, tristana: "kill" as const, amumu: "pentakill" as const },
  })),
});

/** 12:00 on 2026-11-22 in Sydney (AEDT, UTC+11). */
const NOV_22_NOON = Date.parse("2026-11-22T01:00:00Z");
/** 12:00 on 2026-11-21 in Sydney. */
const NOV_21_NOON = Date.parse("2026-11-21T01:00:00Z");

function setup(start = NOV_22_NOON) {
  const clock = new ManualClock(start);
  const store = new InMemoryPlayStore();
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
  const game = createGameService({ clock, store, puzzles });

  /** Play every Prompt of a run with the same Guess (null = let the window run out). */
  async function playAll(deviceId: string, guess: string | null, archiveDay?: string) {
    for (let i = 0; i < 2; i++) {
      await game.startPrompt(deviceId, archiveDay);
      clock.advance(6_000);
      if (guess === null) clock.advance(30_000);
      else await game.submitAttempt(deviceId, i, guess, archiveDay);
      clock.advance(1_000);
    }
  }
  return { clock, store, game, playAll };
}

describe("archive play", () => {
  it("plays a past Puzzle with the same flow and end screen, flagged as archive", async () => {
    const { game, playAll } = setup();
    const before = await game.getState("archivist", "2026-11-20");
    expect(before).toMatchObject({ puzzleDay: "2026-11-20", archive: true, finished: false });

    await playAll("archivist", "Amumu", "2026-11-20");

    const response = await game.getResults("archivist", "2026-11-20");
    if (!response.ok) throw new Error("expected results");
    expect(response.results).toMatchObject({
      puzzleDay: "2026-11-20",
      puzzleNumber: 1,
      archive: true,
      total: 200,
    });
    expect(response.results.prompts[0].text).toBe("Name a Yordle 1 (2026-11-20)");
    // Today's run is untouched by the archive run.
    expect(await game.getState("archivist")).toMatchObject({ puzzleDay: "2026-11-22", archive: false, finished: false });
  });
});
