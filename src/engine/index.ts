// Game Engine: the pure, I/O-free module that owns all gameplay rules.
export { normalizeGuess } from "./normalize";
export * from "./types";
export { TIER_POINTS, TIER_NAMES, MISS_POINTS } from "./scoring";
export {
  READ_WINDOW_MS,
  openPrompt,
  submitAttempt,
  type AttemptInput,
  type AttemptResult,
  type AcceptedResult,
  type RejectedResult,
  type PromptPlay,
} from "./play";
