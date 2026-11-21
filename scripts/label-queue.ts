/**
 * Maintainer script: the label review queue for `/tag-patch` proposals.
 *
 *   npm run labels:queue                          rank src/content/labels/proposals/<snapshot patch>.json
 *   npm run labels:queue -- path/to/labels.json   rank another proposals file
 *
 * Prints every proposed label most uncertain first, with the reasons, so the maintainer reviews the
 * likeliest mistakes first. Labels whose quote fails the validator are listed as REJECTED and the
 * script exits 1: fix or drop them before approving anything.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { gameDataSnapshot } from "../src/content/game-data/snapshot-data";
import { changedChampions, type MechanicsLabel, type TaggedBaseline } from "../src/labels";
import { labelQueue } from "../src/uncertainty";

const LABELS_DIR = new URL("../src/content/labels/", import.meta.url);

async function main() {
  const file = process.argv[2] ?? fileURLToPath(new URL(`proposals/${gameDataSnapshot.patch}.json`, LABELS_DIR));
  const parsed = JSON.parse(await readFile(file, "utf8"));
  const labels: MechanicsLabel[] = Array.isArray(parsed) ? parsed : parsed.labels;
  const baseline = JSON.parse(await readFile(fileURLToPath(new URL("tagged.json", LABELS_DIR)), "utf8")) as TaggedBaseline;
  const changed = changedChampions(gameDataSnapshot, baseline);

  const { queue, rejected } = labelQueue(labels, { snapshot: gameDataSnapshot, changed });
  for (const { label, reason } of rejected) {
    console.log(`REJECTED (${reason}): ${label.entityId} ${label.term} ${label.ability}/${label.sourceField}: "${label.quote}"`);
  }
  console.log(`${queue.length} labels to review, most uncertain first (work top-down):`);
  for (const { item, score, reasons } of queue) {
    console.log(`${String(score).padStart(3)}  ${item.entityId} ${item.term} ${item.ability}/${item.sourceField}: "${item.quote}"`);
    for (const reason of reasons) console.log(`       - ${reason}`);
  }
  if (rejected.length) process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
