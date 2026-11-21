import type { GameDataSnapshot } from "./snapshot";
import snapshot from "./snapshot.json";

/** The committed game data snapshot (see `snapshot.ts`), labelled with its patch. Build-time use only. */
export const gameDataSnapshot: GameDataSnapshot = snapshot as unknown as GameDataSnapshot;

export type * from "./snapshot";
