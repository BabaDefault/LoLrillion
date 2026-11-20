/**
 * Maintainer script: sample the Riot API and write this patch's Familiarity file.
 *
 *   RIOT_API_KEY=RGAPI-... npm run data:familiarity -- [--platforms=na1,euw1,kr] [--tiers=gold,diamond]
 *       [--players=5] [--matches=10] [--since=2026-11-12] [--max-page=5] [--production]
 *
 * Writes `src/content/familiarity/<patch>.json` (patch = the committed game-data snapshot's version).
 * Only anonymous per-champion / per-item totals are written; PUUIDs and match IDs stay in memory.
 * `--production` lifts the development-key rate limits (use with a personal/production key).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import snapshot from "../src/content/game-data/snapshot.json";
import { createRiotClient, DEV_KEY_LIMITS } from "../src/content/familiarity/riot-client";
import { parseSampleConfig, sampleFamiliarity } from "../src/content/familiarity/sample";

async function main() {
  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) {
    console.error("Set RIOT_API_KEY (get a key at https://developer.riotgames.com).");
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const production = args.includes("--production");
  const config = parseSampleConfig(args.filter((a) => a !== "--production"));
  const client = createRiotClient({
    apiKey,
    limits: production ? [{ requests: 500, perMs: 10_000 }, { requests: 30_000, perMs: 600_000 }] : DEV_KEY_LIMITS,
  });

  const buckets = config.platforms.length * config.tiers.length;
  console.log(
    `Sampling ${config.playersPerBucket} players x ${buckets} buckets ` +
      `(${config.platforms.length} platforms x ${config.tiers.length} tiers), ${config.matchesPerPlayer} matches each...`,
  );
  const file = await sampleFamiliarity({ client, catalog: snapshot, config, log: console.log });

  const dir = fileURLToPath(new URL("../src/content/familiarity/", import.meta.url));
  await mkdir(dir, { recursive: true });
  const out = `${dir}${file.patch}.json`;
  await writeFile(out, JSON.stringify(file, null, 1) + "\n");
  console.log(`Wrote ${out}: ${file.sample?.players} players, ${file.sample?.matches} matches.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
