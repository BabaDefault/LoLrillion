import type { Tier } from "./types";

export const TIER_POINTS: Readonly<Record<Tier, number>> = {
  minion: 10,
  "too-clever": 15,
  kill: 30,
  "triple-kill": 60,
  "quadra-kill": 85,
  pentakill: 100,
};

export const TIER_NAMES: Readonly<Record<Tier, string>> = {
  minion: "Minion",
  "too-clever": "Too Clever",
  kill: "Kill",
  "triple-kill": "Triple Kill",
  "quadra-kill": "Quadra Kill",
  pentakill: "Pentakill",
};

/** Points for a Prompt that closed with no Accepted Guess. */
export const MISS_POINTS = 0;

/** The emoji for each Tier, as used in the score animation and the share line. */
export const TIER_EMOJI: Readonly<Record<Tier, string>> = {
  minion: "🟦",
  "too-clever": "🤡",
  kill: "🟩",
  "triple-kill": "🟨",
  "quadra-kill": "🟧",
  pentakill: "💎",
};

/** The emoji for a Prompt that closed with no Accepted Guess. */
export const MISS_EMOJI = "⬛";

export function pointsFor(tier: Tier): number {
  return TIER_POINTS[tier];
}
