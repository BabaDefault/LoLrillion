import { describe, it } from "vitest";
import { supabaseEnv } from "../env";
import { describePlayerStoreContract } from "./player-store-contract";
import { SupabasePlayStore } from "./supabase-play-store";
import { SupabasePlayerStore } from "./supabase-player-store";

// Runs the PlayerStore contract against a real Supabase project only when credentials are set.
// It writes rows for far-future Puzzle Days with throwaway device IDs and random group codes.
const env = supabaseEnv(process.env);

if (env) {
  describePlayerStoreContract("SupabasePlayerStore", () => ({
    plays: SupabasePlayStore.fromEnv(env),
    players: SupabasePlayerStore.fromEnv(env),
  }));
} else {
  describe("SupabasePlayerStore (PlayerStore contract)", () => {
    it.skip("needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY", () => {});
  });
}
