import { describe, expect, it } from "vitest";
import type { Tier } from "@/engine";
import { fixtureInputs } from "./fixtures";
import { bandByPrior, buildPrompt, type BuilderInputs, type TemplateDefinition } from "./index";

const RANK: Record<Tier, number> = {
  minion: 0,
  "too-clever": 0,
  kill: 1,
  "triple-kill": 2,
  "quadra-kill": 3,
  pentakill: 4,
};

/** Twelve MR items, so every band has members. */
const items = Array.from({ length: 12 }, (_, i) => ({
  id: String(1000 + i),
  name: `Item ${i}`,
  plaintext: "",
  description: "",
  tags: [],
  goldTotal: 500 + i * 100,
  stats: { FlatSpellBlockMod: 10 },
  from: [],
  depth: 1,
  colloq: [],
}));
const ids = items.map((i) => `item:${i.id}`);
const inputs: BuilderInputs = { ...fixtureInputs, snapshot: { ...fixtureInputs.snapshot, items } };

const mr: TemplateDefinition = {
  id: "items-magic-resist",
  text: "Name an item that gives Magic Resist",
  answerType: "item",
  rule: "Shop items whose stats include Magic Resist.",
  filter: { kind: "item-stat", stat: "FlatSpellBlockMod" },
};

/** Typicality falls with list position: item 0 is the most typical. */
const typicality = Object.fromEntries(ids.map((id, i) => [id, 1 - i / ids.length]));

const tiersOf = (set: Record<string, Tier>) => Object.values(set);

describe("Tiers", () => {
  it("carries the Template's Prompt text, Answer Type and Rule", () => {
    const prompt = buildPrompt(mr, inputs);
    expect(prompt).toMatchObject({ templateId: mr.id, text: mr.text, answerType: "item", rule: mr.rule });
    expect(Object.keys(prompt.answerSet).sort()).toEqual([...ids].sort());
  });

  it("has exactly one Gem, even with default Typicality and no review", () => {
    expect(tiersOf(buildPrompt(mr, inputs).answerSet).filter((t) => t === "pentakill")).toHaveLength(1);
  });

  it("without an approved Gem, picks a rare but reachable answer, never the least likely one", () => {
    // Krillion: the Gem is "something at least a few of you actually get", not the deepest cut.
    const { answerSet } = buildPrompt(mr, { ...inputs, reviews: { [mr.id]: { templateId: mr.id, typicality } } });
    const gem = ids.findIndex((id) => answerSet[id] === "pentakill");
    expect(gem).toBeGreaterThan(ids.length / 2);
    expect(gem).toBeLessThan(ids.length - 1);
  });

  it("uses the approved Gem and approved Too Clever picks", () => {
    const review = { templateId: mr.id, typicality, gem: ids[3], tooClever: [ids[10], ids[11]] };
    const { answerSet } = buildPrompt(mr, { ...inputs, reviews: { [mr.id]: review } });
    expect(answerSet[ids[3]]).toBe("pentakill");
    expect(tiersOf(answerSet).filter((t) => t === "pentakill")).toHaveLength(1);
    expect(answerSet[ids[10]]).toBe("too-clever");
    expect(answerSet[ids[11]]).toBe("too-clever");
  });

  it("orders the four normal bands by Prior: a likelier answer is never in a rarer band", () => {
    const review = { templateId: mr.id, typicality, gem: ids[0] };
    const { answerSet } = buildPrompt(mr, { ...inputs, reviews: { [mr.id]: review } });
    const banded = ids.slice(1).map((id) => RANK[answerSet[id]]);
    expect(banded).toEqual([...banded].sort((a, b) => a - b));
    expect(answerSet[ids[1]]).toBe("minion");
    expect(answerSet[ids[11]]).toBe("quadra-kill");
    expect(new Set(banded).size).toBe(4);
  });

  it("blends in Familiarity when present: equal Typicality, the better-known answer is commoner", () => {
    const flat = Object.fromEntries(ids.map((id) => [id, 0.5]));
    const buildRates = Object.fromEntries(ids.map((id, i) => [id, { buildRate: i }]));
    const familiarity = { patch: "99.1", champions: {}, items: buildRates };
    const review = { templateId: mr.id, typicality: flat, gem: ids[0] };
    const { answerSet } = buildPrompt(mr, { ...inputs, familiarity, reviews: { [mr.id]: review } });
    expect(answerSet[ids[11]]).toBe("minion");
    expect(answerSet[ids[1]]).toBe("quadra-kill");
  });
});

describe("banding by Prior", () => {
  it("bands likeliest first: 30% Minion, 30% Kill, 25% Triple Kill, the rest Quadra Kill", () => {
    const prior = new Map(Array.from({ length: 10 }, (_, i) => [`e${i}`, 1 - i / 10] as const));
    expect([...bandByPrior(prior).values()]).toEqual([
      ...Array(3).fill("minion"),
      ...Array(3).fill("kill"),
      ...Array(3).fill("triple-kill"),
      "quadra-kill",
    ]);
  });

  it("puts equal Priors in the same band, the band of the tie's first position", () => {
    const tiers = bandByPrior(
      new Map([
        ["d", 0.1],
        ["c", 0.5],
        ["a", 0.9],
        ["b", 0.5],
      ]),
    );
    expect([...tiers]).toEqual([
      ["a", "minion"],
      ["b", "minion"],
      ["c", "minion"],
      ["d", "triple-kill"],
    ]);
  });

  it("uses the band shares it is given", () => {
    const prior = new Map([
      ["a", 0.9],
      ["b", 0.5],
    ]);
    expect([...bandByPrior(prior, { minion: 0.5, kill: 0.5, "triple-kill": 0 }).values()]).toEqual(["minion", "kill"]);
  });
});
