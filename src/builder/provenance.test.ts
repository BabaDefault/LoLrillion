import { describe, expect, it } from "vitest";
import { fixtureInputs } from "./fixtures";
import {
  buildPrompt,
  explainPrompt,
  SCORING_CONSTANTS,
  type ApprovedLabel,
  type BuilderInputs,
  type PromptProvenance,
  type TemplateDefinition,
} from "./index";

const mr: TemplateDefinition = {
  id: "items-magic-resist",
  text: "Name an item that gives Magic Resist",
  answerType: "item",
  rule: "Shop items whose stats include Magic Resist.",
  filter: { kind: "item-stat", stat: "FlatSpellBlockMod" },
};

describe("Prompt provenance", () => {
  it("records the data version, and says when no review, labels or Familiarity were used", () => {
    const { provenance } = buildPrompt(mr, fixtureInputs);
    expect(provenance).toMatchObject({
      dataVersion: "99.1.1",
      review: "unreviewed",
      labels: "unused",
      familiarity: "none",
    });
    expect(provenance?.scoring).toMatch(/^sha256:[0-9a-f]{16}$/);
  });

  it("building twice from identical inputs gives identical provenance and Tiers", () => {
    const once = buildPrompt(invisible, full);
    const twice = buildPrompt(invisible, structuredClone(full));
    expect(twice).toEqual(once);
    expect(once.provenance).toMatchObject({
      review: expect.stringMatching(/^sha256:/),
      labels: expect.stringMatching(/^sha256:/),
      familiarity: { patch: "99.1.1", hash: expect.stringMatching(/^sha256:/) },
    });
  });

  it("a review's Gem changing changes the review field and nothing else", () => {
    const before = buildPrompt(invisible, full).provenance;
    const reviews = { [invisible.id]: { ...review, gem: "champion:Zed" } };
    expect(changedFields(before, buildPrompt(invisible, { ...full, reviews }).provenance)).toEqual(["review"]);
  });

  it("a label changing changes the labels field and nothing else", () => {
    const before = buildPrompt(invisible, full).provenance;
    const labels = full.labels!.map((l) => (l.entityId === "champion:Zed" ? { ...l, quote: "vanishes" } : l));
    expect(changedFields(before, buildPrompt(invisible, { ...full, labels }).provenance)).toEqual(["labels"]);
  });

  it("a label for another term doesn't change a Prompt's provenance", () => {
    const before = buildPrompt(invisible, full).provenance;
    const labels = [...full.labels!, { ...full.labels![0], term: "dash" }];
    expect(buildPrompt(invisible, { ...full, labels }).provenance).toEqual(before);
  });

  it("a scoring constant changing changes the scoring field and nothing else", () => {
    const before = buildPrompt(invisible, full).provenance;
    const scoring = { ...SCORING_CONSTANTS, DEFAULT_GEM_POSITION: 0.5 };
    expect(changedFields(before, buildPrompt(invisible, { ...full, scoring }).provenance)).toEqual(["scoring"]);
  });

  it("the Familiarity file changing changes the familiarity field and nothing else", () => {
    const before = buildPrompt(invisible, full).provenance;
    const familiarity = { ...full.familiarity!, champions: { "champion:Zed": { mastery: 0.9, pickRate: 0.1 } } };
    expect(changedFields(before, buildPrompt(invisible, { ...full, familiarity }).provenance)).toEqual(["familiarity"]);
  });
});

describe("explaining a stored Prompt against a rebuild from today's inputs", () => {
  it("an unchanged rebuild is the same", () => {
    expect(explainPrompt(buildPrompt(invisible, full), buildPrompt(invisible, full))).toEqual({
      status: "same",
      changedInputs: [],
      tiersChanged: false,
    });
  });

  it("names the input that changed, and whether the Answer Set or Tiers moved", () => {
    const stored = buildPrompt(invisible, full);
    const reviews = { [invisible.id]: { ...review, gem: "champion:Zed" } };
    expect(explainPrompt(stored, buildPrompt(invisible, { ...full, reviews }))).toEqual({
      status: "changed",
      changedInputs: ["review"],
      tiersChanged: true,
    });
  });

  it("a Prompt built before provenance existed has none to compare, but its Tiers still are", () => {
    const { provenance: _, ...stored } = buildPrompt(invisible, full);
    expect(explainPrompt(stored, buildPrompt(invisible, full))).toEqual({
      status: "no-provenance",
      changedInputs: [],
      tiersChanged: false,
    });
  });
});

const invisible: TemplateDefinition = {
  id: "champions-invisible",
  text: "Name a champion who can turn invisible",
  answerType: "champion",
  rule: "Invisible.",
  filter: { kind: "champion-label", term: "invisible" },
};

const label = (champion: string): ApprovedLabel => ({
  entityId: `champion:${champion}`,
  term: "invisible",
  ability: "R",
  quote: "becomes Invisible",
  sourceField: "tooltip",
});

const review = { templateId: invisible.id, typicality: { "champion:Kaisa": 0.9 }, tooClever: [], gem: "champion:Vi" };

/** Every input present: a review, labels, Familiarity. */
const full: BuilderInputs = {
  ...fixtureInputs,
  labels: ["Kaisa", "Zed", "Vi", "Teemo"].map(label),
  familiarity: {
    patch: "99.1.1",
    champions: { "champion:Kaisa": { mastery: 0.2, pickRate: 0.1 }, "champion:Zed": { mastery: 0.5, pickRate: 0.2 } },
    items: {},
  },
  reviews: { [invisible.id]: review },
};

function changedFields(a?: PromptProvenance, b?: PromptProvenance): string[] {
  if (!a || !b) throw new Error("expected provenance");
  const keys = Object.keys(a) as (keyof PromptProvenance)[];
  return keys.filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
}
