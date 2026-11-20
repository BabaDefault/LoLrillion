import type { Tier } from "@/engine";

/** A colour family from the theme, named after the share emoji it matches. */
export type TierTone = "blue" | "clown" | "green" | "yellow" | "orange" | "gem" | "miss";

const TONES: Readonly<Record<Tier, TierTone>> = {
  minion: "blue", // 🟦
  "too-clever": "clown", // 🤡
  kill: "green", // 🟩
  "triple-kill": "yellow", // 🟨
  "quadra-kill": "orange", // 🟧
  pentakill: "gem", // 💎
};

/** The theme colour for a Tier, or for a Miss (`null`), so the UI matches the share line. */
export function tierTone(tier: Tier | null): TierTone {
  return tier ? TONES[tier] : "miss"; // ⬛
}
