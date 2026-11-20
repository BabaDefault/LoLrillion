import { systemClock } from "./clock";
import { createGameService, type GameService } from "./game-service";
import { samplePuzzleSource } from "./puzzle-source";
import { supabaseEnv } from "./env";
import { InMemoryPlayStore } from "./storage/in-memory-play-store";
import type { PlayStore } from "./storage/play-store";
import { SupabasePlayStore } from "./storage/supabase-play-store";

/** Supabase when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, else in-memory. */
function createPlayStore(): PlayStore {
  const env = supabaseEnv(process.env);
  return env ? SupabasePlayStore.fromEnv(env) : new InMemoryPlayStore();
}

/**
 * Wires the live GameService. Swap the store (Supabase), puzzle source (dated Puzzles)
 * or clock (Playwright) here; routes and the Game Engine don't change.
 */
const globalForGame = globalThis as unknown as { lolrillionGame?: GameService };

export function getGameService(): GameService {
  // Kept on globalThis so in-memory state survives dev-server hot reloads.
  globalForGame.lolrillionGame ??= createGameService({
    clock: systemClock,
    store: createPlayStore(),
    puzzles: samplePuzzleSource,
  });
  return globalForGame.lolrillionGame;
}
