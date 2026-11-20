import type { ApprovedReview } from "./types";

export interface PuzzleTemplateOptions {
  /** Also use Templates with no approved review (Builder defaults). Off unless explicitly asked for. */
  includeUnreviewed?: boolean;
}

/**
 * The Templates new Puzzles may draw from: only those with an approved review, unless unreviewed
 * ones are explicitly included. Keeps the given order.
 */
export function puzzleTemplates<T extends { id: string }>(
  templates: readonly T[],
  reviews: Readonly<Record<string, ApprovedReview>>,
  { includeUnreviewed = false }: PuzzleTemplateOptions = {},
): T[] {
  return includeUnreviewed ? [...templates] : templates.filter((t) => Object.hasOwn(reviews, t.id));
}
