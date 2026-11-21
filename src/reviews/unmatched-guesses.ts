import type { GeneratedPuzzle } from "@/builder";
import { normalizeGuess, type AnswerType, type Entity, type EntityId, type RejectionReason } from "@/engine";

/** An `attempts` row, as far as the unmatched Guess report reads it. */
export interface LoggedAttempt {
  playerId: string;
  puzzleDay: string;
  promptIndex: number;
  /** The typed Guess; null for a confirmed "Did you mean" logged without it. */
  guess: string | null;
  result: string;
  reason: string | null;
  confirmedEntityId: string | null;
}

/** One normalized Guess that players had Rejected on a Template. */
export interface UnmatchedGuess {
  /** The Guess after the engine's normalization: the grouping key. */
  normalized: string;
  /** Distinct typed forms, in the order first seen. */
  spellings: string[];
  count: number;
  /** Distinct players who made it. */
  players: number;
  /**
   * The Entity of the Prompt's Answer Type this Guess names today (by name or Alias), if any: then
   * it's a likely missing answer or a disputable Rule. Null: a likely missing Alias or a typo.
   */
  entity: { id: EntityId; name: string } | null;
}

/** One Template's Rejected Guesses over every Puzzle Day it was played. */
export interface TemplateUnmatchedGuesses {
  templateId: string;
  /** Prompt text from the latest Puzzle. */
  prompt: string;
  answerType: AnswerType;
  /** Puzzle Days with at least one Rejected Guess on the Template. */
  days: string[];
  /** Most frequent first. */
  guesses: UnmatchedGuess[];
}

/** Rejection reasons that say something about the answers, not about timing. */
const ANSWER_REJECTIONS: ReadonlySet<string> = new Set<RejectionReason>(["no-match", "not-in-answer-set"]);

type Tally = { normalized: string; spellings: string[]; count: number; players: Set<string>; entity: Entity | null };

/** The Entity of `answerType` a normalized Guess names exactly, by name first, then by Alias. */
function namedEntity(normalized: string, answerType: AnswerType, entities: readonly Entity[]): Entity | null {
  const ofType = entities.filter((e) => e.answerType === answerType);
  return (
    ofType.find((e) => normalizeGuess(e.name) === normalized) ??
    ofType.find((e) => e.aliases.some((a) => normalizeGuess(a) === normalized)) ??
    null
  );
}

/**
 * Rejected Guesses per Template, grouped by normalized text. Only answer problems count: a Guess
 * that matched no Entity (`no-match`) or an Entity outside the Answer Set (`not-in-answer-set`).
 * Did-you-mean / wrong-answer-type results, closed windows and locked Prompts are left out, as are
 * Attempts on days with no dated Puzzle. Sorted by Template ID.
 */
export function unmatchedGuessReport(
  puzzles: readonly GeneratedPuzzle[],
  entities: readonly Entity[],
  attempts: readonly LoggedAttempt[],
): TemplateUnmatchedGuesses[] {
  const byDay = new Map(puzzles.map((p) => [p.puzzleDay, p]));
  const byTemplate = new Map<string, { prompt: string; answerType: AnswerType; days: Set<string>; tallies: Map<string, Tally> }>();

  for (const attempt of attempts) {
    if (attempt.result !== "rejected" || !ANSWER_REJECTIONS.has(attempt.reason ?? "")) continue;
    const prompt = byDay.get(attempt.puzzleDay)?.prompts[attempt.promptIndex];
    if (!prompt) continue;
    const confirmed = entities.find((e) => e.id === attempt.confirmedEntityId && e.answerType === prompt.answerType) ?? null;
    const text = attempt.guess ?? confirmed?.name;
    if (text === undefined) continue;
    const entry = byTemplate.get(prompt.templateId) ?? {
      prompt: prompt.text,
      answerType: prompt.answerType,
      days: new Set<string>(),
      tallies: new Map<string, Tally>(),
    };
    byTemplate.set(prompt.templateId, entry);
    entry.days.add(attempt.puzzleDay);
    const normalized = normalizeGuess(text);
    const tally = entry.tallies.get(normalized) ?? {
      normalized,
      spellings: [],
      count: 0,
      players: new Set<string>(),
      entity: namedEntity(normalized, prompt.answerType, entities),
    };
    tally.entity ??= confirmed;
    entry.tallies.set(normalized, tally);
    tally.count++;
    tally.players.add(attempt.playerId);
    if (!tally.spellings.includes(text)) tally.spellings.push(text);
  }

  return [...byTemplate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([templateId, { prompt, answerType, days, tallies }]) => ({
      templateId,
      prompt,
      answerType,
      days: [...days].sort(),
      guesses: [...tallies.values()]
        .map((t) => ({
          normalized: t.normalized,
          spellings: t.spellings,
          count: t.count,
          players: t.players.size,
          entity: t.entity && { id: t.entity.id, name: t.entity.name },
        }))
        .sort((a, b) => b.count - a.count || b.players - a.players || a.normalized.localeCompare(b.normalized)),
    }));
}
