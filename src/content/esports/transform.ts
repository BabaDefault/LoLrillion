import type { EsportsPlayer, EsportsSnapshot, WorldsWin } from "./snapshot";

/** Leaguepedia Cargo rows, as `scripts/fetch-esports.ts` fetches them. Every value is a string. */
export interface RawEsportsData {
  /** `YYYY-MM-DD` the rows were fetched. */
  fetchedAt: string;
  /** `TournamentResults` rows that placed first, at any event named "Worlds ...". */
  winners: { Event: string; Team: string; RosterPage: string }[];
  /** `TournamentPlayers` rows for those events' roster pages (every team, not only the winner). */
  rosters: { Team: string; Link: string; Role: string; OverviewPage: string }[];
  /** `PlayerRedirects` rows: every name (`AllName`) that leads to a player page, and its IGN (`ID`). */
  redirects: { AllName: string; OverviewPage: string; ID: string }[];
  /** Player pages whose `Players` row is flagged `IsLowercase` (e.g. "XPeke" is written "xPeke"). */
  lowercase: string[];
  /** `ScoreboardPlayers` games counted per `Link`. */
  games: { Link: string; Games: string }[];
}

export const LEAGUEPEDIA_SOURCE = "Leaguepedia Cargo API (lol.fandom.com)";

export const leaguepediaUrl = (page: string) => `https://lol.fandom.com/wiki/${encodeURI(page.replace(/ /g, "_"))}`;

/** "Worlds 2022" or "Worlds Season 3", and nothing else (qualifiers, Regional Finals). */
const WORLDS_EVENT = /^Worlds (?:(\d{4})|Season (\d))$/;

/** A roster row for someone who plays, not a coach, analyst or manager. */
const PLAYING_ROLE = /\b(top|jungle|mid|bot|ad carry|support)\b/i;

/** Leaguepedia matches names case-insensitively ("bengi" is "Bengi", "JieJie" is "Jiejie"). */
const nameKey = (name: string) => name.toLowerCase();

/**
 * A surname-style ID ("PARK", "GB KIM", "LEElS") from international scoreboards or real names: more
 * capitals than lowercase letters. Not an IGN anyone would guess, and often shared by many players.
 */
const isSurnameStyle = (name: string) => (name.match(/[A-Z]/g)?.length ?? 0) > (name.match(/[a-z]/g)?.length ?? 0);

/**
 * Roster rows of players (not coaches) at a World Championship proper, every team: the winners are
 * the Answer Set, the rest are decoys so that a known non-winner ("Uzi") reads as a wrong answer.
 */
export function worldsRosterRows<R extends RawEsportsData["rosters"][number]>(winners: RawEsportsData["winners"], rosters: readonly R[]): R[] {
  const pages = new Set(winners.filter((w) => WORLDS_EVENT.test(w.Event)).map((w) => w.RosterPage));
  return rosters.filter((r) => pages.has(r.OverviewPage) && PLAYING_ROLE.test(r.Role));
}

/** The snapshot of Worlds-winning rosters and every Worlds player, from Leaguepedia rows. Pure. */
export function esportsSnapshotFromRaw(raw: RawEsportsData): EsportsSnapshot {
  // Any name (redirect or page) → the player page it leads to. A name that is itself a player page
  // always means that player, even when another player has a redirect spelled the same ("TIAN" for Meiko).
  const pageOf = new Map<string, string>();
  for (const r of raw.redirects) pageOf.set(nameKey(r.AllName), r.OverviewPage);
  for (const r of raw.redirects) pageOf.set(nameKey(r.OverviewPage), r.OverviewPage);
  const canonical = (link: string) => pageOf.get(nameKey(link)) ?? link;
  const isPage = (name: string, page: string) => nameKey(canonical(name)) === nameKey(page);
  const leadsElsewhere = (name: string, page: string) => pageOf.has(nameKey(name)) && !isPage(name, page);
  const lowercase = new Set(raw.lowercase.map(nameKey));

  const worldsWins: WorldsWin[] = raw.winners
    .flatMap((w) => {
      const m = WORLDS_EVENT.exec(w.Event);
      if (!m) return [];
      const year = m[1] ? Number(m[1]) : 2010 + Number(m[2]);
      const players = raw.rosters
        .filter((r) => r.OverviewPage === w.RosterPage && r.Team === w.Team && PLAYING_ROLE.test(r.Role))
        .map((r) => canonical(r.Link));
      return [{ year, team: w.Team, players: [...new Set(players)].sort(), source: leaguepediaUrl(w.RosterPage.split("/")[0]) }];
    })
    .sort((a, b) => a.year - b.year);

  // Cargo groups Links case-insensitively, so "BeBe" and "Bebe" in different query chunks return the
  // same group twice: one count per name, never a sum.
  const gamesByName = new Map<string, number>();
  for (const g of raw.games) gamesByName.set(nameKey(g.Link), Math.max(gamesByName.get(nameKey(g.Link)) ?? 0, Number(g.Games) || 0));
  const entrants = worldsRosterRows(raw.winners, raw.rosters).map((r) => canonical(r.Link));
  const ids = [...new Set([...worldsWins.flatMap((w) => w.players), ...entrants])].sort();
  const players: EsportsPlayer[] = ids.map((id) => {
    const names = raw.redirects.filter((r) => r.OverviewPage === id);
    const ign = names.find((r) => r.AllName === id)?.ID ?? id.replace(/\s*\(.*\)$/, "");
    const name = lowercase.has(nameKey(id)) ? ign.charAt(0).toLowerCase() + ign.slice(1) : ign;
    const formerNames = [...new Set(names.map((r) => r.ID))]
      .filter((n) => nameKey(n) !== nameKey(name) && !leadsElsewhere(n, id) && !isSurnameStyle(n))
      .sort();
    // Only names that lead here: a redirect spelled like another player's page counts that player's games.
    const allNames = new Set([id, ...names.map((r) => r.AllName)].filter((n) => isPage(n, id)).map(nameKey));
    const proGames = [...allNames].reduce((sum, n) => sum + (gamesByName.get(n) ?? 0), 0);
    return { id, name, formerNames, proGames, source: leaguepediaUrl(id) };
  });

  return { fetchedAt: raw.fetchedAt, source: LEAGUEPEDIA_SOURCE, players: withoutSharedFormerNames(players), worldsWins };
}

/**
 * Drop former IGNs that more than one player had, or that are another player's current IGN ("Shadow"
 * was Crown, Frozen and Shad0w): an Alias must name one player, not whichever the registry lists first.
 */
function withoutSharedFormerNames(players: EsportsPlayer[]): EsportsPlayer[] {
  const owners = new Map<string, Set<string>>();
  for (const p of players) {
    for (const n of [p.name, ...p.formerNames]) owners.set(nameKey(n), (owners.get(nameKey(n)) ?? new Set()).add(p.id));
  }
  return players.map((p) => ({ ...p, formerNames: p.formerNames.filter((n) => owners.get(nameKey(n))!.size === 1) }));
}
