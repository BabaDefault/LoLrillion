import { MISS_EMOJI, MISS_POINTS, TIER_EMOJI, TIER_POINTS } from "./scoring";
import type { Tier } from "./types";

/** The ranked-style title for a day's total (out of 700). */
export type DayTitle = "Iron" | "Silver" | "Gold" | "Diamond" | "Challenger";

const DAY_TITLE_BANDS: ReadonlyArray<{ min: number; title: DayTitle }> = [
  { min: 450, title: "Challenger" },
  { min: 351, title: "Diamond" },
  { min: 251, title: "Gold" },
  { min: 151, title: "Silver" },
];

export function dayTitle(total: number): DayTitle {
  return DAY_TITLE_BANDS.find((band) => total >= band.min)?.title ?? "Iron";
}

export interface ShareLineInput {
  /** The Puzzle's number (`LoLrillion #N`). */
  puzzleNumber: number;
  /** Each Prompt's Accepted Tier, in order; null for a Miss. */
  results: ReadonlyArray<Tier | null>;
  /** Optional link to the game, on its own line. */
  link?: string;
}

/** The spoiler-free share text: Puzzle number, total, day title, one Tier emoji per Prompt. */
export function shareLine({ puzzleNumber, results, link }: ShareLineInput): string {
  const total = results.reduce((sum, tier) => sum + (tier ? TIER_POINTS[tier] : MISS_POINTS), 0);
  const max = results.length * TIER_POINTS.pentakill;
  const emojis = results.map((tier) => (tier ? TIER_EMOJI[tier] : MISS_EMOJI)).join("");
  const lines = [`LoLrillion #${puzzleNumber} · ${total}/${max} · ${dayTitle(total)}`, emojis];
  if (link) lines.push(link);
  return lines.join("\n");
}
