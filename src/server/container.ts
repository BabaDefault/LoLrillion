import { systemClock } from "./clock";
import { createGameService, type GameService } from "./game-service";
import { entityRegistry } from "@/content/game-data";
import { datedPuzzles } from "@/content/puzzles";
import { createDatedPuzzleSource } from "./dated-puzzle-source";
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
    // Today's Sydney-dated generated Puzzle; the sample when none is generated for today.
    puzzles: createDatedPuzzleSource({ puzzles: datedPuzzles, entities: entityRegistry, fallback: samplePuzzleSource }),
  });
  return globalForGame.lolrillionGame;
}
