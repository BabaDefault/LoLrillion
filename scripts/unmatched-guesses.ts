/**
 * Maintainer script: Rejected Guesses per Template, to find missing answers and Aliases.
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run reports:unmatched
 *   npm run reports:unmatched -- --day 2026-11-21                one Puzzle Day
 *   npm run reports:unmatched -- --template champions-yordle     one Template
 *   npm run reports:unmatched -- --json                          machine-readable
 *
 * Reads the logged Attempts Rejected as answers (no Entity matched, or an Entity outside the Answer
 * Set) on dated Puzzles up to today (Sydney), counted and archive plays alike. Did-you-mean and
 * wrong-Answer-Type results are not Attempts and never appear. Guesses are grouped by normalized
 * text, most frequent first:
 *   -> ENTITY  names an Entity of the Answer Type: a likely missing answer, or a disputable Rule
 *              (review the Template with /review-template).
 *   -> ?       names no Entity: a likely missing Alias or a typo.
 */
import { createClient } from "@supabase/supabase-js";
import { entityRegistry } from "../src/content/game-data";
import { datedPuzzles } from "../src/content/puzzles";
import { puzzleDayOf } from "../src/engine";
import { unmatchedGuessReport, type LoggedAttempt } from "../src/reviews";
import { supabaseEnv } from "../src/server/env";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface AttemptRow {
  player_id: string;
  puzzle_day: string;
  prompt_index: number;
  guess: string | null;
  result: string;
  reason: string | null;
  confirmed_entity_id: string | null;
}

const PAGE = 1000;

async function main() {
  const env = supabaseEnv(process.env);
  if (!env) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY: Attempts are logged in Supabase.");
  const db = createClient(env.url, env.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const today = puzzleDayOf(Date.now());
  const day = arg("day");
  if (day && !datedPuzzles[day]) throw new Error(`No dated Puzzle for ${day}.`);
  // Only played dated Puzzles: anything later (e.g. a moved test clock) has no Template to report on.
  const puzzles = Object.values(datedPuzzles).filter((p) => p.puzzleDay <= today && (!day || p.puzzleDay === day));

  const rows: AttemptRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = db
      .from("attempts")
      .select("player_id, puzzle_day, prompt_index, guess, result, reason, confirmed_entity_id")
      .eq("result", "rejected")
      .in("reason", ["no-match", "not-in-answer-set"])
      .lte("puzzle_day", today)
      .order("id")
      .range(from, from + PAGE - 1);
    if (day) query = query.eq("puzzle_day", day);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase attempts read failed: ${error.message}`);
    rows.push(...(data as AttemptRow[]));
    if (data.length < PAGE) break;
  }

  const attempts: LoggedAttempt[] = rows.map((r) => ({
    playerId: r.player_id,
    puzzleDay: r.puzzle_day,
    promptIndex: r.prompt_index,
    guess: r.guess,
    result: r.result,
    reason: r.reason,
    confirmedEntityId: r.confirmed_entity_id,
  }));
  const only = arg("template");
  const report = unmatchedGuessReport(puzzles, entityRegistry, attempts).filter((r) => !only || r.templateId === only);
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  for (const r of report) {
    console.log(`\n${r.templateId} (${r.answerType}): "${r.prompt}" on ${r.days.join(", ")}`);
    console.log(`  count  players  guess`);
    for (const g of r.guesses) {
      const typed = g.spellings.map((s) => JSON.stringify(s)).join(", ");
      const match = g.entity ? `ENTITY ${g.entity.name} (${g.entity.id})` : "?";
      console.log(`  ${String(g.count).padStart(5)}  ${String(g.players).padStart(7)}  ${typed}  -> ${match}`);
    }
  }
  if (!report.length) console.log("No Rejected Guesses yet.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
