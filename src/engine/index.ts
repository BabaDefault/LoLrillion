// Game Engine: the pure, I/O-free module that owns all gameplay rules.
export { normalizeGuess } from "./normalize";
export * from "./types";
export { TIER_POINTS, TIER_NAMES, MISS_POINTS } from "./scoring";
export {
  READ_WINDOW_MS,
  ANSWER_WINDOW_MS,
  NETWORK_GRACE_MS,
  openPrompt,
  promptOutcome,
  promptWindow,
  submitAttempt,
  type PromptOutcome,
  type AttemptInput,
  type AttemptResult,
  type AcceptedResult,
  type RejectedResult,
  type RejectionReason,
  type PromptPlay,
} from "./play";
export { puzzleProgress, type PuzzleProgress, type PromptProgress } from "./progress";
export { dayTitle, type DayTitle } from "./results";
