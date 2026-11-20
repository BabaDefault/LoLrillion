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
import { buildPrompt, explainPrompt, type BuilderInputs, type GeneratedPuzzle } from "../src/builder";
import { readApprovedReviewFiles } from "../src/reviews/files";
import { content, readBuilderContent, readJson } from "./lib/inputs";

/**
 * The approved reviews. Explaining publishes nothing, so an approval that fails today's checks is
 * still read as it is (with a warning) rather than stopping the explanation.
 */
async function approvedReviewsAsTheyAre(): Promise<NonNullable<BuilderInputs["reviews"]>> {
  const { valid, invalid } = await readApprovedReviewFiles(content("reviews"));
  for (const { file, problems } of Object.values(invalid)) {
    console.warn(`Warning: ${file} fails today's checks (read as it is):\n  ${problems.join("\n  ")}\n`);
  }
  return { ...valid, ...Object.fromEntries(Object.entries(invalid).map(([id, { review }]) => [id, review])) };
}

async function main() {
  const day = process.argv[2];
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Usage: npm run puzzles:explain -- <YYYY-MM-DD>");
  const path = content(`puzzles/${day}.json`);
  if (!existsSync(path)) throw new Error(`No Puzzle for ${day} (${path})`);
  const puzzle = await readJson<GeneratedPuzzle>(path);
  // Today's Builder inputs, read the same way `puzzles:build` reads them.
  const { templates: definitions, ...today } = await readBuilderContent();
  const templates = new Map(definitions.map((t) => [t.id, t]));
  const inputs: BuilderInputs = { ...today, reviews: await approvedReviewsAsTheyAre() };

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
