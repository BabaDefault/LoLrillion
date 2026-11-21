/**
 * Maintainer script: fetch the esports snapshot from Leaguepedia and rebuild the Entity registry.
 *
 *   npm run data:esports    query the Leaguepedia Cargo API (no key needed), write
 *                           src/content/esports/snapshot.json and src/content/game-data/registry.json
 *
 * Fetches every World Championship winner, every team's roster at each Worlds (players only, no
 * coaches; the non-winners are decoys), each player's names (Leaguepedia redirects: current and
 * former IGNs), and their pro games played (Leaguepedia scoreboards), the players' Familiarity.
 * Leaguepedia rate-limits anonymous queries hard, so requests are spaced out and retried with
 * backoff; a full run takes several minutes.
 */
import { writeFile } from "node:fs/promises";
import { esportsSnapshotFromRaw, worldsRosterRows, type RawEsportsData } from "../src/content/esports/transform";
import { ESPORTS_SNAPSHOT_FILE, toJsonLines, writeRegistry } from "./lib/registry";

const API = "https://lol.fandom.com/api.php";
/** Anonymous Cargo queries return at most this many rows. */
const PAGE = 500;
/** Rows per `IN (...)` list, keeping URLs short. */
const CHUNK = 60;
const SPACING_MS = 4_000;
const RETRIES = 6;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const quote = (s: string) => `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
const inList = (values: readonly string[]) => `(${values.map(quote).join(",")})`;
const chunks = <T>(xs: readonly T[]) => Array.from({ length: Math.ceil(xs.length / CHUNK) }, (_, i) => xs.slice(i * CHUNK, (i + 1) * CHUNK));

type Row = Record<string, string>;

/** One Cargo query, all pages, spaced and retried. Field aliases (`a=B`) name the returned keys. */
async function cargo(params: { tables: string; fields: string; where: string; group_by?: string }): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const url = new URL(API);
    const query = { action: "cargoquery", format: "json", limit: String(PAGE), offset: String(offset), ...params };
    for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, v);
    const page = await getWithRetry(url);
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

async function getWithRetry(url: URL): Promise<Row[]> {
  for (let attempt = 0; ; attempt++) {
    await sleep(attempt === 0 ? SPACING_MS : SPACING_MS * 2 ** (attempt + 1));
    const res = await fetch(url, { headers: { "User-Agent": "LoLrillion-data-script" } });
    // A 200 can still be an HTML maintenance or captcha page: retry it like a 5xx.
    const body = res.ok
      ? await res.json().catch(() => ({ error: { code: "http-5xx-not-json" } }))
      : { error: { code: `http-${res.status}` } };
    if (body.cargoquery) return body.cargoquery.map((r: { title: Row }) => r.title);
    const code = body.error?.code ?? "unknown";
    if (attempt >= RETRIES || (code !== "ratelimited" && !code.startsWith("http-5") && code !== "http-429")) {
      throw new Error(`Leaguepedia query failed (${code}): ${body.error?.info ?? ""}\n${url}`);
    }
    console.log(`  ${code}; retrying (${attempt + 1}/${RETRIES})...`);
  }
}

async function fetchRaw(): Promise<RawEsportsData> {
  console.log("Worlds winners...");
  const winners = (
    await cargo({
      tables: "TournamentResults",
      fields: "Event,Team,RosterPage",
      where: "Event LIKE 'Worlds%' AND Place_Number=1",
    })
  ).map((r) => ({ Event: r.Event, Team: r.Team, RosterPage: r.RosterPage }));

  console.log(`Rosters for ${winners.length} events...`);
  // Every team's players at each Worlds proper (winners and decoys); qualifiers and coaches are
  // dropped here so later queries stay small.
  const rosters = worldsRosterRows(
    winners,
    (
      await cargo({
        tables: "TournamentPlayers",
        fields: "Team,Link,Role,OverviewPage",
        where: `OverviewPage IN ${inList([...new Set(winners.map((w) => w.RosterPage))])}`,
      })
    ).map((r) => ({ Team: r.Team, Link: r.Link, Role: r.Role, OverviewPage: r.OverviewPage })),
  );

  const links = [...new Set(rosters.map((r) => r.Link))];
  console.log(`Names for ${links.length} roster links...`);
  const redirectFields = "AllName,OverviewPage,ID";
  const toPages: Row[] = [];
  for (const chunk of chunks(links)) {
    toPages.push(...(await cargo({ tables: "PlayerRedirects", fields: redirectFields, where: `AllName IN ${inList(chunk)}` })));
  }
  const pages = [...new Set([...toPages.map((r) => r.OverviewPage), ...links])];
  const redirects: RawEsportsData["redirects"] = [];
  for (const chunk of chunks(pages)) {
    const rows = await cargo({ tables: "PlayerRedirects", fields: redirectFields, where: `OverviewPage IN ${inList(chunk)}` });
    redirects.push(...rows.map((r) => ({ AllName: r.AllName, OverviewPage: r.OverviewPage, ID: r.ID })));
  }

  const lowercase: string[] = [];
  for (const chunk of chunks([...new Set(redirects.map((r) => r.OverviewPage))])) {
    const rows = await cargo({ tables: "Players", fields: "OverviewPage", where: `IsLowercase='1' AND OverviewPage IN ${inList(chunk)}` });
    lowercase.push(...rows.map((r) => r.OverviewPage));
  }

  const names = [...new Set([...pages, ...redirects.map((r) => r.AllName)])];
  console.log(`Pro games for ${names.length} names...`);
  const games: RawEsportsData["games"] = [];
  for (const chunk of chunks(names)) {
    const rows = await cargo({
      tables: "ScoreboardPlayers",
      fields: "Link,COUNT(*)=Games",
      where: `Link IN ${inList(chunk)}`,
      group_by: "Link",
    });
    games.push(...rows.map((r) => ({ Link: r.Link, Games: r.Games })));
  }

  return { fetchedAt: new Date().toISOString().slice(0, 10), winners, rosters, redirects, lowercase, games };
}

async function main() {
  const snapshot = esportsSnapshotFromRaw(await fetchRaw());
  await writeFile(ESPORTS_SNAPSHOT_FILE, toJsonLines(snapshot));
  console.log(
    `Esports ${snapshot.fetchedAt}: ${snapshot.worldsWins.length} Worlds (${snapshot.worldsWins[0]?.year}-` +
      `${snapshot.worldsWins.at(-1)?.year}), ${snapshot.players.length} players.`,
  );
  for (const w of snapshot.worldsWins) {
    if (w.players.length < 5) console.warn(`warning: Worlds ${w.year} (${w.team}) has only ${w.players.length} players`);
  }
  await writeRegistry();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
