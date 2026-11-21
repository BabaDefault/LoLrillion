import { describe, expect, it } from "vitest";
import type { Entity, PromptDefinition } from "@/engine";
import { ManualClock } from "./clock";
import { createGameService } from "./game-service";
import { createLeaderboardService } from "./leaderboard-service";
import { createDatedPuzzleSource } from "./dated-puzzle-source";
import { samplePuzzleSource, type PuzzleSource } from "./puzzle-source";
import { InMemoryPlayStore } from "./storage/in-memory-play-store";
import { InMemoryPlayerStore } from "./storage/in-memory-player-store";

// 2026-11-20 10:00 in Sydney (AEDT, UTC+11).
const T0 = Date.parse("2026-11-19T23:00:00Z");
const DAY_MS = 86_400_000;

const entities: Entity[] = [
  { id: "teemo", name: "Teemo", answerType: "champion", aliases: [] },
  { id: "tristana", name: "Tristana", answerType: "champion", aliases: [] },
  { id: "amumu", name: "Amumu", answerType: "champion", aliases: [] },
];

const prompt: PromptDefinition = {
  text: "Name a champion with a dash",
  answerType: "champion",
  rule: "Dashes.",
  answerSet: { teemo: "minion", tristana: "kill", amumu: "pentakill" },
};

/** A two-Prompt Puzzle for every Puzzle Day, numbered from 2026-11-20. */
const puzzles: PuzzleSource = {
  async forDay(puzzleDay) {
    const puzzleNumber = Math.round((Date.parse(puzzleDay) - Date.parse("2026-11-20")) / DAY_MS) + 1;
    return { puzzleDay, puzzleNumber, puzzle: { prompts: [prompt, prompt] }, entities, generated: true };
  },
  async pastDays() {
    return [];
  },
};

function setup(random?: () => number) {
  const clock = new ManualClock(T0);
  const plays = new InMemoryPlayStore();
  const players = new InMemoryPlayerStore(plays);
  const game = createGameService({ clock, store: plays, puzzles });
  const social = createLeaderboardService({ clock, puzzles, players, random });

  /** Play today's whole Puzzle for a device: one Guess per Prompt, or null for a Miss. */
  async function playDay(deviceId: string, guesses: Array<string | null>) {
    for (const [i, guess] of guesses.entries()) {
      await game.startPrompt(deviceId);
      clock.advance(6_000);
      if (guess === null) clock.advance(30_000);
      else await game.submitAttempt(deviceId, i, guess);
      clock.advance(1_000);
    }
  }
  return { clock, game, social, playDay };
}

describe("nicknames", () => {
  it("starts without a nickname, then sets and changes it", async () => {
    const { social } = setup();
    expect(await social.getProfile("me")).toEqual({ nickname: null, groups: [] });
    expect(await social.setNickname("me", "  Faker  Fan ")).toEqual({ ok: true, nickname: "Faker Fan" });
    expect(await social.setNickname("me", "Teemo Main")).toEqual({ ok: true, nickname: "Teemo Main" });
    expect((await social.getProfile("me")).nickname).toBe("Teemo Main");
  });

  it("refuses an empty or too-long nickname and keeps the old one", async () => {
    const { social } = setup();
    await social.setNickname("me", "Ana");
    expect(await social.setNickname("me", "  ")).toEqual({ ok: false, error: "empty" });
    expect(await social.setNickname("me", "x".repeat(21))).toEqual({ ok: false, error: "too-long" });
    expect((await social.getProfile("me")).nickname).toBe("Ana");
  });
});

describe("friend groups", () => {
  it("asks for a nickname before creating or joining a group", async () => {
    const { social } = setup();
    expect(await social.createGroup("me", "The Boys")).toEqual({ ok: false, error: "nickname-required" });
    expect(await social.joinGroup("me", "ABCDEF")).toEqual({ ok: false, error: "nickname-required" });
  });

  it("gives a new group a short code that friends join by, in any case or spacing", async () => {
    const { social } = setup();
    await social.setNickname("host", "Host");
    await social.setNickname("friend", "Friend");
    const created = await social.createGroup("host", " The  Boys ");
    if (!created.ok) throw new Error(created.error);
    expect(created.group.name).toBe("The Boys");
    expect(created.group.code).toMatch(/^[A-Z2-9]{6}$/);

    const typed = created.group.code.toLowerCase().replace(/^(...)/, "$1 ");
    expect(await social.joinGroup("friend", typed)).toEqual({ ok: true, group: created.group });
    expect((await social.getProfile("friend")).groups).toEqual([created.group]);
    expect((await social.getProfile("host")).groups).toEqual([created.group]);
  });

  it("lets a player belong to more than one group", async () => {
    const { social } = setup();
    await social.setNickname("me", "Me");
    const a = await social.createGroup("me", "Uni");
    const b = await social.createGroup("me", "Work");
    if (!a.ok || !b.ok) throw new Error("expected groups");
    expect(a.group.code).not.toBe(b.group.code);
    expect((await social.getProfile("me")).groups).toEqual([a.group, b.group]);
  });

  it("tries another code when a new code is already taken", async () => {
    // Randomness that repeats: the second group's first code collides with the first group's.
    const values = [0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9];
    let i = 0;
    const { social } = setup(() => values[i++ % values.length]);
    await social.setNickname("me", "Me");
    const a = await social.createGroup("me", "Uni");
    const b = await social.createGroup("me", "Work");
    if (!a.ok || !b.ok) throw new Error("expected groups");
    expect(a.group.code).not.toBe(b.group.code);
  });

  it("refuses a code that can't exist and one no group has", async () => {
    const { social } = setup();
    await social.setNickname("me", "Me");
    expect(await social.joinGroup("me", "nope")).toEqual({ ok: false, error: "invalid-code" });
    expect(await social.joinGroup("me", "ZZZZZZ")).toEqual({ ok: false, error: "no-such-group" });
  });

  it("refuses an empty group name", async () => {
    const { social } = setup();
    await social.setNickname("me", "Me");
    expect(await social.createGroup("me", "   ")).toEqual({ ok: false, error: "empty" });
  });
});

describe("leaderboards", () => {
  it("ranks today's finished players by total, marking you, with no device IDs sent", async () => {
    const { social, playDay } = setup();
    await social.setNickname("ana", "Ana");
    await social.setNickname("bo", "Bo");
    await playDay("ana", ["Teemo", "Tristana"]); // 10 + 30
    await playDay("bo", ["Amumu", null]); // 100 + 0
    await playDay("cy", ["Tristana", "Teemo"]); // 30 + 10, no nickname

    const response = await social.getLeaderboard("ana", {});
    if (!response.ok) throw new Error(response.error);
    const board = response.leaderboard;
    expect(board).toMatchObject({ puzzleDay: "2026-11-20", puzzleNumber: 1, phase: "live", scope: { kind: "global" } });
    expect(board.playerCount).toBe(3);
    expect(board.entries).toEqual([
      { rank: 1, nickname: "Bo", total: 100, dayTitle: "Iron", you: false },
      { rank: 2, nickname: "Ana", total: 40, dayTitle: "Iron", you: true },
      { rank: 2, nickname: null, total: 40, dayTitle: "Iron", you: false },
    ]);
    expect(board.you).toEqual({ rank: 2, nickname: "Ana", total: 40, dayTitle: "Iron", you: true });
    expect(JSON.stringify(board)).not.toMatch(/"(ana|bo|cy)"/);
  });

  it("leaves off players who haven't finished, and has no 'you' until you have", async () => {
    const { social, playDay } = setup();
    await playDay("done", ["Teemo", "Teemo"]);
    await playDay("me", ["Teemo"]);
    const response = await social.getLeaderboard("me", {});
    if (!response.ok) throw new Error(response.error);
    expect(response.leaderboard.entries.map((e) => e.total)).toEqual([20]);
    expect(response.leaderboard.you).toBeNull();
  });

  it("shows a group's leaderboard to its members, with only its members", async () => {
    const { social, playDay } = setup();
    await social.setNickname("ana", "Ana");
    await social.setNickname("bo", "Bo");
    const created = await social.createGroup("ana", "Friends");
    if (!created.ok) throw new Error(created.error);
    await social.joinGroup("bo", created.group.code);
    await playDay("ana", ["Teemo", "Teemo"]);
    await playDay("bo", ["Amumu", "Amumu"]);
    await playDay("stranger", ["Tristana", "Tristana"]);

    const response = await social.getLeaderboard("bo", { group: created.group.code.toLowerCase() });
    if (!response.ok) throw new Error(response.error);
    expect(response.leaderboard.scope).toEqual({ kind: "group", group: created.group });
    expect(response.leaderboard.entries.map((e) => e.nickname)).toEqual(["Bo", "Ana"]);
    expect(response.leaderboard.playerCount).toBe(2);
  });

  it("keeps a group's leaderboard from non-members", async () => {
    const { social } = setup();
    await social.setNickname("ana", "Ana");
    const created = await social.createGroup("ana", "Friends");
    if (!created.ok) throw new Error(created.error);
    expect(await social.getLeaderboard("stranger", { group: created.group.code })).toEqual({
      ok: false,
      error: "not-a-member",
    });
    expect(await social.getLeaderboard("ana", { group: "nope" })).toEqual({ ok: false, error: "not-a-member" });
  });

  it("freezes a past Puzzle Day's leaderboard: final, and unchanged by the next day's plays", async () => {
    const { clock, social, playDay } = setup();
    await social.setNickname("ana", "Ana");
    await playDay("ana", ["Amumu", "Teemo"]);
    const during = await social.getLeaderboard("ana", { day: "2026-11-20" });

    clock.advance(DAY_MS);
    await playDay("ana", ["Teemo", "Teemo"]);
    await playDay("late", ["Amumu", "Amumu"]);

    const after = await social.getLeaderboard("ana", { day: "2026-11-20" });
    if (!during.ok || !after.ok) throw new Error("expected leaderboards");
    expect(after.leaderboard.phase).toBe("final");
    expect(after.leaderboard.entries).toEqual(during.leaderboard.entries);

    const today = await social.getLeaderboard("ana", {});
    if (!today.ok) throw new Error(today.error);
    expect(today.leaderboard).toMatchObject({ puzzleDay: "2026-11-21", puzzleNumber: 2, phase: "live" });
    expect(today.leaderboard.entries.map((e) => e.total)).toEqual([200, 20]);
  });

  it("never counts archive plays, today or on the past day they replay", async () => {
    const { clock, social, playDay, game } = setup();
    await playDay("ana", ["Teemo", "Teemo"]);
    const before = await social.getLeaderboard("late", { day: "2026-11-20" });

    clock.advance(DAY_MS);
    // "late" replays 2026-11-20 from the archive with a perfect score.
    for (const i of [0, 1]) {
      await game.startPrompt("late", "2026-11-20");
      clock.advance(6_000);
      await game.submitAttempt("late", i, "Amumu", "2026-11-20");
      clock.advance(1_000);
    }
    const replay = await game.getResults("late", "2026-11-20");
    expect(replay.ok && replay.results.total).toBe(200);

    const after = await social.getLeaderboard("late", { day: "2026-11-20" });
    const today = await social.getLeaderboard("late", {});
    if (!before.ok || !after.ok || !today.ok) throw new Error("expected leaderboards");
    expect(after.leaderboard.entries).toEqual(before.leaderboard.entries);
    expect(after.leaderboard.you).toBeNull();
    expect(today.leaderboard.entries).toEqual([]);
  });

  it("refuses a Puzzle Day that hasn't started, or isn't a date", async () => {
    const { social } = setup();
    expect(await social.getLeaderboard("me", { day: "2026-11-21" })).toEqual({ ok: false, error: "future-day" });
    expect(await social.getLeaderboard("me", { day: "yesterday" })).toEqual({ ok: false, error: "invalid-day" });
  });
});

describe("leaderboards for a day that served the sample Puzzle", () => {
  it("numbers a past day with no generated Puzzle by its date, not the sample's number", async () => {
    // 2026-11-25 in Sydney has no generated Puzzle, so it serves the sample.
    const clock = new ManualClock(T0 + 5 * DAY_MS);
    const plays = new InMemoryPlayStore();
    const players = new InMemoryPlayerStore(plays);
    const dated = createDatedPuzzleSource({ puzzles: {}, entities, fallback: samplePuzzleSource });
    const game = createGameService({ clock, store: plays, puzzles: dated });
    const social = createLeaderboardService({ clock, puzzles: dated, players });
    const { promptCount } = await game.getState("ana");
    for (let i = 0; i < promptCount; i++) {
      await game.startPrompt("ana");
      clock.advance(40_000);
    }

    clock.advance(DAY_MS);
    const past = await social.getLeaderboard("ana", { day: "2026-11-25" });
    if (!past.ok) throw new Error(past.error);
    expect(past.leaderboard).toMatchObject({ puzzleDay: "2026-11-25", puzzleNumber: 6, phase: "final", playerCount: 1 });
  });
});
