// Puzzle Builder: the pure module that turns game data, approved labels and approved reviews into
// tiered Answer Sets and dated Puzzles. Run by maintainer scripts, never by the live app.
export * from "./types";
export { answerSetOf } from "./answer-set";
export { buildPrompt, FAMILIARITY_WEIGHT, BAND_SHARES } from "./tiers";
export {
  generatePuzzles,
  GENERATOR_DEFAULTS,
  PROMPTS_PER_PUZZLE,
  type GenerateInput,
  type GeneratedPuzzle,
} from "./generator";
