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
