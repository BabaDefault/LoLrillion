// Template reviews (#10): the `/review-template` proposal format, approved review files, the review
// queue (Answer Set diff) and the Answer Share report. Pure; maintainer scripts do the file I/O.
export * from "./types";
export { reviewQueue } from "./queue";
export { checkProposal, GEM_CANDIDATES } from "./proposal";
export { approveProposal, checkApprovedReview, GEM_MAX_TYPICALITY } from "./approve";
export { puzzleTemplates, type PuzzleTemplateOptions } from "./eligible";
export { answerShareReport, type TemplateAnswerShare } from "./answer-share";
export { unmatchedGuessReport, type LoggedAttempt, type TemplateUnmatchedGuesses, type UnmatchedGuess } from "./unmatched-guesses";
