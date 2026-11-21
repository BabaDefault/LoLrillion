/** How likely an AI classification is to be wrong: a score (higher = review sooner) and why. */
export interface Uncertainty {
  score: number;
  /** One human-readable line per signal that raised the score. */
  reasons: string[];
}

export type Ranked<T> = Uncertainty & { item: T };

/**
 * Collects signals into an `Uncertainty`: each `raise` adds its weight to the score and its reason
 * to the list, in the order raised.
 */
export function uncertaintyTally() {
  const uncertainty: Uncertainty = { score: 0, reasons: [] };
  return {
    raise(weight: number, reason: string) {
      uncertainty.score += weight;
      uncertainty.reasons.push(reason);
    },
    result: (): Uncertainty => uncertainty,
  };
}

/** Most uncertain first; equal scores keep a stable order by `key`. */
export function rankByUncertainty<T>(items: readonly Ranked<T>[], key: (item: T) => string): Ranked<T>[] {
  return [...items].sort((a, b) => b.score - a.score || key(a.item).localeCompare(key(b.item)));
}
