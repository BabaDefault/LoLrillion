import { generateGroupCode, parseGroupCode, validateGroupName, validateNickname } from "@/leaderboard";
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
}

/** New codes to try before giving up when each one is already taken. */
const CODE_ATTEMPTS = 8;

export function createLeaderboardService({
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

    async joinGroup(deviceId, typedCode) {
      if (!(await players.getNickname(deviceId))) return { ok: false, error: "nickname-required" };
      const code = parseGroupCode(typedCode);
      if (!code) return { ok: false, error: "invalid-code" };
      const group = await players.joinGroup(deviceId, code);
      return group ? { ok: true, group } : { ok: false, error: "no-such-group" };
    },
  };
}
