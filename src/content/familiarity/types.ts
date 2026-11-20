import type { EntityId } from "@/engine";

/**
 * One patch's Familiarity, as written to `src/content/familiarity/<patch>.json` by
 * `scripts/fetch-familiarity.ts`. Only anonymous totals: no PUUIDs, match IDs or per-player data.
 */
export interface FamiliarityFile {
  /** Data Dragon version of the game-data snapshot the totals were keyed against, e.g. "16.23.1". */
  patch: string;
  /**
   * `mastery`: the champion's share (0..1) of all lifetime Champion Mastery points summed over the
   * sampled players. `pickRate`: share (0..1) of sampled current-patch matches the champion was in.
   */
  champions: Record<EntityId, { mastery: number; pickRate: number }>;
  /** `buildRate`: share (0..1) of sampled players who finished a match holding the item (trinket slot excluded). */
  items: Record<EntityId, { buildRate: number }>;
  /** Sample size, for judging how much to trust the totals. */
  sample?: FamiliaritySample;
}

export interface FamiliaritySample {
  players: number;
  matches: number;
  /** Players sampled per `<platform>/<tier>` bucket. */
  buckets?: Record<string, number>;
}
