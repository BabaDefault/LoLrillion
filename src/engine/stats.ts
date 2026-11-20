export interface DistributionBin {
  /** Inclusive lower bound. */
  from: number;
  /** Exclusive upper bound (inclusive for the last bin). */
  to: number;
  count: number;
}

export interface ScoreDistribution {
  bins: DistributionBin[];
  /** Index of the bin holding the player's own total. */
  yourBin: number;
}

/**
 * The day's score-distribution curve: `dayTotals` counted into `binCount` equal-width bins
 * spanning 0..maxTotal, with the player's own position marked.
 */
export function scoreDistribution(
  dayTotals: readonly number[],
  { maxTotal, binCount }: { maxTotal: number; binCount: number },
  yourTotal: number,
): ScoreDistribution {
  const width = maxTotal / binCount;
  const binOf = (total: number) => Math.min(binCount - 1, Math.max(0, Math.floor(total / width)));
  const bins: DistributionBin[] = Array.from({ length: binCount }, (_, i) => ({
    from: i * width,
    to: (i + 1) * width,
    count: 0,
  }));
  for (const total of dayTotals) bins[binOf(total)].count++;
  return { bins, yourBin: binOf(yourTotal) };
}

/**
 * "Better than X% of today's players": the share of the other players' daily totals that are
 * strictly below `total`, as a whole percentage rounded down.
 * `dayTotals` is every player's total for the Puzzle Day, including this player's own.
 */
export function percentileBetterThan(total: number, dayTotals: readonly number[]): number {
  const others = dayTotals.length - 1;
  if (others <= 0) return 0;
  const below = dayTotals.filter((t) => t < total).length;
  return Math.floor((below / others) * 100);
}
