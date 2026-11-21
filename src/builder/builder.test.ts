import { describe, expect, it } from "vitest";
import { fixtureEsports, fixtureInputs } from "./fixtures";
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

  it("champion name length can set a minimum instead, still counting letters only", () => {
    const set = answerSetOf(template({ kind: "champion-name-length", atLeast: 6 }, "champion"), fixtureInputs);
    expect(set.sort()).toEqual(["champion:Tristana"]);
  });

  it("champion name patterns match the official name, ignoring case when asked", () => {
    const apostrophe = answerSetOf(template({ kind: "champion-name-pattern", pattern: "'" }, "champion"), fixtureInputs);
    expect(apostrophe).toEqual(["champion:Kaisa"]);
    const doubled = answerSetOf(template({ kind: "champion-name-pattern", pattern: "(\\p{L})\\1", flags: "iu" }, "champion"), fixtureInputs);
    expect(doubled.sort()).toEqual(["champion:Teemo", "champion:Yuumi"]);
  });

  it("curated traits select champions and items in the current data that carry the trait", () => {
    const traits = [
      { entityId: "champion:Tristana", trait: "uses-gun", why: "Boomer, her cannon." },
      { entityId: "champion:Shaco", trait: "uses-gun", why: "Not in this snapshot." },
      { entityId: "item:3111", trait: "named-after-person", why: "Mercury." },
    ];
    const inputs = { ...fixtureInputs, traits };
    expect(answerSetOf(template({ kind: "trait", trait: "uses-gun" }, "champion"), inputs)).toEqual(["champion:Tristana"]);
    expect(answerSetOf(template({ kind: "trait", trait: "named-after-person" }, "item"), inputs)).toEqual(["item:3111"]);
    expect(answerSetOf(template({ kind: "trait", trait: "uses-gun" }, "champion"), fixtureInputs)).toEqual([]);
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

  it("Worlds winners are every player on any Worlds-winning roster, once each", () => {
    const set = answerSetOf(template({ kind: "worlds-winner" }, "pro-player"), { ...fixtureInputs, esports: fixtureEsports });
    expect(set).toHaveLength(12);
    expect(set).toContain("pro-player:Faker");
    expect(set).not.toContain("pro-player:Uzi");
  });

  it("an esports filter without an esports snapshot is an error, not an empty Answer Set", () => {
    expect(() => answerSetOf(template({ kind: "worlds-winner" }, "pro-player"), fixtureInputs)).toThrow(/esports/);
  });
});

