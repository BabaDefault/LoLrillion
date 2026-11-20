import { describe, expect, it } from "vitest";
import { snapshotFromRaw, type RawGameData } from "./transform";

// Small hand-made fixtures shaped like the real Data Dragon / Community Dragon files.

const spell = (name: string, description: string) => ({
  id: name.replace(/\W/g, ""),
  name,
  description,
  tooltip: `<b>${name}</b> {{ dmg }}`,
  maxrank: 5,
});

const champion = (id: string, key: string, name: string, extra: object = {}) => ({
  id,
  key,
  name,
  title: `the ${name}`,
  tags: ["Fighter"],
  stats: { attackrange: 175 },
  passive: { name: `${name} Passive`, description: "Passive text." },
  spells: [spell(`${name} Q`, "Q text."), spell(`${name} W`, "W text."), spell(`${name} E`, "E text."), spell(`${name} R`, "R text.")],
  skins: [],
  lore: "Long lore we do not keep.",
  ...extra,
});

const shopItem = (name: string, extra: object = {}) => ({
  name,
  description: `<mainText><stats>${name} stats</stats></mainText>`,
  colloq: "",
  plaintext: `${name} plaintext`,
  gold: { base: 100, purchasable: true, total: 1000, sell: 700 },
  tags: ["Damage"],
  maps: { "11": true, "12": true },
  stats: { FlatPhysicalDamageMod: 10 },
  depth: 2,
  from: ["1036"],
  ...extra,
});

function raw(overrides: Partial<RawGameData> = {}): RawGameData {
  return {
    version: "16.23.1",
    championFull: {
      keys: { "62": "MonkeyKing", "145": "Kaisa", "20": "Nunu", "254": "Vi" },
      data: {
        MonkeyKing: champion("MonkeyKing", "62", "Wukong"),
        Kaisa: champion("Kaisa", "145", "Kai'Sa", { stats: { attackrange: 525 }, tags: ["Marksman"] }),
        Nunu: champion("Nunu", "20", "Nunu & Willump"),
        Vi: champion("Vi", "254", "Vi"),
      },
    },
    items: { basic: { inStore: true, hideFromAll: false, requiredChampion: "" }, data: {} },
    cdSkins: {},
    cdSkinLines: [],
    cdUniverses: [],
    ...overrides,
  };
}

describe("snapshotFromRaw", () => {
  it("labels the snapshot with its patch", () => {
    expect(snapshotFromRaw(raw()).patch).toBe("16.23.1");
  });

  it("keeps each champion's identity and its passive + Q/W/E/R abilities, dropping lore", () => {
    const wukong = snapshotFromRaw(raw()).champions.find((c) => c.id === "MonkeyKing");
    expect(wukong).toEqual({
      id: "MonkeyKing",
      key: 62,
      name: "Wukong",
      title: "the Wukong",
      tags: ["Fighter"],
      attackRange: 175,
      abilities: [
        { slot: "P", name: "Wukong Passive", description: "Passive text." },
        { slot: "Q", name: "Wukong Q", description: "Q text.", tooltip: "<b>Wukong Q</b> {{ dmg }}" },
        { slot: "W", name: "Wukong W", description: "W text.", tooltip: "<b>Wukong W</b> {{ dmg }}" },
        { slot: "E", name: "Wukong E", description: "E text.", tooltip: "<b>Wukong E</b> {{ dmg }}" },
        { slot: "R", name: "Wukong R", description: "R text.", tooltip: "<b>Wukong R</b> {{ dmg }}" },
      ],
    });
  });
});

describe("snapshotFromRaw: items", () => {
  const items = {
    basic: { inStore: true, hideFromAll: false, requiredChampion: "" },
    data: {
      "3031": shopItem("Infinity Edge", { colloq: ";ie" }),
      "1101": shopItem("Scorchclaw Pup"),
      "1107": shopItem("Scorchclaw Pup"),
      "323003": shopItem("Archangel's Staff"), // mode-specific copy with a 6-digit id
      "3040": shopItem("Seraph's Embrace", { inStore: false }),
      "3330": shopItem("Scarecrow Effigy", { requiredChampion: "FiddleSticks" }),
      "3599": shopItem("Kalista's Black Spear", { requiredAlly: "Kalista" }),
      "3400": shopItem("Your Cut", { hideFromAll: true }),
      "4403": shopItem("Golden Spatula", { gold: { purchasable: false, total: 0 } }),
      "3184": shopItem("Guardian's Hammer", { maps: { "11": false, "12": true } }),
    },
  };

  it("keeps only items currently in the Summoner's Rift shop, one per name (lowest id)", () => {
    const snapshot = snapshotFromRaw(raw({ items }));
    expect(snapshot.items.map((i) => [i.id, i.name])).toEqual([
      ["1101", "Scorchclaw Pup"],
      ["3031", "Infinity Edge"],
    ]);
  });

  it("keeps the fields Templates need and drops the rest", () => {
    const ie = snapshotFromRaw(raw({ items })).items.find((i) => i.id === "3031");
    expect(ie).toEqual({
      id: "3031",
      name: "Infinity Edge",
      plaintext: "Infinity Edge plaintext",
      description: "<mainText><stats>Infinity Edge stats</stats></mainText>",
      tags: ["Damage"],
      goldTotal: 1000,
      stats: { FlatPhysicalDamageMod: 10 },
      from: ["1036"],
      depth: 2,
      colloq: ["ie"],
    });
  });
});

describe("snapshotFromRaw: skins and skin lines", () => {
  const cdSkins = {
    "62000": { id: 62000, isBase: true, name: "Wukong", skinLines: null, rarity: "kNoRarity", isLegacy: false },
    "62001": {
      id: 62001,
      isBase: false,
      name: "Volcanic Wukong",
      skinLines: [{ id: 86 }],
      rarity: "kNoRarity",
      isLegacy: true,
      chromas: [{ id: 62002, name: "Volcanic Wukong (Ruby)" }],
    },
    "145001": { id: 145001, isBase: false, name: "Bullet Angel Kai'Sa", skinLines: null, rarity: "kEpic", isLegacy: false },
    "60020301": { id: 60020301, isBase: false, name: "Classic Nunu", skinLines: null, rarity: "kNoRarity", isLegacy: false },
  };
  const cdSkinLines = [
    { id: 0, name: "", description: "" },
    { id: 86, name: "Infernal", description: "Scorching an entire world..." },
  ];
  const cdUniverses = [
    { id: 0, name: "", description: "", skinSets: [] },
    { id: 7, name: "Infernal", description: "...", skinSets: [86] },
  ];
  const snapshot = snapshotFromRaw(raw({ cdSkins, cdSkinLines, cdUniverses }));

  it("keeps real skins only: no base skins, chromas or legacy-model variants", () => {
    expect(snapshot.skins).toEqual([
      { id: 62001, name: "Volcanic Wukong", championId: "MonkeyKing", skinLineIds: [86], rarity: "kNoRarity", isLegacy: true },
      { id: 145001, name: "Bullet Angel Kai'Sa", championId: "Kaisa", skinLineIds: [], rarity: "kEpic", isLegacy: false },
    ]);
  });

  it("keeps named skin lines and universes", () => {
    expect(snapshot.skinLines).toEqual([{ id: 86, name: "Infernal" }]);
    expect(snapshot.universes).toEqual([{ id: 7, name: "Infernal", skinLineIds: [86] }]);
  });
});
