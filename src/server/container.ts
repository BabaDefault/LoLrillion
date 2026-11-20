import { AdjustableClock, systemClock, type Clock } from "./clock";
import { createGameService, type GameService } from "./game-service";
import { createLeaderboardService, type LeaderboardService } from "./leaderboard-service";
import { entityRegistry } from "@/content/game-data";
import { datedPuzzles } from "@/content/puzzles";
import { createDatedPuzzleSource } from "./dated-puzzle-source";
import { samplePuzzleSource, type PuzzleSource } from "./puzzle-source";
import { supabaseEnv } from "./env";
import { smokeTestMode } from "./smoke-mode";
import { smokePuzzleSource } from "./smoke-puzzle";
import { InMemoryPlayStore } from "./storage/in-memory-play-store";
import { InMemoryPlayerStore } from "./storage/in-memory-player-store";
import type { PlayStore } from "./storage/play-store";
import type { PlayerStore } from "./storage/player-store";
import { SupabasePlayStore } from "./storage/supabase-play-store";
import { SupabasePlayerStore } from "./storage/supabase-player-store";

/**
 * Smoke-test mode (Playwright only; see `smoke-mode.ts`): the fixed smoke Puzzle, an adjustable
 * clock and the in-memory store, even when Supabase variables are set (e.g. from `.env.local`).
 */
const smoke = smokeTestMode(process.env);

/** Where the smoke clock starts: noon on a Sydney Puzzle Day, so the day never rolls over mid-test. */
const SMOKE_START = Date.parse("2027-01-15T01:00:00Z");

/** Supabase when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, else in-memory. */
function createStores(): { plays: PlayStore; players: PlayerStore } {
  const env = smoke ? null : supabaseEnv(process.env);
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
  lolrillionSmokeClock?: AdjustableClock;
};

// Kept on globalThis so in-memory state survives dev-server hot reloads.
function stores() {
  globalForGame.lolrillionStores ??= createStores();
  return globalForGame.lolrillionStores;
}

// Today's Sydney-dated generated Puzzle; the sample when none is generated for today.
const puzzles: PuzzleSource = smoke
  ? smokePuzzleSource
  : createDatedPuzzleSource({ puzzles: datedPuzzles, entities: entityRegistry, fallback: samplePuzzleSource });

function smokeClock(): AdjustableClock {
  globalForGame.lolrillionSmokeClock ??= new AdjustableClock(SMOKE_START);
  return globalForGame.lolrillionSmokeClock;
}

function clock(): Clock {
  return smoke ? smokeClock() : systemClock;
}

export interface SmokeControls {
  /** Fresh in-memory stores and the clock back to its start; returns the new server time. */
  reset(): number;
  /** Jump the clock forward; returns the new server time. */
  advance(ms: number): number;
}

/** The smoke-test controls, or null outside smoke-test mode (the `/api/test/*` routes then 404). */
export function smokeControls(): SmokeControls | null {
  if (!smoke) return null;
  return {
    reset() {
      globalForGame.lolrillionStores = undefined;
      globalForGame.lolrillionGame = undefined;
      globalForGame.lolrillionLeaderboards = undefined;
      smokeClock().set(SMOKE_START);
      return smokeClock().now();
    },
    advance(ms) {
      smokeClock().advance(ms);
      return smokeClock().now();
    },
  };
}

export function getGameService(): GameService {
  globalForGame.lolrillionGame ??= createGameService({ clock: clock(), store: stores().plays, puzzles });
  return globalForGame.lolrillionGame;
}

export function getLeaderboardService(): LeaderboardService {
  globalForGame.lolrillionLeaderboards ??= createLeaderboardService({
    clock: clock(),
    puzzles,
    players: stores().players,
  });
  return globalForGame.lolrillionLeaderboards;
}
