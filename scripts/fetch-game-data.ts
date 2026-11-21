/**
 * Maintainer script: fetch the current patch's game data and regenerate the committed data files.
 *
 *   npm run data:fetch      fetch Data Dragon + Community Dragon, write snapshot.json and registry.json
 *   npm run data:registry   rebuild registry.json from the committed snapshot.json and esports snapshot
 *                           (no network), e.g. after editing nicknames.ts
 *
 * Sources: Data Dragon (champions, abilities, items + the shop filter's `maps`) and Community Dragon
 * pinned to the same major.minor patch (skins without chromas, skin lines, universes). Pro players come
 * from the esports snapshot (`npm run data:esports`).
 */
import { writeFile } from "node:fs/promises";
import { snapshotFromRaw, type RawGameData } from "../src/content/game-data/transform";
import { GAME_DATA_SNAPSHOT_FILE, toJsonLines, writeRegistry } from "./lib/registry";

const DDRAGON = "https://ddragon.leagueoflegends.com";
const cdragon = (patch: string) =>
  `https://raw.communitydragon.org/${patch}/plugins/rcp-be-lol-game-data/global/default/v1`;

async function getJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

async function fetchRaw(): Promise<RawGameData> {
  const [version] = (await getJson(`${DDRAGON}/api/versions.json`)) as string[];
  const cdPatch = version.split(".").slice(0, 2).join(".");
  console.log(`Fetching Data Dragon ${version} and Community Dragon ${cdPatch}...`);
  const [championFull, items, cdSkins, cdSkinLines, cdUniverses] = await Promise.all([
    getJson(`${DDRAGON}/cdn/${version}/data/en_US/championFull.json`),
    getJson(`${DDRAGON}/cdn/${version}/data/en_US/item.json`),
    getJson(`${cdragon(cdPatch)}/skins.json`),
    getJson(`${cdragon(cdPatch)}/skinlines.json`),
    getJson(`${cdragon(cdPatch)}/universes.json`),
  ]);
  return { version, championFull, items, cdSkins, cdSkinLines, cdUniverses };
}

async function main() {
  if (!process.argv.includes("--registry-only")) {
    await writeFile(GAME_DATA_SNAPSHOT_FILE, toJsonLines(snapshotFromRaw(await fetchRaw())));
  }
  await writeRegistry();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
