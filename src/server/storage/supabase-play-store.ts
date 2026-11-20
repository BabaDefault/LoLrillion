import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { EntityId, PromptPlay, Tier } from "@/engine";
import type { AttemptLogEntry, PlayKey, PlayStore } from "./play-store";

/** A `prompt_plays` row, as far as this store reads it. */
interface PromptPlayRow {
  prompt_index: number;
  window_open_at: string;
  accepted_entity_id: string | null;
  accepted_entity_name: string | null;
  tier: string | null;
  points: number;
}

function toPromptPlay(row: PromptPlayRow): PromptPlay {
  return {
    windowOpenAt: Date.parse(row.window_open_at),
    accepted:
      row.accepted_entity_id === null
        ? null
        : {
            kind: "accepted",
            entityId: row.accepted_entity_id,
            entityName: row.accepted_entity_name ?? row.accepted_entity_id,
            tier: row.tier as Tier,
            points: row.points,
          },
  };
}

function check<T>(res: { data: T; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Supabase ${what} failed: ${res.error.message}`);
  return res.data;
}

/**
 * PlayStore backed by Supabase (schema: supabase/migrations). Server-only: it uses the
 * service-role key. Writes that must be atomic (start a Prompt once, count an acceptance once)
 * go through the SQL functions in the migration.
 */
export class SupabasePlayStore implements PlayStore {
  private readonly playerIds = new Map<string, string>();

  constructor(private readonly db: SupabaseClient) {}

  static fromEnv(env: { url: string; serviceRoleKey: string }): SupabasePlayStore {
    return new SupabasePlayStore(
      createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }),
    );
  }

  private async playerId(deviceId: string): Promise<string> {
    const cached = this.playerIds.get(deviceId);
    if (cached) return cached;
    const id = check(await this.db.rpc("ensure_player", { p_device_id: deviceId }), "ensure_player") as string;
    this.playerIds.set(deviceId, id);
    return id;
  }

  async getPromptPlays(key: PlayKey, promptCount: number): Promise<Array<PromptPlay | null>> {
    const rows = check(
      await this.db
        .from("prompt_plays")
        .select(
          "prompt_index, window_open_at, accepted_entity_id, accepted_entity_name, tier, points, players!inner(device_id)",
        )
        .eq("players.device_id", key.deviceId)
        .eq("puzzle_day", key.puzzleDay)
        .eq("is_archive", key.archive ?? false),
      "getPromptPlays",
    ) as unknown as PromptPlayRow[];
    const plays: Array<PromptPlay | null> = Array.from({ length: promptCount }, () => null);
    for (const row of rows) {
      if (row.prompt_index < promptCount) plays[row.prompt_index] = toPromptPlay(row);
    }
    return plays;
  }

  async createPromptPlay(key: PlayKey, promptIndex: number, play: PromptPlay): Promise<PromptPlay> {
    const rows = check(
      await this.db.rpc("start_prompt_play", {
        p_device_id: key.deviceId,
        p_puzzle_day: key.puzzleDay,
        p_prompt_index: promptIndex,
        p_is_archive: key.archive ?? false,
        p_window_open_at: new Date(play.windowOpenAt).toISOString(),
      }),
      "start_prompt_play",
    ) as PromptPlayRow[];
    return toPromptPlay(rows[0]);
  }

  async updatePromptPlay(key: PlayKey, promptIndex: number, play: PromptPlay): Promise<void> {
    // The only change a play goes through after it starts is its Accepted Guess.
    if (!play.accepted) return;
    check(
      await this.db.rpc("accept_prompt_play", {
        p_device_id: key.deviceId,
        p_puzzle_day: key.puzzleDay,
        p_prompt_index: promptIndex,
        p_is_archive: key.archive ?? false,
        p_entity_id: play.accepted.entityId,
        p_entity_name: play.accepted.entityName,
        p_tier: play.accepted.tier,
        p_points: play.accepted.points,
      }),
      "accept_prompt_play",
    );
  }

  async logAttempt(entry: AttemptLogEntry): Promise<void> {
    const { result } = entry;
    check(
      await this.db.from("attempts").insert({
        player_id: await this.playerId(entry.deviceId),
        puzzle_day: entry.puzzleDay,
        prompt_index: entry.promptIndex,
        is_archive: entry.archive ?? false,
        guess: entry.guess,
        result: result.kind,
        reason: result.kind === "rejected" ? result.reason : null,
        entity_id: result.kind === "accepted" ? result.entityId : null,
        attempted_at: new Date(entry.at).toISOString(),
      }),
      "logAttempt",
    );
  }

  async getAnswerCounts(puzzleDay: string, promptIndex: number): Promise<Record<EntityId, number>> {
    const rows = check(
      await this.db
        .from("answer_counts")
        .select("entity_id, count")
        .eq("puzzle_day", puzzleDay)
        .eq("prompt_index", promptIndex),
      "getAnswerCounts",
    ) as Array<{ entity_id: string; count: number }>;
    return Object.fromEntries(rows.map((r) => [r.entity_id, r.count]));
  }

  async getDayTotals(puzzleDay: string, promptCount: number): Promise<number[]> {
    const rows = check(
      await this.db.rpc("day_totals", { p_puzzle_day: puzzleDay, p_prompt_count: promptCount }),
      "day_totals",
    ) as Array<{ total: number | string }>;
    return rows.map((r) => Number(r.total));
  }
}
