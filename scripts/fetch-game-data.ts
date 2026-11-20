/**
 * Maintainer script: fetch the current patch's game data and regenerate the committed data files.
 *
 *   npm run data:fetch      fetch Data Dragon + Community Dragon, write snapshot.json and registry.json
 *   npm run data:registry   rebuild registry.json from the committed snapshot.json (no network),
 *                           e.g. after editing nicknames.ts
 *
 * Sources: Data Dragon (champions, abilities, items + the shop filter's `maps`) and Community Dragon
 * pinned to the same major.minor patch (skins without chromas, skin lines, universes).
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { buildRegistry } from "../src/content/game-data/build-registry";
import { NICKNAMES } from "../src/content/game-data/nicknames";
import type { GameDataSnapshot } from "../src/content/game-data/snapshot";
import { snapshotFromRaw, type RawGameData } from "../src/content/game-data/transform";

const DATA_DIR = new URL("../src/content/game-data/", import.meta.url);
const SNAPSHOT_FILE = fileURLToPath(new URL("snapshot.json", DATA_DIR));
const REGISTRY_FILE = fileURLToPath(new URL("registry.json", DATA_DIR));

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

/** JSON with one array element per line: compact, but diffs stay readable patch to patch. */
function toJsonLines(value: unknown): string {
  if (Array.isArray(value)) {
    return `[\n${value.map((v) => JSON.stringify(v)).join(",\n")}\n]\n`;
  }
  const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => {
    const body = Array.isArray(v)
      ? `[\n${v.map((x) => `  ${JSON.stringify(x)}`).join(",\n")}\n]`
      : JSON.stringify(v);
    return `${JSON.stringify(k)}: ${body}`;
  });
  return `{\n${entries.join(",\n")}\n}\n`;
}

async function main() {
  const offline = process.argv.includes("--registry-only");
  let snapshot: GameDataSnapshot;
  if (offline) {
    snapshot = JSON.parse(await readFile(SNAPSHOT_FILE, "utf8"));
  } else {
    snapshot = snapshotFromRaw(await fetchRaw());
    await writeFile(SNAPSHOT_FILE, toJsonLines(snapshot));
  }

  const registry = buildRegistry(snapshot, NICKNAMES);
  await writeFile(REGISTRY_FILE, toJsonLines(registry));

  const ids = new Set(registry.map((e) => e.id));
  for (const id of Object.keys(NICKNAMES)) {
    if (!ids.has(id)) console.warn(`warning: nicknames.ts has an entry for unknown Entity ${id}`);
  }
  for (const [id, names] of Object.entries(NICKNAMES)) {
    const kept = registry.find((e) => e.id === id)?.aliases ?? [];
    for (const n of names) {
      if (!kept.includes(n)) console.warn(`warning: nickname "${n}" for ${id} was dropped (redundant or ambiguous)`);
    }
  }
  const count = (t: string) => registry.filter((e) => e.answerType === t).length;
  console.log(
    `Patch ${snapshot.patch}: ${count("champion")} champions, ${count("item")} items, ${count("skin")} skins, ` +
      `${snapshot.skinLines.length} skin lines.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
