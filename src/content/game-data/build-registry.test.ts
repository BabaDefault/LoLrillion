import { describe, expect, it } from "vitest";
import type { GameDataSnapshot, SnapshotChampion, SnapshotItem } from "./snapshot";
import { buildRegistry } from "./build-registry";

const champion = (id: string, name: string): SnapshotChampion => ({
  id,
  key: 0,
  name,
  title: "",
  tags: [],
  attackRange: 175,
  abilities: [],
});

const item = (id: string, name: string, colloq: string[] = []): SnapshotItem => ({
  id,
  name,
  plaintext: "",
  description: "",
  tags: [],
  goldTotal: 0,
  stats: {},
  from: [],
  depth: 1,
  colloq,
});

const snapshot: GameDataSnapshot = {
  patch: "16.23.1",
  champions: [
    champion("Kaisa", "Kai'Sa"),
    champion("MonkeyKing", "Wukong"),
    champion("Nunu", "Nunu & Willump"),
    champion("Vi", "Vi"),
  ],
  items: [
    item("1036", "Long Sword", ["infinity edge"]),
    item("3031", "Infinity Edge", ["ie", "hat"]),
    item("3089", "Rabadon's Deathcap", ["dc", "hat"]),
  ],
  skins: [
    { id: 62001, name: "Volcanic Wukong", championId: "MonkeyKing", skinLineIds: [], rarity: "kNoRarity", isLegacy: false },
  ],
  skinLines: [],
  universes: [],
};

const byId = (id: string, nicknames = {}) => buildRegistry(snapshot, nicknames).find((e) => e.id === id);

describe("buildRegistry", () => {
  it("gives every champion, item and skin a stable, namespaced ID and its Answer Type", () => {
    expect(buildRegistry(snapshot, {}).map((e) => [e.id, e.answerType, e.name])).toEqual([
      ["champion:Kaisa", "champion", "Kai'Sa"],
      ["champion:MonkeyKing", "champion", "Wukong"],
      ["champion:Nunu", "champion", "Nunu & Willump"],
      ["champion:Vi", "champion", "Vi"],
      ["item:1036", "item", "Long Sword"],
      ["item:3031", "item", "Infinity Edge"],
      ["item:3089", "item", "Rabadon's Deathcap"],
      ["skin:62001", "skin", "Volcanic Wukong"],
    ]);
  });

  it("adds a champion's internal name as an Alias when it differs from the official name", () => {
    expect(byId("champion:MonkeyKing")?.aliases).toEqual(["MonkeyKing"]);
    expect(byId("champion:Nunu")?.aliases).toEqual(["Nunu"]);
    expect(byId("champion:Kaisa")?.aliases).toEqual([]);
  });

  it("adds the curated nicknames for an Entity, skipping ones that normalize to a name it already has", () => {
    const nicknames = { "champion:MonkeyKing": ["Wu", "Monkey King", "wukong"] };
    expect(byId("champion:MonkeyKing", nicknames)?.aliases).toEqual(["MonkeyKing", "Wu"]);
  });

  it("ignores Data Dragon's item `colloq` nicknames, which are too noisy to accept as Guesses", () => {
    expect(byId("item:3031")?.aliases).toEqual([]);
  });

  it("drops an Alias shared by two Entities, or naming another Entity, so each Alias resolves to exactly one", () => {
    const nicknames = {
      "item:1036": ["infinity edge"],
      "item:3031": ["ie", "hat"],
      "item:3089": ["dc", "hat"],
    };
    expect(byId("item:3031", nicknames)?.aliases).toEqual(["ie"]);
    expect(byId("item:3089", nicknames)?.aliases).toEqual(["dc"]);
    expect(byId("item:1036", nicknames)?.aliases).toEqual([]);
  });
});
