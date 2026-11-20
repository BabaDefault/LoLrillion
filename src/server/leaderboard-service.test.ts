import { describe, expect, it } from "vitest";
import { puzzleDayOf, type Entity, type PromptDefinition } from "@/engine";
import { ManualClock } from "./clock";
import { createGameService } from "./game-service";
import { createLeaderboardService } from "./leaderboard-service";
import type { PuzzleSource } from "./puzzle-source";
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
  text: "Name a Yordle",
  answerType: "champion",
  rule: "Yordles.",
  answerSet: { teemo: "minion", tristana: "kill", amumu: "pentakill" },
};

/** A two-Prompt Puzzle for every Puzzle Day, numbered from 2026-11-20. */
const puzzles: PuzzleSource = {
  async current(now) {
    const puzzleDay = puzzleDayOf(now);
    const puzzleNumber = Math.round((Date.parse(puzzleDay) - Date.parse("2026-11-20")) / DAY_MS) + 1;
    return { puzzleDay, puzzleNumber, puzzle: { prompts: [prompt, prompt] }, entities };
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
