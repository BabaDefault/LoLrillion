/**
 * Writing the committed data files shared by `data:fetch` and `data:esports`: compact JSON, and the
 * Entity registry rebuilt from the game data snapshot plus the esports snapshot.
 */
import { writeFile } from "node:fs/promises";
import type { EsportsSnapshot } from "../../src/content/esports/snapshot";
import { buildRegistry } from "../../src/content/game-data/build-registry";
import { NICKNAMES } from "../../src/content/game-data/nicknames";
import type { GameDataSnapshot } from "../../src/content/game-data/snapshot";
import { content, readJson, readOptionalJson } from "./inputs";

export const GAME_DATA_SNAPSHOT_FILE = content("game-data/snapshot.json");
export const ESPORTS_SNAPSHOT_FILE = content("esports/snapshot.json");
const REGISTRY_FILE = content("game-data/registry.json");

/** JSON with one array element per line: compact, but diffs stay readable patch to patch. */
export function toJsonLines(value: unknown): string {
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

/** Rebuild registry.json from the committed snapshots, warning about nicknames that were dropped. */
export async function writeRegistry(): Promise<void> {
  const snapshot = await readJson<GameDataSnapshot>(GAME_DATA_SNAPSHOT_FILE);
  const esports = await readOptionalJson<EsportsSnapshot>(ESPORTS_SNAPSHOT_FILE);
  const registry = buildRegistry(snapshot, NICKNAMES, esports);
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
    `Registry: patch ${snapshot.patch}, ${count("champion")} champions, ${count("item")} items, ${count("skin")} skins, ` +
      `${snapshot.skinLines.length} skin lines; ` +
      (esports ? `esports ${esports.fetchedAt}, ${count("pro-player")} pro players.` : "no esports snapshot."),
  );
}
