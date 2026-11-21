import { describe, expect, it } from "vitest";
import type { GeneratedPuzzle } from "@/builder";
import type { AcceptedResult, Entity } from "@/engine";
import { adminKey, adminToken, hasAdminAccess, isAdminKey, isAdminToken } from "./admin-auth";
import { adminDay } from "./admin-dashboard";
import type { AttemptLogEntry } from "./storage/play-store";

const KEY = "correct-horse-battery-staple";

describe("the admin key", () => {
  it("is off when unset, and refuses a short placeholder", () => {
    expect(adminKey({})).toBeNull();
    expect(adminKey({ LOLRILLION_ADMIN_KEY: "  " })).toBeNull();
    expect(() => adminKey({ LOLRILLION_ADMIN_KEY: "admin" })).toThrow(/16 characters/);
    expect(adminKey({ LOLRILLION_ADMIN_KEY: KEY })).toBe(KEY);
  });

  it("unlocks only with the exact key, and the cookie never holds the key itself", () => {
    expect(isAdminKey(KEY, KEY)).toBe(true);
    expect(isAdminKey(` ${KEY} `, KEY)).toBe(true);
    expect(isAdminKey("wrong", KEY)).toBe(false);
    expect(adminToken(KEY)).not.toContain(KEY);
    expect(isAdminToken(adminToken(KEY), KEY)).toBe(true);
    expect(isAdminToken(adminToken("other-key-of-enough-length"), KEY)).toBe(false);
    expect(isAdminToken(undefined, KEY)).toBe(false);
    expect(isAdminToken(KEY, KEY)).toBe(false);
  });

  it("grants access only to the right cookie, and never when no key is configured", () => {
    const env = { LOLRILLION_ADMIN_KEY: KEY };
    expect(hasAdminAccess(adminToken(KEY), env)).toBe(true);
    expect(hasAdminAccess(undefined, env)).toBe(false);
    expect(hasAdminAccess(adminToken("other-key-of-enough-length"), env)).toBe(false);
    expect(hasAdminAccess(adminToken(KEY), {})).toBe(false);
  });
});

const entities: Entity[] = [
  { id: "champion:Thresh", name: "Thresh", answerType: "champion", aliases: [] },
  { id: "champion:Blitzcrank", name: "Blitzcrank", answerType: "champion", aliases: ["blitz"] },
  { id: "champion:Kled", name: "Kled", answerType: "champion", aliases: [] },
  { id: "champion:Zac", name: "Zac", answerType: "champion", aliases: [] },
];

const puzzle: GeneratedPuzzle = {
  puzzleDay: "2026-11-22",
  puzzleNumber: 3,
  dataVersion: "16.23.1",
  prompts: [
    {
      templateId: "champions-pull",
      text: "Name a champion who can pull an enemy",
      answerType: "champion",
      rule: "Pulls.",
      answerSet: { "champion:Thresh": "minion", "champion:Blitzcrank": "minion", "champion:Kled": "pentakill" },
    },
  ],
};

const accepted = (entityId: string, points: number): AcceptedResult => ({
  kind: "accepted",
  entityId,
  entityName: entityId,
  tier: points === 100 ? "pentakill" : "minion",
  points,
});

function attempt(deviceId: string, archive: boolean, guess: string, result: AttemptLogEntry["result"]): AttemptLogEntry {
  return { deviceId, puzzleDay: "2026-11-22", archive, promptIndex: 0, guess, result, at: 0 };
}

describe("an admin day", () => {
  it("lists every answer by Tier, rarest first, with live and early pick counts", () => {
    const [prompt] = adminDay(puzzle, entities, [
      attempt("a", false, "zac", { kind: "rejected", reason: "not-in-answer-set" }),
      attempt("a", false, "thresh", accepted("champion:Thresh", 10)),
      attempt("b", false, "Thresh", accepted("champion:Thresh", 10)),
      attempt("c", true, "kled", accepted("champion:Kled", 100)),
      attempt("c", true, "kled", accepted("champion:Kled", 100)),
    ]);

    expect(prompt.tiers).toEqual([
      { tier: "pentakill", answers: [{ entityId: "champion:Kled", name: "Kled", live: 0, early: 1 }] },
      {
        tier: "minion",
        answers: [
          { entityId: "champion:Thresh", name: "Thresh", live: 2, early: 0 },
          { entityId: "champion:Blitzcrank", name: "Blitzcrank", live: 0, early: 0 },
        ],
      },
    ]);
    expect(prompt.players).toEqual({ live: 2, early: 1 });
  });

  it("shows Rejected Guesses, flagging ones that name a real Entity as possible missing answers", () => {
    const [prompt] = adminDay(puzzle, entities, [
      attempt("a", false, "Zac", { kind: "rejected", reason: "not-in-answer-set" }),
      attempt("b", true, "zac", { kind: "rejected", reason: "not-in-answer-set" }),
      attempt("b", true, "blitzz", { kind: "rejected", reason: "no-match" }),
      attempt("b", true, "late", { kind: "rejected", reason: "window-closed" }),
    ]);

    expect(prompt.rejected.map((g) => ({ guess: g.spellings[0], count: g.count, entity: g.entity?.name ?? null }))).toEqual([
      { guess: "Zac", count: 2, entity: "Zac" },
      { guess: "blitzz", count: 1, entity: null },
    ]);
  });
});
