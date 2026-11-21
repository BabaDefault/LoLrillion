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
    templateId: "champions-dash",
    text: `Name a champion with a dash ${i + 1} (${puzzleDay})`,
    answerType: "champion" as const,
    rule: "Dashes.",
    answerSet: { teemo: "minion" as const, tristana: "kill" as const, amumu: "pentakill" as const },
  })),
});

/** 12:00 on 2026-11-22 in Sydney (AEDT, UTC+11). */
const NOV_22_NOON = Date.parse("2026-11-22T01:00:00Z");
/** 12:00 on 2026-11-21 in Sydney. */
const NOV_21_NOON = Date.parse("2026-11-21T01:00:00Z");

function setup(start = NOV_22_NOON, playAhead = false) {
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
  const game = createGameService({ clock, store, puzzles, playAhead });

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
    expect(response.results.prompts[0].text).toBe("Name a champion with a dash 1 (2026-11-20)");
    // Today's run is untouched by the archive run.
    expect(await game.getState("archivist")).toMatchObject({ puzzleDay: "2026-11-22", archive: false, finished: false });
  });

  it("never counts toward that day's Answer Share or player totals", async () => {
    const { clock, game, playAll } = setup(NOV_21_NOON);
    // On the 21st, one player plays it live: Teemo twice (10 + 10).
    await playAll("live", "Teemo");
    // A day later, someone plays the 21st from the archive: Amumu twice (100 + 100).
    clock.set(NOV_22_NOON);
    await playAll("archivist", "Amumu", "2026-11-21");

    const live = await game.getResults("live", "2026-11-21");
    if (!live.ok) throw new Error("expected results");
    expect(live.results.playerCount).toBe(1);
    expect(live.results.percentile).toBe(0);
    const amumu = live.results.prompts[0].answerSet.find((e) => e.entityId === "amumu");
    expect(amumu).toMatchObject({ count: 0, share: 0 });

    // The archive player is compared against the day's counted players, but not added to them.
    const archived = await game.getResults("archivist", "2026-11-21");
    if (!archived.ok) throw new Error("expected results");
    expect(archived.results).toMatchObject({ archive: true, total: 200, playerCount: 1, percentile: 100 });
    expect(archived.results.prompts[0].answerSet.find((e) => e.entityId === "teemo")).toMatchObject({
      count: 1,
      share: 1,
    });
    expect(archived.results.prompts[0].answerSet.find((e) => e.entityId === "amumu")).toMatchObject({ count: 0 });
  });

  it("shows a past day's results without playing it, with no score of your own", async () => {
    const { clock, game, playAll } = setup(NOV_21_NOON);
    await playAll("live", "Teemo");
    clock.set(NOV_22_NOON);

    const response = await game.getResults("spectator", "2026-11-21");
    if (!response.ok) throw new Error("expected results");
    expect(response.results).toMatchObject({
      puzzleDay: "2026-11-21",
      puzzleNumber: 2,
      played: false,
      total: null,
      dayTitle: null,
      percentile: null,
      playerCount: 1,
    });
    expect(response.results.distribution.yourBin).toBeNull();
    expect(response.results.distribution.bins.reduce((n, b) => n + b.count, 0)).toBe(1);
    expect(response.results.prompts[0].result).toBeNull();
    expect(response.results.prompts[0].answerSet.find((e) => e.entityId === "teemo")).toMatchObject({ count: 1 });
    // Looking doesn't start an archive run.
    expect(await game.getState("spectator", "2026-11-21")).toMatchObject({ archive: true, finished: false });
  });

  it("refuses today, a future day, and a day with no Puzzle", async () => {
    const { game } = setup();
    for (const day of ["2026-11-22", "2026-11-23", "2026-11-19", "not-a-day"]) {
      await expect(game.getState("archivist", day)).rejects.toBeInstanceOf(ArchiveUnavailableError);
      await expect(game.startPrompt("archivist", day)).rejects.toBeInstanceOf(ArchiveUnavailableError);
    }
  });

  it("with play-ahead (the beta), plays a future day as an uncounted run and lists it as upcoming", async () => {
    const { clock, game, playAll } = setup(NOV_22_NOON, true);
    await playAll("friend", "Amumu", "2026-11-23");

    expect(await game.getState("friend", "2026-11-23")).toMatchObject({ archive: true, finished: true, total: 200 });
    expect(await game.listArchive("friend")).toEqual([
      { puzzleDay: "2026-11-23", puzzleNumber: 4, finished: true, upcoming: true },
      { puzzleDay: "2026-11-21", puzzleNumber: 2, finished: false, upcoming: false },
      { puzzleDay: "2026-11-20", puzzleNumber: 1, finished: false, upcoming: false },
    ]);
    // Today is still played live, never from the archive.
    await expect(game.getState("friend", "2026-11-22")).rejects.toBeInstanceOf(ArchiveUnavailableError);

    // When the day arrives, the live run is fresh and counted.
    clock.set(Date.parse("2026-11-23T01:00:00Z"));
    expect(await game.getState("friend")).toMatchObject({ puzzleDay: "2026-11-23", archive: false, finished: false });
  });

  it("without play-ahead, lists no upcoming days", async () => {
    const { game } = setup();
    expect((await game.listArchive("anyone")).map((d) => d.upcoming)).toEqual([false, false]);
  });

  it("shows a day the player already finished live instead of replaying it", async () => {
    const { clock, game, playAll } = setup(NOV_21_NOON);
    await playAll("regular", "Tristana");
    clock.set(NOV_22_NOON);

    const state = await game.getState("regular", "2026-11-21");
    expect(state).toMatchObject({ archive: false, finished: true, total: 60 });
    const results = await game.getResults("regular", "2026-11-21");
    expect(results).toMatchObject({ ok: true, results: { archive: false, total: 60 } });
  });
});

describe("Puzzle provenance", () => {
  const provenance = {
    dataVersion: "16.23.1",
    review: "sha256:0123456789abcdef",
    labels: "unused",
    familiarity: "none" as const,
    scoring: "sha256:fedcba9876543210",
  };

  it("never reaches a state, play or results response, mid-play or after", async () => {
    const clock = new ManualClock(NOV_22_NOON);
    const withProvenance = dated("2026-11-22", 3);
    withProvenance.prompts = withProvenance.prompts.map((p) => ({ ...p, provenance }));
    const puzzles = createDatedPuzzleSource({ puzzles: { "2026-11-22": withProvenance }, entities, fallback: samplePuzzleSource });
    const game = createGameService({ clock, store: new InMemoryPlayStore(), puzzles });
    const leaks = (response: unknown) => /provenance|sha256:/.test(JSON.stringify(response));

    for (let i = 0; i < 2; i++) {
      expect(leaks(await game.getState("player"))).toBe(false);
      expect(leaks(await game.startPrompt("player"))).toBe(false);
      clock.advance(6_000);
      expect(leaks(await game.submitAttempt("player", i, "Amumu"))).toBe(false);
      clock.advance(1_000);
    }
    const results = await game.getResults("player");
    expect(results.ok).toBe(true);
    expect(leaks(results)).toBe(false);
    expect(leaks(await game.getState("player"))).toBe(false);
  });
});
