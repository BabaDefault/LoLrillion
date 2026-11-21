/**
 * The trimmed copy of Riot game data (Data Dragon + Community Dragon) for one patch, as saved by
 * `scripts/fetch-game-data.ts`. Only the fields later stages need are kept.
 */
export interface GameDataSnapshot {
  /** Data Dragon version, e.g. "16.23.1" (the in-game patch is "16.23"). */
  patch: string;
  champions: SnapshotChampion[];
  /** Only items currently purchasable in the Summoner's Rift shop, one per name. */
  items: SnapshotItem[];
  /** Real skins only: no base skins, no chromas, no legacy-model "Classic X" variants. */
  skins: SnapshotSkin[];
  skinLines: SnapshotSkinLine[];
  universes: SnapshotUniverse[];
}

export interface SnapshotChampion {
  /** Data Dragon `id`, e.g. "MonkeyKing". */
  id: string;
  /** Numeric champion key, e.g. 62 (Riot API / Community Dragon id). */
  key: number;
  name: string;
  title: string;
  /** Class tags, e.g. ["Fighter", "Tank"]. */
  tags: string[];
  attackRange: number;
  /** Passive then Q, W, E, R. */
  abilities: SnapshotAbility[];
}

export type AbilitySlot = "P" | "Q" | "W" | "E" | "R";

export interface SnapshotAbility {
  slot: AbilitySlot;
  name: string;
  /** Short plain summary from Data Dragon. */
  description: string;
  /** Data Dragon tooltip: HTML-ish tags and unresolved `{{ var }}` placeholders. Absent for passives. */
  tooltip?: string;
}

export interface SnapshotItem {
  /** Riot item id, e.g. "3031". */
  id: string;
  name: string;
  plaintext: string;
  /** Data Dragon description (HTML-ish tags kept). */
  description: string;
  tags: string[];
  goldTotal: number;
  stats: Record<string, number>;
  /** Component item ids. */
  from: string[];
  depth: number;
  /** Data Dragon `colloq` nicknames, split (e.g. ["ie"]). Noisy; used as Alias seeds only. */
  colloq: string[];
}

export interface SnapshotSkin {
  /** Riot skin id: champion key * 1000 + skin number, e.g. 62001. */
  id: number;
  name: string;
  /** Data Dragon champion id, e.g. "MonkeyKing". */
  championId: string;
  skinLineIds: number[];
  /** Community Dragon rarity, e.g. "kEpic", "kNoRarity". */
  rarity: string;
  isLegacy: boolean;
}

export interface SnapshotSkinLine {
  id: number;
  name: string;
}

export interface SnapshotUniverse {
  id: number;
  name: string;
  skinLineIds: number[];
}
