import type { AttemptResult, EntityId, PromptPlay } from "@/engine";

/** Identifies one player's run at one Puzzle Day. */
export interface PlayKey {
  deviceId: string;
  puzzleDay: string;
}

export interface AttemptLogEntry extends PlayKey {
  promptIndex: number;
  guess: string;
  result: AttemptResult;
  at: number;
}

/**
 * Runtime state for plays. The in-memory implementation is for local dev and tests;
 * a Supabase implementation replaces it without changing the Game Engine or routes.
 */
export interface PlayStore {
  /** The player's PromptPlays for the day, indexed by Prompt index (null = not started). */
  getPromptPlays(key: PlayKey, promptCount: number): Promise<Array<PromptPlay | null>>;
  /**
   * Record a newly started PromptPlay, unless one already exists for that Prompt.
   * Returns the stored play, so a reload or a double click never resets the timer.
   */
  createPromptPlay(key: PlayKey, promptIndex: number, play: PromptPlay): Promise<PromptPlay>;
  /** Replace the PromptPlay for a Prompt (e.g. after an Accepted Guess). */
  updatePromptPlay(key: PlayKey, promptIndex: number, play: PromptPlay): Promise<void>;
  /**
   * Remember Entity IDs offered in a "Did you mean" popup for a Prompt, adding to any offered
   * before, so a later confirmation can be checked against them.
   */
  addOfferedCandidates(key: PlayKey, promptIndex: number, entityIds: readonly EntityId[]): Promise<void>;
  /** Every Entity ID offered as a "Did you mean" candidate for a Prompt (empty if none). */
  getOfferedCandidates(key: PlayKey, promptIndex: number): Promise<EntityId[]>;
  /** Log an Attempt and its result, for finding missing answers and Aliases. */
  logAttempt(entry: AttemptLogEntry): Promise<void>;
}
