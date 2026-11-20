import { systemClock } from "./clock";
import { createGameService, type GameService } from "./game-service";
import { samplePuzzleSource } from "./puzzle-source";
import { InMemoryPlayStore } from "./storage/in-memory-play-store";

/**
 * Wires the live GameService. Swap the store (Supabase), puzzle source (dated Puzzles)
 * or clock (Playwright) here; routes and the Game Engine don't change.
 */
const globalForGame = globalThis as unknown as { lolrillionGame?: GameService };

export function getGameService(): GameService {
  // Kept on globalThis so in-memory state survives dev-server hot reloads.
  globalForGame.lolrillionGame ??= createGameService({
    clock: systemClock,
    store: new InMemoryPlayStore(),
    puzzles: samplePuzzleSource,
  });
  return globalForGame.lolrillionGame;
}
