import type { EsportsSnapshot } from "./snapshot";
import snapshot from "./snapshot.json";

/** The committed esports snapshot (see `snapshot.ts`), from Leaguepedia. Build-time use only. */
export const esportsSnapshot: EsportsSnapshot = snapshot as EsportsSnapshot;

export type * from "./snapshot";
