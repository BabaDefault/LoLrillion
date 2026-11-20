import type { DayScore } from "@/leaderboard";

/** A friend group: a private leaderboard that players join by its short code. */
export interface GroupInfo {
  code: string;
  name: string;
}

/**
 * Players (nicknames), friend groups and the per-player totals leaderboards rank. Players are
 * identified by their anonymous device ID, which never leaves the server.
 */
export interface PlayerStore {
  /** The device's nickname, or null if it hasn't picked one. */
  getNickname(deviceId: string): Promise<string | null>;
  /** Set or change the device's nickname. */
  setNickname(deviceId: string, nickname: string): Promise<void>;
  /** Create a group with the device as its first member. False (and nothing created) if the code is taken. */
  createGroup(deviceId: string, group: GroupInfo): Promise<boolean>;
  /** Add the device to the group with this code (joining twice is harmless); null if there's no such group. */
  joinGroup(deviceId: string, code: string): Promise<GroupInfo | null>;
  /** The groups the device belongs to, oldest membership first. */
  getGroups(deviceId: string): Promise<GroupInfo[]>;
  /**
   * Each player's total for a Puzzle Day, for leaderboards: counted (non-archive) runs that have
   * started all `promptCount` Prompts, optionally only members of one group. `playerKey` is the
   * device ID.
   */
  getDayScores(puzzleDay: string, promptCount: number, groupCode?: string): Promise<DayScore[]>;
}
