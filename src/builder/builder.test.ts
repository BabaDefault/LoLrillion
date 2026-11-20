import { describe, expect, it } from "vitest";
import { fixtureInputs } from "./fixtures";
import { answerSetOf, type ApprovedLabel, type TemplateDefinition } from "./index";

const template = (filter: TemplateDefinition["filter"], answerType: TemplateDefinition["answerType"]): TemplateDefinition => ({
  id: "t",
  text: "Name one",
  answerType,
  rule: "A rule.",
  filter,
});

describe("Template filters", () => {
  it("items that give Magic Resist are those with the stat", () => {
    const set = answerSetOf(template({ kind: "item-stat", stat: "FlatSpellBlockMod" }, "item"), fixtureInputs);
    expect(set.sort()).toEqual(["item:1057", "item:3065", "item:3111"]);
  });

  it("skin names match a word starting with the given word, not mid-word", () => {
    const set = answerSetOf(template({ kind: "skin-name-word", word: "Dragon", prefix: true }, "skin"), fixtureInputs);
    expect(set.sort()).toEqual(["skin:5005", "skin:875001", "skin:91010"]);
  });

  it("champion name length counts letters only", () => {
    const set = answerSetOf(template({ kind: "champion-name-length", atMost: 3 }, "champion"), fixtureInputs);
    expect(set.sort()).toEqual(["champion:Vi", "champion:Zed"]);
  });

  it("champions with an approved mechanics label term; none when no labels are approved yet", () => {
    const labelled = template({ kind: "champion-label", term: "invisible" }, "champion");
    expect(answerSetOf(labelled, fixtureInputs)).toEqual([]);
    const labels: ApprovedLabel[] = [
      { entityId: "champion:Kaisa", term: "invisible", ability: "E", quote: "becomes Invisible", sourceField: "tooltip" },
      { entityId: "champion:Zed", term: "dash", ability: "W", quote: "dashes", sourceField: "tooltip" },
    ];
    expect(answerSetOf(labelled, { ...fixtureInputs, labels })).toEqual(["champion:Kaisa"]);
  });
});
