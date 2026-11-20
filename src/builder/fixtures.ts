import type { GameDataSnapshot, SnapshotChampion, SnapshotItem, SnapshotSkin } from "@/content/game-data/snapshot";
import type { BuilderInputs } from "./types";

/** Small hand-made game data for Builder tests. */

const champion = (id: string, key: number, name = id): SnapshotChampion => ({
  id,
  key,
  name,
  title: "",
  tags: [],
  attackRange: 125,
  abilities: [],
});

const item = (id: string, name: string, stats: Record<string, number>, goldTotal = 1000): SnapshotItem => ({
  id,
  name,
  plaintext: "",
  description: "",
  tags: [],
  goldTotal,
  stats,
  from: [],
  depth: 1,
  colloq: [],
});

const skin = (id: number, name: string, championId: string, rarity = "kEpic"): SnapshotSkin => ({
  id,
  name,
  championId,
  skinLineIds: [],
  rarity,
  isLegacy: false,
});

export const fixtureSnapshot: GameDataSnapshot = {
  patch: "99.1.1",
  champions: [
    champion("Teemo", 17),
    champion("Tristana", 18),
    champion("Lulu", 117),
    champion("Yuumi", 350),
    champion("Garen", 86),
    champion("Gnar", 150),
    champion("Vi", 254),
    champion("Kaisa", 145, "Kai'Sa"),
    champion("Zed", 238),
  ],
  items: [
    item("1057", "Negatron Cloak", { FlatSpellBlockMod: 50 }, 850),
    item("3111", "Mercury's Treads", { FlatSpellBlockMod: 20, FlatMovementSpeedMod: 45 }, 1250),
    item("3065", "Spirit Visage", { FlatHPPoolMod: 400, FlatSpellBlockMod: 50 }, 2700),
    item("1036", "Long Sword", { FlatPhysicalDamageMod: 10 }, 350),
  ],
  skins: [
    skin(5005, "Dragonslayer Xin Zhao", "XinZhao"),
    skin(91010, "Dragonblade Talon", "Talon"),
    skin(875001, "Obsidian Dragon Sett", "Sett", "kLegendary"),
    skin(1001, "Goth Annie", "Annie"),
    skin(2002, "Snapdragon Zyra", "Zyra"),
  ],
  skinLines: [],
  universes: [],
};

export const fixtureInputs: BuilderInputs = { snapshot: fixtureSnapshot };
