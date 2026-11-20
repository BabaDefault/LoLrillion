import type { GameDataSnapshot, SnapshotAbility, SnapshotChampion } from "@/content/game-data/snapshot";
import { championEntityId } from "@/content/game-data/build-registry";
import type { SourceField } from "./types";

/**
 * The text quotes are checked against: HTML-ish tags removed (`<br>` becomes a space), whitespace
 * collapsed and trimmed. `{{ var }}` placeholders are kept as-is and must be quoted verbatim.
 */
export function plainText(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The normalised text of one ability field, or undefined if the ability has no such field. */
export function abilityText(ability: SnapshotAbility, field: SourceField): string | undefined {
  const raw = ability[field];
  return raw === undefined ? undefined : plainText(raw);
}

export function findChampion(snapshot: GameDataSnapshot, entityId: string): SnapshotChampion | undefined {
  return snapshot.champions.find((c) => championEntityId(c.id) === entityId);
}
