import { dayTitle, parsePuzzleDay, puzzleDayOf, type DayTitle } from "@/engine";
import {
  generateGroupCode,
  leaderboardPhase,
  parseGroupCode,
  rankLeaderboard,
  validateGroupName,
  validateNickname,
  type RankedEntry,
} from "@/leaderboard";
import type { Clock } from "./clock";
import type { PuzzleSource } from "./puzzle-source";
import type { GroupInfo, PlayerStore } from "./storage/player-store";

export interface ProfileView {
  nickname: string | null;
  groups: GroupInfo[];
}

export type NicknameResponse = { ok: true; nickname: string } | { ok: false; error: "empty" | "too-long" };

export type CreateGroupResponse =
  | { ok: true; group: GroupInfo }
  | { ok: false; error: "nickname-required" | "empty" | "too-long" | "no-free-code" };

export type JoinGroupResponse =
  | { ok: true; group: GroupInfo }
  | { ok: false; error: "nickname-required" | "invalid-code" | "no-such-group" };

export interface LeaderboardServiceDeps {
  clock: Clock;
  puzzles: PuzzleSource;
  players: PlayerStore;
  /** Randomness for group codes, like Math.random (the default). */
  random?: () => number;
}

/** Nicknames, friend groups and the global and group leaderboards. */
export interface LeaderboardService {
  getProfile(deviceId: string): Promise<ProfileView>;
  setNickname(deviceId: string, typed: string): Promise<NicknameResponse>;
  /** Create a group (the creator joins it) with a fresh short code. Needs a nickname first. */
  createGroup(deviceId: string, typedName: string): Promise<CreateGroupResponse>;
  /** Join a group by its code, typed in any case or spacing. Needs a nickname first. */
  joinGroup(deviceId: string, typedCode: string): Promise<JoinGroupResponse>;
  /**
   * A Puzzle Day's leaderboard (today's when no day is given): global, or a group's for its
   * members. Past days are final; archive plays never count.
   */
  getLeaderboard(deviceId: string, query: LeaderboardQuery): Promise<LeaderboardResponse>;
}

export interface LeaderboardQuery {
  /** `YYYY-MM-DD` Puzzle Day; today's when omitted. */
  day?: string;
  /** A group code, for that group's leaderboard; global when omitted. */
  group?: string;
}

export type LeaderboardScope = { kind: "global" } | { kind: "group"; group: GroupInfo };

/** One row of a leaderboard. Never carries the player's device ID. */
export interface LeaderboardEntryView {
  rank: number;
  /** Null for a player who hasn't picked a nickname. */
  nickname: string | null;
  total: number;
  dayTitle: DayTitle;
  /** True for the player asking. */
  you: boolean;
}

export interface LeaderboardView {
  puzzleDay: string;
  puzzleNumber: number;
  /** "live" during the Puzzle Day, "final" (frozen) once it has passed. */
  phase: "live" | "final";
  scope: LeaderboardScope;
  /** Players who finished the day's Puzzle (in this scope). */
  playerCount: number;
  /** The top of the leaderboard, best first. */
  entries: LeaderboardEntryView[];
  /** The asking player's own row, even if outside the top; null until they finish. */
  you: LeaderboardEntryView | null;
}

export type LeaderboardResponse =
  | { ok: true; leaderboard: LeaderboardView }
  | { ok: false; error: "invalid-day" | "future-day" | "not-a-member" };

/** Rows shown at the top of a leaderboard. */
export const LEADERBOARD_SIZE = 100;

/** New codes to try before giving up when each one is already taken. */
const CODE_ATTEMPTS = 8;

export function createLeaderboardService({
  clock,
  puzzles,
  players,
  random = Math.random,
}: LeaderboardServiceDeps): LeaderboardService {
  return {
    async getProfile(deviceId) {
      const [nickname, groups] = await Promise.all([players.getNickname(deviceId), players.getGroups(deviceId)]);
      return { nickname, groups };
    },

    async setNickname(deviceId, typed) {
      const check = validateNickname(typed);
      if (!check.ok) return check;
      await players.setNickname(deviceId, check.value);
      return { ok: true, nickname: check.value };
    },

    async createGroup(deviceId, typedName) {
      if (!(await players.getNickname(deviceId))) return { ok: false, error: "nickname-required" };
      const name = validateGroupName(typedName);
      if (!name.ok) return name;
      for (let i = 0; i < CODE_ATTEMPTS; i++) {
        const group = { code: generateGroupCode(random), name: name.value };
        if (await players.createGroup(deviceId, group)) return { ok: true, group };
      }
      return { ok: false, error: "no-free-code" };
    },

    async getLeaderboard(deviceId, { day, group }) {
      const now = clock.now();
      const today = puzzleDayOf(now);
      const puzzleDay = day === undefined ? today : parsePuzzleDay(day);
      if (puzzleDay === null) return { ok: false, error: "invalid-day" };
      const phase = leaderboardPhase(puzzleDay, today);
      if (phase === "future") return { ok: false, error: "future-day" };

      let scope: LeaderboardScope = { kind: "global" };
      if (group !== undefined) {
        const code = parseGroupCode(group);
        const mine = code ? (await players.getGroups(deviceId)).find((g) => g.code === code) : undefined;
        if (!mine) return { ok: false, error: "not-a-member" };
        scope = { kind: "group", group: mine };
      }

      const served = await puzzles.forDay(puzzleDay);
      const scores = await players.getDayScores(
        puzzleDay,
        served.puzzle.prompts.length,
        now,
        scope.kind === "group" ? scope.group.code : undefined,
      );
      const ranked = rankLeaderboard(scores);
      const toView = (r: RankedEntry): LeaderboardEntryView => ({
        rank: r.rank,
        nickname: r.nickname,
        total: r.total,
        dayTitle: dayTitle(r.total),
        you: r.playerKey === deviceId,
      });
      const yours = ranked.find((r) => r.playerKey === deviceId);
      return {
        ok: true,
        leaderboard: {
          puzzleDay,
          puzzleNumber: served.puzzleNumber,
          phase,
          scope,
          playerCount: ranked.length,
          entries: ranked.slice(0, LEADERBOARD_SIZE).map(toView),
          you: yours ? toView(yours) : null,
        },
      };
    },

    async joinGroup(deviceId, typedCode) {
      if (!(await players.getNickname(deviceId))) return { ok: false, error: "nickname-required" };
      const code = parseGroupCode(typedCode);
      if (!code) return { ok: false, error: "invalid-code" };
      const group = await players.joinGroup(deviceId, code);
      return group ? { ok: true, group } : { ok: false, error: "no-such-group" };
    },
  };
}
