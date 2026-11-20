import { describe, expect, it } from "vitest";
import { openPrompt, type AcceptedResult, type PromptPlay } from "@/engine";
import type { PlayKey, PlayStore } from "./play-store";

const T0 = 1_700_000_000_000;
/** Long after every Prompt opened at T0 has closed. */
const LATER = T0 + 60 * 60_000;

function accepted(entityId: string, points: number): AcceptedResult {
  return { kind: "accepted", entityId, entityName: entityId, tier: "kill", points };
}

/** Behaviour every PlayStore must have. Run against each implementation. */
export function describePlayStoreContract(name: string, makeStore: () => PlayStore) {
  describe(`${name} (PlayStore contract)`, () => {
    // Unique per run, so the suite can also run against a shared real database.
    const run = Math.random().toString(36).slice(2, 10);
    let dayCounter = 0;
    /** A fresh Puzzle Day in the far future, unique to this test. */
    function freshDay(): string {
      const d = new Date(Date.UTC(2100 + Math.floor(Math.random() * 800), 0, 1));
      d.setUTCDate(d.getUTCDate() + dayCounter++ * 7 + Math.floor(Math.random() * 7));
      return d.toISOString().slice(0, 10);
    }
    const device = (n: string) => `test-${run}-${n}`;

    async function acceptOn(store: PlayStore, key: PlayKey, promptIndex: number, entityId: string, points = 30) {
      const play = await store.createPromptPlay(key, promptIndex, openPrompt(T0));
      const next: PromptPlay = { ...play, accepted: accepted(entityId, points) };
      await store.updatePromptPlay(key, promptIndex, next);
    }

    it("keeps the first window-open time when a Prompt is started twice (reload)", async () => {
      const store = makeStore();
      const key = { deviceId: device("reload"), puzzleDay: freshDay() };
      await store.createPromptPlay(key, 0, openPrompt(T0));
      const second = await store.createPromptPlay(key, 0, openPrompt(T0 + 60_000));
      expect(second.windowOpenAt).toBe(openPrompt(T0).windowOpenAt);
      const plays = await store.getPromptPlays(key, 2);
      expect(plays[0]?.windowOpenAt).toBe(openPrompt(T0).windowOpenAt);
      expect(plays[1]).toBeNull();
    });

    it("counts how many players' Accepted Guess was each Entity, per Prompt", async () => {
      const store = makeStore();
      const puzzleDay = freshDay();
      await acceptOn(store, { deviceId: device("a"), puzzleDay }, 0, "teemo");
      await acceptOn(store, { deviceId: device("b"), puzzleDay }, 0, "teemo");
      await acceptOn(store, { deviceId: device("c"), puzzleDay }, 0, "garen");
      await acceptOn(store, { deviceId: device("a"), puzzleDay }, 1, "garen");
      // A player who started but hasn't been Accepted yet still counts as one of today's players.
      await store.createPromptPlay({ deviceId: device("d"), puzzleDay }, 0, openPrompt(T0));
      const counts = await store.getAnswerCounts(puzzleDay, 3);
      expect(counts.players).toBe(4);
      expect(counts.byPrompt[0]).toEqual({ teemo: 2, garen: 1 });
      expect(counts.byPrompt[1]).toEqual({ garen: 1 });
      expect(counts.byPrompt[2] ?? {}).toEqual({});
    });

    it("counts a player's Accepted Guess once, even if the play is saved again", async () => {
      const store = makeStore();
      const key = { deviceId: device("twice"), puzzleDay: freshDay() };
      await acceptOn(store, key, 0, "teemo");
      const [play] = await store.getPromptPlays(key, 1);
      await store.updatePromptPlay(key, 0, play!);
      expect((await store.getAnswerCounts(key.puzzleDay, 1)).byPrompt[0]).toEqual({ teemo: 1 });
    });

    it("remembers every 'Did you mean' candidate offered for a Prompt", async () => {
      const store = makeStore();
      const key = { deviceId: device("dym"), puzzleDay: freshDay() };
      await store.createPromptPlay(key, 0, openPrompt(T0));
      expect(await store.getOfferedCandidates(key, 0)).toEqual([]);
      await store.addOfferedCandidates(key, 0, ["teemo", "garen"]);
      await store.addOfferedCandidates(key, 0, ["garen", "lulu"]);
      expect((await store.getOfferedCandidates(key, 0)).sort()).toEqual(["garen", "lulu", "teemo"]);
      expect(await store.getOfferedCandidates(key, 1)).toEqual([]);
    });

    it("lists today's totals for players who finished every Prompt, ignoring archive plays", async () => {
      const store = makeStore();
      const puzzleDay = freshDay();
      // Finished: 30 + 0 (a Miss leaves the play un-accepted).
      const p1 = { deviceId: device("t1"), puzzleDay };
      await acceptOn(store, p1, 0, "teemo", 30);
      await store.createPromptPlay(p1, 1, openPrompt(T0));
      // Finished: 60 + 100.
      const p2 = { deviceId: device("t2"), puzzleDay };
      await acceptOn(store, p2, 0, "garen", 60);
      await acceptOn(store, p2, 1, "teemo", 100);
      // Still on the first Prompt: not counted.
      await acceptOn(store, { deviceId: device("t3"), puzzleDay }, 0, "teemo", 85);
      // Archive run: not counted.
      const p4 = { deviceId: device("t4"), puzzleDay, archive: true };
      await acceptOn(store, p4, 0, "teemo", 10);
      await acceptOn(store, p4, 1, "teemo", 10);

      expect((await store.getDayTotals(puzzleDay, 2, LATER)).sort((a, b) => a - b)).toEqual([30, 160]);
    });

    it("leaves out a run whose last Prompt is still open, until its answer window closes", async () => {
      const store = makeStore();
      const puzzleDay = freshDay();
      // Started the last Prompt, no Accepted Guess yet: not finished while its window is open.
      const open = { deviceId: device("open"), puzzleDay };
      await acceptOn(store, open, 0, "teemo", 30);
      await store.createPromptPlay(open, 1, openPrompt(T0));
      // Accepted on the last Prompt: finished even though the window is still open.
      const done = { deviceId: device("done"), puzzleDay };
      await acceptOn(store, done, 0, "teemo", 60);
      await acceptOn(store, done, 1, "garen", 100);

      const answering = openPrompt(T0).windowOpenAt + 1_000;
      expect(await store.getDayTotals(puzzleDay, 2, answering)).toEqual([160]);
      expect((await store.getDayTotals(puzzleDay, 2, LATER)).sort((a, b) => a - b)).toEqual([30, 160]);
    });

    it("keeps archive plays apart from the counted play and out of Answer Share", async () => {
      const store = makeStore();
      const puzzleDay = freshDay();
      const live = { deviceId: device("arch"), puzzleDay };
      const archive = { ...live, archive: true };
      await acceptOn(store, live, 0, "teemo");
      await acceptOn(store, archive, 0, "garen");
      expect(await store.getAnswerCounts(puzzleDay, 1)).toEqual({ players: 1, byPrompt: [{ teemo: 1 }] });
      expect((await store.getPromptPlays(live, 1))[0]?.accepted?.entityId).toBe("teemo");
      expect((await store.getPromptPlays(archive, 1))[0]?.accepted?.entityId).toBe("garen");
    });

    it("lists every play of one device, live and archive, for personal stats", async () => {
      const store = makeStore();
      const day1 = freshDay();
      const day2 = freshDay();
      const me = device("stats");
      await acceptOn(store, { deviceId: me, puzzleDay: day1 }, 0, "teemo", 30);
      await store.createPromptPlay({ deviceId: me, puzzleDay: day1 }, 1, openPrompt(T0));
      await acceptOn(store, { deviceId: me, puzzleDay: day2, archive: true }, 0, "garen", 100);
      // Someone else's play is not listed.
      await acceptOn(store, { deviceId: device("other"), puzzleDay: day1 }, 0, "lulu", 60);

      const plays = await store.getDevicePlays(me);
      const summary = plays
        .map((p) => [p.puzzleDay, p.archive, p.promptIndex, p.play.accepted?.entityId ?? null, p.play.accepted?.points ?? 0])
        .sort((a, b) => `${a[0]}${a[2]}`.localeCompare(`${b[0]}${b[2]}`));
      expect(summary).toEqual(
        [
          [day1, false, 0, "teemo", 30],
          [day1, false, 1, null, 0],
          [day2, true, 0, "garen", 100],
        ].sort((a, b) => `${a[0]}${a[2]}`.localeCompare(`${b[0]}${b[2]}`)),
      );
      expect(plays.find((p) => p.play.accepted)?.play.accepted?.tier).toBe("kill");
      expect(await store.getDevicePlays(device("nobody"))).toEqual([]);
    });
  });
}
