/**
 * Maintainer script: the first step of `/tag-patch`.
 *
 *   npm run labels:worklist          write the work file for champions changed since the last tagging
 *   npm run labels:worklist -- --all --terms a,b
 *                                    every champion, judged for the named (new) terms only
 *   npm run labels:worklist -- --mark-tagged
 *                                    record the committed snapshot as tagged (after proposals are reviewed)
 *
 * The work file (src/content/labels/proposals/worklist.json) holds, for each champion whose ability
 * text changed since `tagged.json` was written: its plain ability text, its current approved labels,
 * and keyword suggestions. It also carries the term definitions. Nothing in the app reads it.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { gameDataSnapshot } from "../src/content/game-data/snapshot-data";
import { approvedLabels } from "../src/content/labels";
import {
  abilityText,
  BORROWED_ABILITIES,
  changedChampions,
  MECHANICS_TERMS,
  prelabel,
  taggedBaseline,
  type TaggedBaseline,
} from "../src/labels";
import { championEntityId } from "../src/content/game-data/build-registry";

const LABELS_DIR = new URL("../src/content/labels/", import.meta.url);
const TAGGED_FILE = fileURLToPath(new URL("tagged.json", LABELS_DIR));
const PROPOSALS_DIR = fileURLToPath(new URL("proposals/", LABELS_DIR));

async function main() {
  if (process.argv.includes("--mark-tagged")) {
    await writeFile(TAGGED_FILE, JSON.stringify(taggedBaseline(gameDataSnapshot), null, 2) + "\n");
    console.log(`Marked patch ${gameDataSnapshot.patch} as tagged -> ${TAGGED_FILE}`);
    return;
  }

  const baseline = JSON.parse(await readFile(TAGGED_FILE, "utf8")) as TaggedBaseline;
  // A newly added term has no labels yet, so every champion needs judging for it, changed or not.
  const all = process.argv.includes("--all");
  const termsFlag = process.argv.indexOf("--terms");
  const onlyTerms = termsFlag >= 0 ? new Set(process.argv[termsFlag + 1]?.split(",") ?? []) : undefined;
  const unknown = [...(onlyTerms ?? [])].filter((id) => !MECHANICS_TERMS.some((t) => t.id === id));
  if (unknown.length > 0) throw new Error(`Unknown terms: ${unknown.join(", ")}`);
  const inScope = (term: string) => !onlyTerms || onlyTerms.has(term);
  const toJudge = all
    ? gameDataSnapshot.champions.map((c) => championEntityId(c.id))
    : changedChampions(gameDataSnapshot, baseline);
  const suggestions = prelabel(gameDataSnapshot, toJudge).filter((s) => inScope(s.term));
  const champions = toJudge.map((entityId) => {
    const champion = gameDataSnapshot.champions.find((c) => championEntityId(c.id) === entityId)!;
    return {
      entityId,
      name: champion.name,
      abilities: champion.abilities.map((a) => ({
        slot: a.slot,
        name: a.name,
        description: abilityText(a, "description"),
        tooltip: abilityText(a, "tooltip"),
      })),
      approvedLabels: approvedLabels.filter((l) => l.entityId === entityId && inScope(l.term)),
      suggestions: suggestions.filter((s) => s.entityId === entityId),
    };
  });

  await mkdir(PROPOSALS_DIR, { recursive: true });
  const file = `${PROPOSALS_DIR}worklist.json`;
  const worklist = {
    patch: gameDataSnapshot.patch,
    previousPatch: baseline.patch,
    terms: MECHANICS_TERMS.filter((t) => inScope(t.id)).map(({ id, name, definition, excludes }) => ({ id, name, definition, excludes })),
    borrowedAbilities: BORROWED_ABILITIES,
    champions,
  };
  await writeFile(file, JSON.stringify(worklist, null, 2) + "\n");
  const scope = all ? "champions" : `changed champions since ${baseline.patch ?? "never"}`;
  const terms = onlyTerms ? ` for ${[...onlyTerms].join(", ")}` : "";
  console.log(`${toJudge.length} ${scope}${terms} (patch ${gameDataSnapshot.patch}) -> ${file}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
