import { systemClock } from "./clock";
import { createGameService, type GameService } from "./game-service";
import { createLeaderboardService, type LeaderboardService } from "./leaderboard-service";
import { entityRegistry } from "@/content/game-data";
import { datedPuzzles } from "@/content/puzzles";
import { createDatedPuzzleSource } from "./dated-puzzle-source";
import { samplePuzzleSource, type PuzzleSource } from "./puzzle-source";
import { supabaseEnv } from "./env";
import { InMemoryPlayStore } from "./storage/in-memory-play-store";
import { InMemoryPlayerStore } from "./storage/in-memory-player-store";
import type { PlayStore } from "./storage/play-store";
import type { PlayerStore } from "./storage/player-store";
import { SupabasePlayStore } from "./storage/supabase-play-store";
import { SupabasePlayerStore } from "./storage/supabase-player-store";

/** Supabase when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, else in-memory. */
function createStores(): { plays: PlayStore; players: PlayerStore } {
  const env = supabaseEnv(process.env);
  if (env) return { plays: SupabasePlayStore.fromEnv(env), players: SupabasePlayerStore.fromEnv(env) };
  const plays = new InMemoryPlayStore();
  return { plays, players: new InMemoryPlayerStore(plays) };
}

/**
 * Wires the live services. Swap the stores (Supabase), puzzle source (dated Puzzles)
 * or clock (Playwright) here; routes and the Game Engine don't change.
 */
const globalForGame = globalThis as unknown as {
  lolrillionStores?: { plays: PlayStore; players: PlayerStore };
  lolrillionGame?: GameService;
  lolrillionLeaderboards?: LeaderboardService;
};

// Kept on globalThis so in-memory state survives dev-server hot reloads.
function stores() {
  globalForGame.lolrillionStores ??= createStores();
  return globalForGame.lolrillionStores;
}

// Today's Sydney-dated generated Puzzle; the sample when none is generated for today.
const puzzles: PuzzleSource = createDatedPuzzleSource({
  puzzles: datedPuzzles,
  entities: entityRegistry,
  fallback: samplePuzzleSource,
});

export function getGameService(): GameService {
  globalForGame.lolrillionGame ??= createGameService({ clock: systemClock, store: stores().plays, puzzles });
  return globalForGame.lolrillionGame;
}

export function getLeaderboardService(): LeaderboardService {
  globalForGame.lolrillionLeaderboards ??= createLeaderboardService({
    clock: systemClock,
    puzzles,
    players: stores().players,
  });
  return globalForGame.lolrillionLeaderboards;
}
