import type { DayScore } from "@/leaderboard";
import type { InMemoryPlayStore } from "./in-memory-play-store";
import type { GroupInfo, PlayerStore } from "./player-store";

/** PlayerStore for local dev and tests; reads day totals from an InMemoryPlayStore. */
export class InMemoryPlayerStore implements PlayerStore {
  private readonly nicknames = new Map<string, string>();
  private readonly groups = new Map<string, GroupInfo>();
  /** Group codes per device, in the order joined. */
  private readonly memberships = new Map<string, string[]>();

  constructor(private readonly plays: InMemoryPlayStore) {}

  async getNickname(deviceId: string): Promise<string | null> {
    return this.nicknames.get(deviceId) ?? null;
  }

  async setNickname(deviceId: string, nickname: string): Promise<void> {
    this.nicknames.set(deviceId, nickname);
  }

  async createGroup(deviceId: string, group: GroupInfo): Promise<boolean> {
    if (this.groups.has(group.code)) return false;
    this.groups.set(group.code, { ...group });
    await this.joinGroup(deviceId, group.code);
    return true;
  }

  async joinGroup(deviceId: string, code: string): Promise<GroupInfo | null> {
    const group = this.groups.get(code);
    if (!group) return null;
    const codes = this.memberships.get(deviceId) ?? [];
    if (!codes.includes(code)) codes.push(code);
    this.memberships.set(deviceId, codes);
    return { ...group };
  }

  async getGroups(deviceId: string): Promise<GroupInfo[]> {
    return (this.memberships.get(deviceId) ?? []).map((code) => ({ ...this.groups.get(code)! }));
  }

  async getDayScores(puzzleDay: string, promptCount: number, now: number, groupCode?: string): Promise<DayScore[]> {
    const runs = await this.plays.getDayRuns(puzzleDay, promptCount, now);
    return runs
      .filter((r) => groupCode === undefined || (this.memberships.get(r.deviceId) ?? []).includes(groupCode))
      .map((r) => ({ playerKey: r.deviceId, nickname: this.nicknames.get(r.deviceId) ?? null, total: r.total }));
  }
}
