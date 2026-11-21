import type { GameDataSnapshot, SnapshotChampion } from "@/content/game-data/snapshot";
import { championEntityId } from "@/content/game-data/build-registry";

/**
 * What the labels were last checked against: one fingerprint of each champion's ability text.
 * Stored in `src/content/labels/tagged.json` and refreshed after each `/tag-patch` run.
 */
export interface TaggedBaseline {
  /** Patch of the snapshot the labels were last checked against; null before the first run. */
  patch: string | null;
  fingerprints: Record<string, string>;
}

/** A hash of all a champion's ability names and text; changes when any of it changes. */
function fingerprint(champion: SnapshotChampion): string {
  const text = champion.abilities
    .map((a) => [a.slot, a.name, a.description, a.tooltip ?? ""].join("␟"))
    .join("␞");
  // 64-bit FNV-1a: plenty for spotting edits, and no Node-only imports.
  let hash = 0xcbf29ce484222325n;
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i));
    hash = (hash * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, "0");
}

export function taggedBaseline(snapshot: GameDataSnapshot): TaggedBaseline {
  return {
    patch: snapshot.patch,
    fingerprints: Object.fromEntries(snapshot.champions.map((c) => [championEntityId(c.id), fingerprint(c)])),
  };
}

/** Entity IDs of champions whose ability text differs from the baseline (or that are new). */
export function changedChampions(snapshot: GameDataSnapshot, baseline: TaggedBaseline): string[] {
  return snapshot.champions
    .filter((c) => baseline.fingerprints[championEntityId(c.id)] !== fingerprint(c))
    .map((c) => championEntityId(c.id));
}
