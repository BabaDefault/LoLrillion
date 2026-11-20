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

export function pointsFor(tier: Tier): number {
  return TIER_POINTS[tier];
}
