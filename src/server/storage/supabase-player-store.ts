import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { closedWindowsOpenedBy } from "@/engine";
import type { DayScore } from "@/leaderboard";
import type { GroupInfo, PlayerStore } from "./player-store";

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Supabase ${what} failed: ${res.error.message}`);
  return res.data;
}

/**
 * PlayerStore backed by Supabase (schema: supabase/migrations, functions from the leaderboards
 * migration). Server-only: it uses the service-role key.
 */
export class SupabasePlayerStore implements PlayerStore {
  constructor(private readonly db: SupabaseClient) {}

  static fromEnv(env: { url: string; serviceRoleKey: string }): SupabasePlayerStore {
    return new SupabasePlayerStore(
      createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    );
  }

  async getNickname(deviceId: string): Promise<string | null> {
    const rows = check(
      await this.db.from("players").select("nickname").eq("device_id", deviceId).limit(1),
      "getNickname",
    ) as Array<{ nickname: string | null }>;
    return rows[0]?.nickname ?? null;
  }

  async setNickname(deviceId: string, nickname: string): Promise<void> {
    check(await this.db.rpc("set_nickname", { p_device_id: deviceId, p_nickname: nickname }), "set_nickname");
  }

  async createGroup(deviceId: string, group: GroupInfo): Promise<boolean> {
    return check(
      await this.db.rpc("create_group", { p_device_id: deviceId, p_code: group.code, p_name: group.name }),
      "create_group",
    ) as boolean;
  }

  async joinGroup(deviceId: string, code: string): Promise<GroupInfo | null> {
    const rows = check(
      await this.db.rpc("join_group", { p_device_id: deviceId, p_code: code }),
      "join_group",
    ) as GroupInfo[];
    return rows[0] ? { code: rows[0].code, name: rows[0].name } : null;
  }

  async getGroups(deviceId: string): Promise<GroupInfo[]> {
    const rows = check(await this.db.rpc("player_groups", { p_device_id: deviceId }), "player_groups") as GroupInfo[];
    return rows.map((r) => ({ code: r.code, name: r.name }));
  }

  async getDayScores(puzzleDay: string, promptCount: number, now: number, groupCode?: string): Promise<DayScore[]> {
    const rows = check(
      await this.db.rpc("day_scores", {
        p_puzzle_day: puzzleDay,
        p_prompt_count: promptCount,
        p_closed_by: new Date(closedWindowsOpenedBy(now)).toISOString(),
        p_group_code: groupCode ?? null,
      }),
      "day_scores",
    ) as Array<{ device_id: string; nickname: string | null; total: number | string }>;
    return rows.map((r) => ({ playerKey: r.device_id, nickname: r.nickname, total: Number(r.total) }));
  }
}
