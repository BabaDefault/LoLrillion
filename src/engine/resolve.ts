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
  /** The Guess exactly names an Entity of a different Answer Type. */
  | { kind: "wrong-answer-type" }
  | { kind: "none" };

/** Guesses and names this short (after normalising) never take part in a "Did you mean". */
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
    const names = [entity.name, ...entity.aliases]
      .map(normalizeGuess)
      .filter((n) => n.length >= MIN_FUZZY_LENGTH);
    if (names.length === 0) continue;
    const distance = Math.min(...names.map((n) => editDistance(key, n)));
    if (distance <= limit) scored.push({ entity, distance });
  }
  return scored
    .sort((x, y) => x.distance - y.distance || x.entity.name.localeCompare(y.entity.name))
    .map(({ entity }) => ({ id: entity.id, name: entity.name }));
}

/** Skin line abbreviations players type inside skin Guesses ("SG Lux"). */
export const SKIN_LINE_ABBREVIATIONS: Readonly<Record<string, string>> = {
  SG: "Star Guardian",
  SB: "Spirit Blossom",
  PP: "Pool Party",
};

/** Normalized short form → normalized long forms it may stand for, inside a skin Guess. */
function skinExpansions(entities: readonly Entity[]): Map<string, Set<string>> {
  const expansions = new Map<string, Set<string>>();
  const add = (short: string, long: string) => {
    const from = normalizeGuess(short);
    const to = normalizeGuess(long);
    if (from === "" || from === to) return;
    if (!expansions.has(from)) expansions.set(from, new Set());
    expansions.get(from)!.add(to);
  };
  for (const [short, line] of Object.entries(SKIN_LINE_ABBREVIATIONS)) add(short, line);
  for (const champion of entities) {
    if (champion.answerType !== "champion") continue;
    for (const alias of champion.aliases) add(alias, champion.name);
  }
  return expansions;
}

/**
 * Every normalized reading of a Guess with at least one run of words swapped for what it abbreviates:
 * a champion's whole-name Alias for the champion's name, a skin line abbreviation for the skin line.
 */
function expandedKeys(guess: string, expansions: Map<string, Set<string>>): Set<string> {
  const words = guess.split(/[^\p{L}\p{N}\p{M}]+/u).map(normalizeGuess).filter((w) => w !== "");
  const out = new Set<string>();
  const walk = (i: number, built: string, expanded: boolean) => {
    if (i === words.length) {
      if (expanded) out.add(built);
      return;
    }
    walk(i + 1, built + words[i], expanded);
    let span = "";
    for (let j = i; j < words.length; j++) {
      span += words[j];
      for (const long of expansions.get(span) ?? []) walk(j + 1, built + long, true);
    }
  };
  walk(0, "", false);
  return out;
}

/** Skins whose name or Alias exactly equals an expanded reading of the Guess. */
function skinsByExpansion(guess: string, entities: readonly Entity[], skins: readonly Entity[]): Entity[] {
  const keys = expandedKeys(guess, skinExpansions(entities));
  if (keys.size === 0) return [];
  return skins.filter((s) => [s.name, ...s.aliases].some((n) => keys.has(normalizeGuess(n))));
}

/**
 * Read a Guess against the Entities of the given Answer Type: exact canonical name first,
 * then Alias, then (SKIN only) an exact match after expanding champion nicknames and skin line
 * abbreviations, then near-misses (length-scaled edit distance) for a "Did you mean", then an exact
 * name/Alias of another Answer Type.
 * An expansion that matches several skins is never Accepted: they are all offered in a "Did you mean".
 * Candidates come from every Entity of the Answer Type, never the Answer Set, so nothing leaks.
 */
export function readGuess(guess: string, answerType: AnswerType, entities: readonly Entity[]): GuessReading {
  const key = normalizeGuess(guess);
  if (key === "") return { kind: "none" };
  const ofType = entities.filter((e) => e.answerType === answerType);
  const entity = exactMatch(key, ofType);
  if (entity) return { kind: "match", entity };
  if (answerType === "skin") {
    const expanded = skinsByExpansion(guess, entities, ofType);
    if (expanded.length === 1) return { kind: "match", entity: expanded[0] };
    if (expanded.length > 1) {
      const candidates = [...expanded]
        .sort((x, y) => x.name.localeCompare(y.name))
        .map((e) => ({ id: e.id, name: e.name }));
      return { kind: "did-you-mean", candidates };
    }
  }
  // A near-miss of the asked-for type wins over an exact name of another type: "Knight" on an item
  // Prompt is more likely Knight's Vow than the pro player Knight.
  const candidates = nearMisses(key, ofType);
  if (candidates.length > 0) return { kind: "did-you-mean", candidates };
  if (exactMatch(key, entities.filter((e) => e.answerType !== answerType))) {
    return { kind: "wrong-answer-type" };
  }
  return { kind: "none" };
}
