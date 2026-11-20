/**
 * Maintainer script: regenerate the champion meta overlay (`src/content/overlay/champions.json`).
 *
 *   npm run data:overlay
 *
 * Region: each champion's one `associated-faction-slug` from the Universe site API (the old
 * universe-meta-uploads host is gone). Yordle: the hand-curated list in `src/content/overlay/yordles.ts`.
 * Every fact records its source link and the patch it was checked on (the committed snapshot's patch).
 * Champions in the Universe API but not in Data Dragon (e.g. Norra) are dropped; Data Dragon champions
 * missing from the Universe API fail the run, so a new champion can't slip through without a region.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { ChampionMeta, ChampionMetaOverlay } from "../src/builder/types";
import type { GameDataSnapshot } from "../src/content/game-data/snapshot";
import { YORDLE_EVIDENCE } from "../src/content/overlay/yordles";

const SNAPSHOT_FILE = fileURLToPath(new URL("../src/content/game-data/snapshot.json", import.meta.url));
const OVERLAY_FILE = fileURLToPath(new URL("../src/content/overlay/champions.json", import.meta.url));
const BROWSE = "https://universe-meeps.leagueoflegends.com/v1/en_us/champion-browse/index.json";
const championPage = (slug: string) => `https://universe.leagueoflegends.com/en_US/champion/${slug}/`;

/** Universe slugs that aren't the lowercased Data Dragon id. */
const SLUG_EXCEPTIONS: Record<string, string> = { Renata: "renataglasc" };

async function main() {
  const snapshot = JSON.parse(await readFile(SNAPSHOT_FILE, "utf8")) as GameDataSnapshot;
  const patch = snapshot.patch.split(".").slice(0, 2).join(".");
  const res = await fetch(BROWSE);
  if (!res.ok) throw new Error(`GET ${BROWSE} -> ${res.status}`);
  const browse = (await res.json()) as { champions: { slug: string; "associated-faction-slug": string }[] };
  const regionBySlug = new Map(browse.champions.map((c) => [c.slug, c["associated-faction-slug"]]));

  const champions: Record<string, ChampionMeta> = {};
  const missing: string[] = [];
  for (const { id } of [...snapshot.champions].sort((a, b) => a.id.localeCompare(b.id))) {
    const slug = SLUG_EXCEPTIONS[id] ?? id.toLowerCase();
    const region = regionBySlug.get(slug);
    if (!region) {
      missing.push(id);
      continue;
    }
    champions[id] = {
      region: { value: region, source: championPage(slug), patch },
      yordle: { value: id in YORDLE_EVIDENCE, source: championPage(slug), patch },
    };
  }
  if (missing.length) throw new Error(`No Universe region for: ${missing.join(", ")}`);
  const unknownYordles = Object.keys(YORDLE_EVIDENCE).filter((id) => !(id in champions));
  if (unknownYordles.length) throw new Error(`Unknown Yordle champion ids: ${unknownYordles.join(", ")}`);

  const overlay: ChampionMetaOverlay = { champions };
  const lines = Object.entries(champions).map(([id, meta]) => `    ${JSON.stringify(id)}: ${JSON.stringify(meta)}`);
  await writeFile(OVERLAY_FILE, `{\n  "champions": {\n${lines.join(",\n")}\n  }\n}\n`);
  console.log(`Wrote ${Object.keys(overlay.champions).length} champions (patch ${patch}) to ${OVERLAY_FILE}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
