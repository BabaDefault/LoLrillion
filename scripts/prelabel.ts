/**
 * Maintainer script: keyword pre-labelling (free, no AI).
 *
 *   npm run labels:prelabel                 scan every champion in the committed snapshot
 *   npm run labels:prelabel -- Kaisa Gnar   scan only these champions (Data Dragon ids)
 *
 * Writes suggestions, each with the matched keyword and its sentence as the evidence quote, to
 * src/content/labels/proposals/prelabel.json. Suggestions are never read by the app or the Builder:
 * a reviewer (or `/tag-patch`) decides which become approved labels.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { championEntityId } from "../src/content/game-data/build-registry";
import { gameDataSnapshot } from "../src/content/game-data/snapshot-data";
import { prelabel } from "../src/labels";

const PROPOSALS_DIR = fileURLToPath(new URL("../src/content/labels/proposals/", import.meta.url));

async function main() {
  const ids = process.argv.slice(2);
  const suggestions = prelabel(gameDataSnapshot, ids.length ? ids.map(championEntityId) : undefined);
  await mkdir(PROPOSALS_DIR, { recursive: true });
  const file = `${PROPOSALS_DIR}prelabel.json`;
  await writeFile(file, JSON.stringify({ patch: gameDataSnapshot.patch, suggestions }, null, 2) + "\n");
  console.log(`${suggestions.length} suggestions for patch ${gameDataSnapshot.patch} -> ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
