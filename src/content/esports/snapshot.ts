/**
 * The trimmed copy of Leaguepedia esports data, as saved by `scripts/fetch-esports.ts`. Every fact
 * carries the Leaguepedia page it came from; `fetchedAt` dates the whole snapshot.
 */
export interface EsportsSnapshot {
  /** The day the snapshot was fetched (`YYYY-MM-DD`): the esports data version. */
  fetchedAt: string;
  /** Where the facts come from, e.g. "Leaguepedia Cargo API (lol.fandom.com)". */
  source: string;
  /** Every player a Template can name, one per Leaguepedia player page. */
  players: EsportsPlayer[];
  /** One entry per World Championship, oldest first. */
  worldsWins: WorldsWin[];
}

export interface EsportsPlayer {
  /** The Leaguepedia player page, e.g. "Faker" or "Ming (Shi Sen-Ming)": the stable identity. */
  id: string;
  /** Current in-game name, e.g. "Faker". */
  name: string;
  /** Former in-game names (Leaguepedia redirects), e.g. ["Dean"] for Zeka. */
  formerNames: string[];
  /** Pro games played, counted from Leaguepedia scoreboards: the player's Familiarity. */
  proGames: number;
  /** Leaguepedia URL of the player page. */
  source: string;
}

export interface WorldsWin {
  /** Season year, e.g. 2013. */
  year: number;
  /** The winning team as Leaguepedia listed it that year, e.g. "SK Telecom T1". */
  team: string;
  /** Player IDs (`EsportsPlayer.id`) on the winning roster: starters and substitutes, no coaches. */
  players: string[];
  /** Leaguepedia URL of that year's Worlds page. */
  source: string;
}
