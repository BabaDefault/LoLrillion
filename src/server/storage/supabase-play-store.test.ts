import { describe, it } from "vitest";
import { supabaseEnv } from "../env";
import { describePlayStoreContract } from "./play-store-contract";
import { SupabasePlayStore } from "./supabase-play-store";

// Runs the PlayStore contract against a real Supabase project only when credentials are set.
// It writes rows for far-future Puzzle Days with throwaway device IDs.
const env = supabaseEnv(process.env);

if (env) {
  describePlayStoreContract("SupabasePlayStore", () => SupabasePlayStore.fromEnv(env));
} else {
  describe("SupabasePlayStore (PlayStore contract)", () => {
    it.skip("needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY", () => {});
  });
}
