// Puzzle Builder: the pure module that turns game data, approved labels and approved reviews into
// tiered Answer Sets and dated Puzzles. Run by maintainer scripts, never by the live app.
export * from "./types";
export { answerSetOf } from "./answer-set";
export { esportsVersion, isEsportsAnswerType } from "./esports";
export { explainPrompt, type PromptExplanation } from "./provenance";
export { bandByPrior, buildPrompt, FAMILIARITY_WEIGHT, BAND_SHARES, DEFAULT_GEM_POSITION, SCORING_CONSTANTS } from "./tiers";
export {
  generatePuzzles,
  GENERATOR_DEFAULTS,
  PROMPTS_PER_PUZZLE,
  type GenerateInput,
  type GeneratedPuzzle,
} from "./generator";
