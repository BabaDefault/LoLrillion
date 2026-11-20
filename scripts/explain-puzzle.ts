/**
 * Maintainer script: print a Puzzle's provenance, and whether rebuilding each Prompt from today's
 * inputs gives the same Answer Set and Tiers.
 *
 *   npm run puzzles:explain -- 2026-12-01
 *
 * Per Prompt: the stored provenance (data version, review, labels, Familiarity, scoring constants),
 * then "same", or "changed" with the inputs that differ and whether the Tiers moved. Puzzles built
 * before provenance existed print "no provenance" and only the Tier comparison.
 */
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPrompt,
  explainPrompt,
  type BuilderInputs,
  type ChampionMetaOverlay,
  type FamiliarityData,
  type GeneratedPuzzle,
  type TemplateDefinition,
  type TemplateReview,
} from "../src/builder";
import type { GameDataSnapshot } from "../src/content/game-data/snapshot";
import { readApprovedReviews } from "../src/reviews/files";
import { approvedLabels } from "../src/content/labels";

const content = (path: string) => fileURLToPath(new URL(`../src/content/${path}`, import.meta.url));

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

/** Today's Builder inputs, read the same way `puzzles:build` reads them. */
async function todaysInputs(): Promise<BuilderInputs> {
  const snapshot = await readJson<GameDataSnapshot>(content("game-data/snapshot.json"));
  const familiarityPath = content(`familiarity/${snapshot.patch}.json`);
  return {
    snapshot,
    overlay: await readJson<ChampionMetaOverlay>(content("overlay/champions.json")),
    labels: approvedLabels,
    familiarity: existsSync(familiarityPath) ? await readJson<FamiliarityData>(familiarityPath) : undefined,
    reviews: await approvedReviewsAsTheyAre(),
  };
}

/**
 * The approved reviews. Explaining publishes nothing, so an approval that fails today's checks is
 * still read as it is (with a warning) rather than stopping the explanation.
 */
async function approvedReviewsAsTheyAre(): Promise<Record<string, TemplateReview>> {
  try {
    return await readApprovedReviews(content("reviews"));
  } catch (err) {
    console.warn(`Warning: ${err instanceof Error ? err.message : err}\n(read as they are)\n`);
    const dir = content("reviews/approved");
    const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
    const reviews = await Promise.all(files.map((f) => readJson<TemplateReview>(join(dir, f))));
    return Object.fromEntries(reviews.map((r) => [r.templateId, r]));
  }
}

async function main() {
  const day = process.argv[2];
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Usage: npm run puzzles:explain -- <YYYY-MM-DD>");
  const path = content(`puzzles/${day}.json`);
  if (!existsSync(path)) throw new Error(`No Puzzle for ${day} (${path})`);
  const puzzle = await readJson<GeneratedPuzzle>(path);
  const templates = new Map((await readJson<TemplateDefinition[]>(content("templates/templates.json"))).map((t) => [t.id, t]));
  const inputs = await todaysInputs();

  console.log(`#${puzzle.puzzleNumber} ${puzzle.puzzleDay}, data ${puzzle.dataVersion}`);
  for (const stored of puzzle.prompts) {
    console.log(`\n${stored.templateId}`);
    const p = stored.provenance;
    if (p) {
      const familiarity = p.familiarity === "none" ? "none" : `${p.familiarity.patch} ${p.familiarity.hash}`;
      console.log(`  data ${p.dataVersion}; review ${p.review}; labels ${p.labels}`);
      console.log(`  familiarity ${familiarity}; scoring ${p.scoring}`);
    } else {
      console.log("  no provenance (built before it was recorded)");
    }
    const template = templates.get(stored.templateId);
    if (!template) {
      console.log("  rebuild: Template no longer exists");
      continue;
    }
    const { status, changedInputs, tiersChanged } = explainPrompt(stored, buildPrompt(template, inputs));
    const tiers = tiersChanged ? "Answer Set or Tiers differ" : "same Answer Set and Tiers";
    if (status === "same") console.log("  rebuild: same");
    else if (status === "no-provenance") console.log(`  rebuild: ${tiers}`);
    else console.log(`  rebuild: changed (${changedInputs.join(", ") || "no recorded input"}); ${tiers}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
