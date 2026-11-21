import { describe, expect, it } from "vitest";
import { openPrompt, submitAttempt, type AnswerType, type EntityId, type PromptDefinition } from "@/engine";
import { esportsSnapshot } from "@/content/esports";
import { buildRegistry } from "./build-registry";
import { entityRegistry } from "./index";
import { gameDataSnapshot } from "./snapshot-data";
import { NICKNAMES } from "./nicknames";

/**
 * Resolve a Guess through the Game Engine against the real Entity registry: the Prompt's Answer Set
 * holds every Entity of the Answer Type, so an accepted Attempt tells us which Entity the Guess matched.
 */
function resolve(guess: string, answerType: AnswerType = "champion"): EntityId | null {
  const answerSet = Object.fromEntries(
    entityRegistry.filter((e) => e.answerType === answerType).map((e) => [e.id, "kill" as const]),
  );
  const prompt: PromptDefinition = { text: "Name anything", answerType, rule: "", answerSet };
  const t0 = 1_700_000_000_000;
  const { result } = submitAttempt({
    prompt,
    entities: entityRegistry,
    play: openPrompt(t0),
    guess,
    now: t0 + 6_000,
  });
  return result.kind === "accepted" ? result.entityId : null;
}

describe("resolving Guesses against the real Entity registry", () => {
  it.each([
    ["MF", "champion:MissFortune"],
    ["TF", "champion:TwistedFate"],
    ["Asol", "champion:AurelionSol"],
    ["J4", "champion:JarvanIV"],
    ["Mundo", "champion:DrMundo"],
    ["wukong", "champion:MonkeyKing"],
    ["MonkeyKing", "champion:MonkeyKing"],
    ["nunu", "champion:Nunu"],
    ["kaisa", "champion:Kaisa"],
    ["Kai Sa", "champion:Kaisa"],
    ["GP", "champion:Gangplank"],
    ["TK", "champion:TahmKench"],
    ["Xin", "champion:XinZhao"],
    ["Cait", "champion:Caitlyn"],
    ["Heimer", "champion:Heimerdinger"],
    ["Lee", "champion:LeeSin"],
  ])("reads %s as %s", (guess, id) => {
    expect(resolve(guess)).toBe(id);
  });

  it.each([
    ["Vi", "champion:Vi"],
    ["Jax", "champion:Jax"],
    ["Zac", "champion:Zac"],
    ["Zed", "champion:Zed"],
  ])("reads the short name %s exactly as %s", (guess, id) => {
    expect(resolve(guess)).toBe(id);
    expect(resolve(guess.toLowerCase())).toBe(id);
  });

  it("resolves item nicknames among items", () => {
    expect(resolve("IE", "item")).toBe("item:3031");
    expect(resolve("Zhonyas", "item")).toBe("item:3157");
  });

  it("resolves skins by name", () => {
    expect(resolve("Volcanic Wukong", "skin")).toBe("skin:62001");
  });

  it("resolves pro players by current or former IGN, ignoring case", () => {
    expect(resolve("faker", "pro-player")).toBe("pro-player:Faker");
    expect(resolve("xpeke", "pro-player")).toBe("pro-player:XPeke");
    expect(resolve("Dean", "pro-player")).toBe("pro-player:Zeka (Kim Geon-woo)");
    expect(resolve("BangBang", "pro-player")).toBe("pro-player:Bang");
  });
});

describe("the committed registry", () => {
  it("covers champions, shop items and skins for a labelled patch", () => {
    expect(gameDataSnapshot.patch).toMatch(/^\d+\.\d+\.\d+$/);
    const count = (t: AnswerType) => entityRegistry.filter((e) => e.answerType === t).length;
    expect(count("champion")).toBeGreaterThan(160);
    expect(count("item")).toBeGreaterThan(150);
    expect(count("skin")).toBeGreaterThan(1500);
  });

  it("has unique Entity IDs", () => {
    expect(new Set(entityRegistry.map((e) => e.id)).size).toBe(entityRegistry.length);
  });

  it("is up to date with the snapshot and nicknames (run `npm run data:registry` if not)", () => {
    expect(entityRegistry).toEqual(buildRegistry(gameDataSnapshot, NICKNAMES, esportsSnapshot));
  });
});
