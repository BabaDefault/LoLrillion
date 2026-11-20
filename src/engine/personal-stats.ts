import { TIER_POINTS } from "./scoring";
import type { Tier } from "./types";

/** One finished game: each Prompt's Tier, or null for a Miss. */
export interface FinishedGame {
  puzzleDay: string;
  results: ReadonlyArray<Tier | null>;
}

export interface PersonalStats {
  gamesPlayed: number;
  /** Mean daily total; null before any finished game. */
  averageScore: number | null;
  /** How many Prompts ended in each Tier, plus Misses. */
  tierCounts: Record<Tier | "miss", number>;
  /** Pentakills: the Gem found. */
  gemsFound: number;
  /** The highest daily total (the earliest such day on a tie); null before any finished game. */
  bestDay: { puzzleDay: string; total: number } | null;
}

/** A player's stats across their finished games. */
export function personalStats(games: readonly FinishedGame[]): PersonalStats {
  const tierCounts: Record<Tier | "miss", number> = {
    minion: 0,
    "too-clever": 0,
    kill: 0,
    "triple-kill": 0,
    "quadra-kill": 0,
    pentakill: 0,
    miss: 0,
  };
  let sum = 0;
  let bestDay: PersonalStats["bestDay"] = null;
  for (const game of games) {
    let total = 0;
    for (const tier of game.results) {
      tierCounts[tier ?? "miss"]++;
      if (tier) total += TIER_POINTS[tier];
    }
    sum += total;
    if (
      !bestDay ||
      total > bestDay.total ||
      (total === bestDay.total && game.puzzleDay < bestDay.puzzleDay)
    ) {
      bestDay = { puzzleDay: game.puzzleDay, total };
    }
  }
  return {
    gamesPlayed: games.length,
    averageScore: games.length > 0 ? sum / games.length : null,
    tierCounts,
    gemsFound: tierCounts.pentakill,
    bestDay,
  };
}
