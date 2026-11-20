/**
 * Maintainer script: the per-Template Answer Share report, for re-tiering a Template by hand.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run reviews:share
 *   npm run reviews:share -- --template champions-yordle    one Template
 *   npm run reviews:share -- --json                         machine-readable
 *
 * For every dated Puzzle up to today (Sydney), reads that Puzzle Day's Answer Counts (counted plays,
 * never archive plays) and sums them per Template. Each answer is printed with its current Tier, its
 * count and its Answer Share, most chosen first. To re-tier, adjust Typicality / Too Clever / Gem in
 * src/content/reviews/approved/<templateId>.json, commit, and run npm run puzzles:build.
 */
import { datedPuzzles } from "../src/content/puzzles";
import { puzzleDayOf } from "../src/engine";
import { answerShareReport } from "../src/reviews";
import { supabaseEnv } from "../src/server/env";
import { SupabasePlayStore } from "../src/server/storage/supabase-play-store";
import type { AnswerCounts } from "../src/server/storage/answer-counts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const env = supabaseEnv(process.env);
  if (!env) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY: Answer Counts live in Supabase.");
  const store = SupabasePlayStore.fromEnv(env);

  const today = puzzleDayOf(Date.now());
  const puzzles = Object.values(datedPuzzles).filter((p) => p.puzzleDay <= today);
  const counts: Record<string, AnswerCounts> = {};
  for (const p of puzzles) counts[p.puzzleDay] = await store.getAnswerCounts(p.puzzleDay, p.prompts.length);

  const only = arg("template");
  const report = answerShareReport(puzzles, counts).filter((r) => !only || r.templateId === only);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  for (const r of report) {
    console.log(`\n${r.templateId}: ${r.players} players over ${r.days.length} days (${r.days.join(", ")})`);
    for (const a of r.answers) {
      console.log(`  ${(a.share * 100).toFixed(1).padStart(5)}%  ${String(a.count).padStart(4)}  ${a.tier.padEnd(11)} ${a.entity}`);
    }
  }
  if (!report.length) console.log("No counted plays yet.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
