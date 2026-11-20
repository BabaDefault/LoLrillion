import type { AttemptResult, EntityId, PromptPlay } from "@/engine";
import type { AnswerCountSource, AnswerCounts } from "./answer-counts";

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

/** One stored PromptPlay of a device, as listed for personal stats. */
export interface DevicePlay {
  puzzleDay: string;
  archive: boolean;
  promptIndex: number;
  play: PromptPlay;
}

/**
 * Runtime state for plays. The in-memory implementation is for local dev and tests;
 * a Supabase implementation replaces it without changing the Game Engine or routes.
 */
export interface PlayStore extends AnswerCountSource {
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
  /**
   * Answer Share counts (from AnswerCountSource): per Prompt, how many players' Accepted Guess
   * was each Entity, and how many players played today. Archive plays are not counted.
   */
  getAnswerCounts(puzzleDay: string, promptCount: number): Promise<AnswerCounts>;
  /**
   * Every player's daily total for a Puzzle Day (sum of Accepted Points), for percentile and
   * the distribution curve. Only counted (non-archive) runs finished at `now` are included:
   * every one of the `promptCount` Prompts either Accepted or its answer window (plus grace) closed.
   */
  getDayTotals(puzzleDay: string, promptCount: number, now: number): Promise<number[]>;
  /** Every PromptPlay a device has started, live and archive, on any day (personal stats). */
  getDevicePlays(deviceId: string): Promise<DevicePlay[]>;
}
