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

  it("items whose tooltip stats block names the stat count, even when Data Dragon's stats map leaves it out", () => {
    const tooltipOnly = {
      id: "3032",
      name: "Yun Tal Wildarrows",
      plaintext: "",
      description:
        "<mainText><stats><attention>50</attention> Attack Damage<br><attention>0%</attention> Critical Strike Chance</stats><br><br>" +
        "<passive>Practice Makes Lethal</passive><br>On-Attack, gain Critical Strike Chance permanently up to 25%.</mainText>",
      tags: [],
      goldTotal: 3000,
      stats: { FlatPhysicalDamageMod: 50 },
      from: [],
      depth: 3,
      colloq: [],
    };
    const passiveOnly = {
      ...tooltipOnly,
      id: "9999",
      name: "Passive Crit",
      description: "<mainText><stats><attention>10</attention> Attack Damage</stats><br>Gain Critical Strike Chance.</mainText>",
    };
    const inputs = {
      ...fixtureInputs,
      snapshot: { ...fixtureInputs.snapshot, items: [...fixtureInputs.snapshot.items, tooltipOnly, passiveOnly] },
    };
    const crit = answerSetOf(template({ kind: "item-stat", stat: "FlatCritChanceMod" }, "item"), inputs);
    expect(crit).toContain("item:3032");
    expect(crit).not.toContain("item:9999");
  });

  it("a tooltip stat must be named exactly: Armor Penetration is not Armor", () => {
    const penOnly = {
      id: "9998",
      name: "Pen Blade",
      plaintext: "",
      description: "<mainText><stats><attention>18</attention> Armor Penetration</stats></mainText>",
      tags: [],
      goldTotal: 3000,
      stats: {},
      from: [],
      depth: 3,
      colloq: [],
    };
    const inputs = { ...fixtureInputs, snapshot: { ...fixtureInputs.snapshot, items: [penOnly] } };
    expect(answerSetOf(template({ kind: "item-stat", stat: "FlatArmorMod" }, "item"), inputs)).toEqual([]);
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
