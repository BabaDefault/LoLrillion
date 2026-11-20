import type { MechanicsLabel } from "./types";

/** Entity IDs that have `term`, each once, in label order. The Builder's filter for kit Templates. */
export function entitiesWithTerm(labels: readonly MechanicsLabel[], term: string): string[] {
  return [...new Set(labels.filter((l) => l.term === term).map((l) => l.entityId))];
}
