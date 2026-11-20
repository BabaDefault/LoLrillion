import { normalizeGuess } from "./normalize";
import type { AnswerType, Entity } from "./types";

/**
 * Find the Entity a Guess is read as (its Match), among Entities of the given Answer Type:
 * exact canonical name first, then Alias. Returns null when neither matches.
 *
 * Later: fuzzy "Did you mean" and wrong-Answer-Type detection slot in after these two steps.
 */
export function matchGuess(
  guess: string,
  answerType: AnswerType,
  entities: readonly Entity[],
): Entity | null {
  const key = normalizeGuess(guess);
  if (key === "") return null;
  const candidates = entities.filter((e) => e.answerType === answerType);
  return (
    candidates.find((e) => normalizeGuess(e.name) === key) ??
    candidates.find((e) => e.aliases.some((a) => normalizeGuess(a) === key)) ??
    null
  );
}
