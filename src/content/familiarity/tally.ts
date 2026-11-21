import { championEntityId, itemEntityId } from "../game-data/build-registry";
import type { FamiliarityFile } from "./types";

/** The slice of the game-data snapshot the totals are keyed against (a `GameDataSnapshot` fits). */
export interface FamiliarityCatalog {
  /** Data Dragon version, e.g. "16.23.1". Matches are kept only if their game version is on this patch. */
  patch: string;
  champions: readonly { id: string; key: number }[];
  items: readonly { id: string }[];
}

export interface TallyInput {
  catalog: FamiliarityCatalog;
  /** Raw Champion-Mastery-V4 `by-puuid` responses, one per sampled player. */
  masteries: readonly unknown[];
  /** Raw Match-V5 match responses, already de-duplicated. */
  matches: readonly unknown[];
}

/** Inventory slots; `item6` is the trinket and is skipped. */
const INVENTORY_SLOTS = ["item0", "item1", "item2", "item3", "item4", "item5"] as const;

/**
 * Totals sampled Riot API responses into a Familiarity file. Pure; the input is untrusted JSON,
 * so anything malformed is skipped rather than thrown on. Nothing identifying is carried over.
 */
export function tallyFamiliarity({ catalog, masteries, matches }: TallyInput): FamiliarityFile {
  const championByKey = new Map(catalog.champions.map((c) => [c.key, c.id]));
  const knownItems = new Set(catalog.items.map((i) => i.id));
  const gamePatch = catalog.patch.split(".").slice(0, 2).join(".") + ".";

  const masteryPoints = new Map<string, number>();
  let totalPoints = 0;
  let players = 0;
  for (const response of masteries) {
    if (!Array.isArray(response)) continue;
    players++;
    for (const entry of response) {
      const champion = championByKey.get(num(entry?.championId));
      const points = num(entry?.championPoints);
      if (!champion || points <= 0) continue;
      masteryPoints.set(champion, (masteryPoints.get(champion) ?? 0) + points);
      totalPoints += points;
    }
  }

  const picks = new Map<string, number>();
  const builds = new Map<string, number>();
  let matchCount = 0;
  let participantCount = 0;
  for (const match of matches) {
    const info = (match as any)?.info;
    const version = info?.gameVersion;
    if (typeof version !== "string" || !version.startsWith(gamePatch)) continue;
    if (!Array.isArray(info.participants)) continue;
    matchCount++;
    const championsInMatch = new Set<string>();
    for (const participant of info.participants) {
      participantCount++;
      const champion = championByKey.get(num(participant?.championId));
      if (champion) championsInMatch.add(champion);
      const held = new Set<string>();
      for (const slot of INVENTORY_SLOTS) {
        const id = String(num(participant?.[slot]));
        if (knownItems.has(id)) held.add(id);
      }
      for (const id of held) builds.set(id, (builds.get(id) ?? 0) + 1);
    }
    for (const champion of championsInMatch) picks.set(champion, (picks.get(champion) ?? 0) + 1);
  }

  const share = (count: number | undefined, total: number) => (total > 0 ? (count ?? 0) / total : 0);
  const champions: FamiliarityFile["champions"] = {};
  for (const { id } of catalog.champions) {
    champions[championEntityId(id)] = {
      mastery: share(masteryPoints.get(id), totalPoints),
      pickRate: share(picks.get(id), matchCount),
    };
  }
  const items: FamiliarityFile["items"] = {};
  for (const { id } of catalog.items) {
    items[itemEntityId(id)] = { buildRate: share(builds.get(id), participantCount) };
  }

  return { patch: catalog.patch, champions, items, sample: { players, matches: matchCount } };
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
