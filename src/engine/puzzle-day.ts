/** Puzzle Days are calendar dates in Sydney time, following daylight saving. */
export const PUZZLE_TIME_ZONE = "Australia/Sydney";

const sydneyDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: PUZZLE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Puzzle Day (`YYYY-MM-DD` in Sydney) that a moment (epoch ms) falls on. */
export function puzzleDayOf(now: number): string {
  const parts = Object.fromEntries(sydneyDate.formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const MS_PER_DAY = 86_400_000;

/** Calendar days from one `YYYY-MM-DD` date to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}

/** The `YYYY-MM-DD` date `days` calendar days after `day`. */
export function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** `LoLrillion #N`: the first Puzzle Day is #1 and each calendar day after adds one. */
export function puzzleNumberOf(puzzleDay: string, firstPuzzleDay: string): number {
  return daysBetween(firstPuzzleDay, puzzleDay) + 1;
}
