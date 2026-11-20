import { describe, expect, it } from "vitest";
import { generateGroupCode } from "@/leaderboard";
import { openPrompt, type PromptPlay } from "@/engine";
import type { PlayKey, PlayStore } from "./play-store";
import type { PlayerStore } from "./player-store";

const T0 = 1_700_000_000_000;
/** Long after every Prompt opened at T0 has closed. */
const LATER = T0 + 60 * 60_000;

/** A PlayerStore and the PlayStore whose plays its leaderboards read. */
export interface PlayerStoreFixture {
  plays: PlayStore;
  players: PlayerStore;
}

/** Behaviour every PlayerStore must have. Run against each implementation. */
export function describePlayerStoreContract(name: string, makeStores: () => PlayerStoreFixture) {
  describe(`${name} (PlayerStore contract)`, () => {
    // Unique per run, so the suite can also run against a shared real database.
    const run = Math.random().toString(36).slice(2, 10);
    const device = (n: string) => `test-${run}-${n}`;
    let dayCounter = 0;
    function freshDay(): string {
      const d = new Date(Date.UTC(2100 + Math.floor(Math.random() * 800), 0, 1));
      d.setUTCDate(d.getUTCDate() + dayCounter++ * 7 + Math.floor(Math.random() * 7));
      return d.toISOString().slice(0, 10);
    }

    /** Play every Prompt of a run, accepting with the given Points (null = Miss). */
    async function playRun(plays: PlayStore, key: PlayKey, points: Array<number | null>) {
      for (const [i, p] of points.entries()) {
        const play = await plays.createPromptPlay(key, i, openPrompt(T0));
        if (p === null) continue;
        const next: PromptPlay = {
          ...play,
          accepted: { kind: "accepted", entityId: "teemo", entityName: "Teemo", tier: "kill", points: p },
        };
        await plays.updatePromptPlay(key, i, next);
      }
    }

    it("has no nickname until one is set, and lets it be changed", async () => {
      const { players } = makeStores();
      const me = device("nick");
      expect(await players.getNickname(me)).toBeNull();
      await players.setNickname(me, "Faker Fan");
      expect(await players.getNickname(me)).toBe("Faker Fan");
      await players.setNickname(me, "Teemo Main");
      expect(await players.getNickname(me)).toBe("Teemo Main");
    });

    it("creates a group with its creator as a member, and refuses a code that's taken", async () => {
      const { players } = makeStores();
      const code = generateGroupCode();
      expect(await players.createGroup(device("g1"), { code, name: "The Boys" })).toBe(true);
      expect(await players.getGroups(device("g1"))).toEqual([{ code, name: "The Boys" }]);
      expect(await players.createGroup(device("g2"), { code, name: "Other" })).toBe(false);
      expect(await players.getGroups(device("g2"))).toEqual([]);
    });

    it("lets a player join groups by code, more than one, and joining twice is harmless", async () => {
      const { players } = makeStores();
      const a = generateGroupCode();
      const b = generateGroupCode();
      await players.createGroup(device("owner"), { code: a, name: "A" });
      await players.createGroup(device("owner"), { code: b, name: "B" });
      expect(await players.joinGroup(device("joiner"), a)).toEqual({ code: a, name: "A" });
      expect(await players.joinGroup(device("joiner"), a)).toEqual({ code: a, name: "A" });
      await players.joinGroup(device("joiner"), b);
      expect(await players.getGroups(device("joiner"))).toEqual([
        { code: a, name: "A" },
        { code: b, name: "B" },
      ]);
    });

    it("refuses to join a group that doesn't exist", async () => {
      const { players } = makeStores();
      expect(await players.joinGroup(device("lost"), "ZZZZZZ")).toBeNull();
    });

    it("lists the day's totals with nicknames, for finished runs, ignoring archive plays", async () => {
      const { plays, players } = makeStores();
      const puzzleDay = freshDay();
      await players.setNickname(device("s1"), "Ana");
      await playRun(plays, { deviceId: device("s1"), puzzleDay }, [30, null]);
      await playRun(plays, { deviceId: device("s2"), puzzleDay }, [60, 100]);
      // Still on the first Prompt: not on the leaderboard yet.
      await playRun(plays, { deviceId: device("s3"), puzzleDay }, [85]);
      // Archive run: never counted.
      await playRun(plays, { deviceId: device("s4"), puzzleDay, archive: true }, [100, 100]);
      // Another day.
      await playRun(plays, { deviceId: device("s1"), puzzleDay: freshDay() }, [10, 10]);

      const scores = await players.getDayScores(puzzleDay, 2, LATER);
      expect(scores.sort((x, y) => x.total - y.total)).toEqual([
        { playerKey: device("s1"), nickname: "Ana", total: 30 },
        { playerKey: device("s2"), nickname: null, total: 160 },
      ]);
    });

    it("lists only a group's members when asked for a group", async () => {
      const { plays, players } = makeStores();
      const puzzleDay = freshDay();
      const code = generateGroupCode();
      await players.createGroup(device("m1"), { code, name: "Friends" });
      await players.joinGroup(device("m2"), code);
      for (const n of ["m1", "m2", "outsider"]) await playRun(plays, { deviceId: device(n), puzzleDay }, [30]);

      const scores = await players.getDayScores(puzzleDay, 1, LATER, code);
      expect(scores.map((s) => s.playerKey).sort()).toEqual([device("m1"), device("m2")]);
    });

    it("leaves a run off the leaderboard while its last Prompt is still open", async () => {
      const { plays, players } = makeStores();
      const puzzleDay = freshDay();
      await playRun(plays, { deviceId: device("o1"), puzzleDay }, [30, null]);
      await playRun(plays, { deviceId: device("o2"), puzzleDay }, [60, 100]);

      const answering = openPrompt(T0).windowOpenAt + 1_000;
      expect((await players.getDayScores(puzzleDay, 2, answering)).map((s) => s.playerKey)).toEqual([device("o2")]);
      expect((await players.getDayScores(puzzleDay, 2, LATER)).length).toBe(2);
    });
  });
}
