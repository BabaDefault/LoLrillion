import type { AttemptResult, EntityId, PromptPlay } from "@/engine";

/** Identifies one player's run at one Puzzle Day. */
export interface PlayKey {
  deviceId: string;
  puzzleDay: string;
  /**
   * An archive play: a past Puzzle replayed after its day. Kept apart from the counted play
   * and excluded from Answer Share, percentiles and leaderboards. Defaults to false.
   */
  archive?: boolean;
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
  /** Log an Attempt and its result, for finding missing answers and Aliases. */
  logAttempt(entry: AttemptLogEntry): Promise<void>;
  /**
   * Answer Share counts: for one Prompt of a Puzzle Day, how many players' Accepted Guess
   * was each Entity. Archive plays are not counted.
   */
  getAnswerCounts(puzzleDay: string, promptIndex: number): Promise<Record<EntityId, number>>;
  /**
   * Every player's daily total for a Puzzle Day (sum of Accepted Points), for percentile and
   * the distribution curve. Only counted (non-archive) runs that have started all
   * `promptCount` Prompts are included.
   */
  getDayTotals(puzzleDay: string, promptCount: number): Promise<number[]>;
}
