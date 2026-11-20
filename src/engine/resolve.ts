import { normalizeGuess } from "./normalize";
import type { AnswerType, Entity, EntityId } from "./types";

/** An Entity offered in a "Did you mean" popup. */
export interface Candidate {
  id: EntityId;
  name: string;
}

/** How a Guess was read against the Entities of a Prompt's Answer Type. */
export type GuessReading =
  | { kind: "match"; entity: Entity }
  | { kind: "did-you-mean"; candidates: Candidate[] }
  | { kind: "none" };

/** Guesses this short (after normalising) never get a "Did you mean". */
const MIN_FUZZY_LENGTH = 5;

/** Edits allowed for a near-miss: one per four characters of the Guess. */
function maxDistance(length: number): number {
  return Math.floor(length / 4);
}

/** Optimal string alignment distance: insertions, deletions, substitutions and adjacent swaps. */
function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

function exactMatch(key: string, entities: readonly Entity[]): Entity | null {
  return (
    entities.find((e) => normalizeGuess(e.name) === key) ??
    entities.find((e) => e.aliases.some((a) => normalizeGuess(a) === key)) ??
    null
  );
}

function nearMisses(key: string, entities: readonly Entity[]): Candidate[] {
  if (key.length < MIN_FUZZY_LENGTH) return [];
  const limit = maxDistance(key.length);
  const scored: Array<{ entity: Entity; distance: number }> = [];
  for (const entity of entities) {
    const distance = Math.min(
      ...[entity.name, ...entity.aliases].map((n) => editDistance(key, normalizeGuess(n))),
    );
    if (distance <= limit) scored.push({ entity, distance });
  }
  return scored
    .sort((x, y) => x.distance - y.distance || x.entity.name.localeCompare(y.entity.name))
    .map(({ entity }) => ({ id: entity.id, name: entity.name }));
}

/**
 * Read a Guess against the Entities of the given Answer Type: exact canonical name first,
 * then Alias, then near-misses (length-scaled edit distance) for a "Did you mean".
 * Candidates come from every Entity of the Answer Type, never the Answer Set, so nothing leaks.
 */
export function readGuess(guess: string, answerType: AnswerType, entities: readonly Entity[]): GuessReading {
  const key = normalizeGuess(guess);
  if (key === "") return { kind: "none" };
  const ofType = entities.filter((e) => e.answerType === answerType);
  const entity = exactMatch(key, ofType);
  if (entity) return { kind: "match", entity };
  const candidates = nearMisses(key, ofType);
  if (candidates.length > 0) return { kind: "did-you-mean", candidates };
  return { kind: "none" };
}
