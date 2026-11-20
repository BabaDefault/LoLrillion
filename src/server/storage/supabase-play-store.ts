import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { closedWindowsOpenedBy, type EntityId, type PromptPlay, type Tier } from "@/engine";
import type { AnswerCounts } from "./answer-counts";
import type { AttemptLogEntry, DevicePlay, PlayKey, PlayStore } from "./play-store";

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
        confirmed_entity_id: entry.confirmedEntityId ?? null,
        result: result.kind,
        reason: result.kind === "rejected" ? result.reason : null,
        entity_id: result.kind === "accepted" ? result.entityId : null,
        // Everything about the result (candidates, expected Answer Type, ...) for later analysis.
        detail: result,
        attempted_at: new Date(entry.at).toISOString(),
      }),
      "logAttempt",
    );
  }

  async addOfferedCandidates(key: PlayKey, promptIndex: number, entityIds: readonly EntityId[]): Promise<void> {
    if (entityIds.length === 0) return;
    const playerId = await this.playerId(key.deviceId);
    check(
      await this.db.from("offered_candidates").upsert(
        entityIds.map((entityId) => ({
          player_id: playerId,
          puzzle_day: key.puzzleDay,
          prompt_index: promptIndex,
          is_archive: key.archive ?? false,
          entity_id: entityId,
        })),
        { onConflict: "player_id,puzzle_day,prompt_index,is_archive,entity_id", ignoreDuplicates: true },
      ),
      "addOfferedCandidates",
    );
  }

  async getOfferedCandidates(key: PlayKey, promptIndex: number): Promise<EntityId[]> {
    const rows = check(
      await this.db
        .from("offered_candidates")
        .select("entity_id")
        .eq("player_id", await this.playerId(key.deviceId))
        .eq("puzzle_day", key.puzzleDay)
        .eq("prompt_index", promptIndex)
        .eq("is_archive", key.archive ?? false),
      "getOfferedCandidates",
    ) as Array<{ entity_id: string }>;
    return rows.map((r) => r.entity_id);
  }

  async getAnswerCounts(puzzleDay: string, promptCount: number): Promise<AnswerCounts> {
    const [rows, players] = await Promise.all([
      this.db.from("answer_counts").select("prompt_index, entity_id, count").eq("puzzle_day", puzzleDay),
      this.db.rpc("day_player_count", { p_puzzle_day: puzzleDay }),
    ]);
    const byPrompt: Array<Record<EntityId, number>> = Array.from({ length: promptCount }, () => ({}));
    for (const r of check(rows, "getAnswerCounts") as Array<{ prompt_index: number; entity_id: string; count: number }>) {
      if (r.prompt_index < promptCount) byPrompt[r.prompt_index][r.entity_id] = r.count;
    }
    return { players: Number(check(players, "day_player_count")), byPrompt };
  }

  async getDevicePlays(deviceId: string): Promise<DevicePlay[]> {
    const rows = check(
      await this.db
        .from("prompt_plays")
        .select(
          "puzzle_day, is_archive, prompt_index, window_open_at, accepted_entity_id, accepted_entity_name, tier, points, players!inner(device_id)",
        )
        .eq("players.device_id", deviceId),
      "getDevicePlays",
    ) as unknown as Array<PromptPlayRow & { puzzle_day: string; is_archive: boolean }>;
    return rows.map((row) => ({
      puzzleDay: row.puzzle_day,
      archive: row.is_archive,
      promptIndex: row.prompt_index,
      play: toPromptPlay(row),
    }));
  }

  async getDayTotals(puzzleDay: string, promptCount: number, now: number): Promise<number[]> {
    const rows = check(
      await this.db.rpc("day_totals", {
        p_puzzle_day: puzzleDay,
        p_prompt_count: promptCount,
        p_closed_by: new Date(closedWindowsOpenedBy(now)).toISOString(),
      }),
      "day_totals",
    ) as Array<{ total: number | string }>;
    return rows.map((r) => Number(r.total));
  }
}
