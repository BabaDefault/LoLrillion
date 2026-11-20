import type { AbilitySlot, GameDataSnapshot, SnapshotChampion, SnapshotItem, SnapshotSkin } from "./snapshot";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;

/** The raw files fetched from Data Dragon (`championFull`, `items`) and Community Dragon (`cd*`). */
export interface RawGameData {
  version: string;
  championFull: Json;
  items: Json;
  cdSkins: Json;
  cdSkinLines: Json;
  cdUniverses: Json;
}

const SPELL_SLOTS: AbilitySlot[] = ["Q", "W", "E", "R"];

/** Trim the raw game data down to the snapshot the app keeps. Pure. */
export function snapshotFromRaw(raw: RawGameData): GameDataSnapshot {
  return {
    patch: raw.version,
    champions: champions(raw.championFull),
    items: shopItems(raw.items),
    skins: skins(raw.cdSkins, raw.championFull),
    skinLines: named<Json>(raw.cdSkinLines).map((l) => ({ id: l.id, name: l.name })),
    universes: named<Json>(raw.cdUniverses).map((u) => ({
      id: u.id,
      name: u.name,
      skinLineIds: u.skinSets ?? [],
    })),
  };
}

/** Community Dragon lists start with an empty `id: 0` placeholder. */
function named<T extends { id: number; name: string }>(list: T[]): T[] {
  return list.filter((x) => x.id !== 0 && x.name !== "").sort((a, b) => a.id - b.id);
}

/**
 * Real skins from Community Dragon. Chromas are nested there (not top-level), base skins are flagged
 * `isBase`, and legacy-model "Classic X" variants have 8-digit ids (champion key * 1000 + num is always
 * below a million), so those are dropped.
 */
function skins(cdSkins: Json, championFull: Json): SnapshotSkin[] {
  const championIdByKey: Record<string, string> = championFull.keys;
  return Object.values<Json>(cdSkins)
    .filter((s) => !s.isBase && s.id < 1_000_000)
    .flatMap((s) => {
      const championId = championIdByKey[String(Math.floor(s.id / 1000))];
      if (!championId) return [];
      return [
        {
          id: s.id,
          name: s.name,
          championId,
          skinLineIds: (s.skinLines ?? []).map((l: Json) => l.id),
          rarity: s.rarity,
          isLegacy: Boolean(s.isLegacy),
        },
      ];
    })
    .sort((a, b) => a.id - b.id);
}

/**
 * Items currently purchasable in the Summoner's Rift shop. Data Dragon also lists mode-specific copies
 * (6-digit ids, some still flagged for map 11), champion-only items and hidden items; those are dropped.
 * Some items appear twice under one name (jungle pets): keep the lowest id.
 */
function shopItems(itemJson: Json): SnapshotItem[] {
  const basic = itemJson.basic ?? {};
  const field = (item: Json, name: string) => item[name] ?? basic[name];
  const byName = new Map<string, SnapshotItem>();
  const entries = Object.entries<Json>(itemJson.data).sort(([a], [b]) => Number(a) - Number(b));
  for (const [id, item] of entries) {
    const inShop =
      id.length <= 4 &&
      item.maps?.["11"] === true &&
      item.gold?.purchasable === true &&
      field(item, "inStore") !== false &&
      !field(item, "hideFromAll") &&
      !field(item, "requiredChampion") &&
      !field(item, "requiredAlly");
    if (!inShop) continue;
    const name = stripTags(item.name);
    if (byName.has(name)) continue;
    byName.set(name, {
      id,
      name,
      plaintext: item.plaintext ?? "",
      description: item.description ?? "",
      tags: item.tags ?? [],
      goldTotal: item.gold.total,
      stats: item.stats ?? {},
      from: item.from ?? [],
      depth: item.depth ?? 1,
      colloq: String(item.colloq ?? "")
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s !== ""),
    });
  }
  return [...byName.values()];
}

function stripTags(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim();
}

function champions(championFull: Json): SnapshotChampion[] {
  return Object.values<Json>(championFull.data)
    .map((c) => ({
      id: c.id,
      key: Number(c.key),
      name: c.name,
      title: c.title,
      tags: c.tags,
      attackRange: c.stats.attackrange,
      abilities: [
        { slot: "P" as const, name: c.passive.name, description: c.passive.description },
        ...c.spells.map((s: Json, i: number) => ({
          slot: SPELL_SLOTS[i],
          name: s.name,
          description: s.description,
          tooltip: s.tooltip,
        })),
      ],
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
