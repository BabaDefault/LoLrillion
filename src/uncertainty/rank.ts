/** How likely an AI classification is to be wrong: a score (higher = review sooner) and why. */
export interface Uncertainty {
  score: number;
  /** One human-readable line per signal that raised the score. */
  reasons: string[];
}

export type Ranked<T> = Uncertainty & { item: T };

/** Most uncertain first; equal scores keep a stable order by `key`. */
export function rankByUncertainty<T>(items: readonly Ranked<T>[], key: (item: T) => string): Ranked<T>[] {
  return [...items].sort((a, b) => b.score - a.score || key(a.item).localeCompare(key(b.item)));
}
