/**
 * Maintainer script: the quote validator, run over label files.
 *
 *   npm run labels:validate                         check approved.json
 *   npm run labels:validate -- path/to/labels.json  check a proposals file
 *
 * A file is either an array of labels or `{ labels: [...] }`. Exits 1 if any label's quote is not
 * word for word in the committed snapshot's ability text.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { gameDataSnapshot } from "../src/content/game-data/snapshot-data";
import { invalidLabels, type MechanicsLabel } from "../src/labels";

const APPROVED = fileURLToPath(new URL("../src/content/labels/approved.json", import.meta.url));

async function main() {
  const file = process.argv[2] ?? APPROVED;
  const parsed = JSON.parse(await readFile(file, "utf8"));
  const labels: MechanicsLabel[] = Array.isArray(parsed) ? parsed : parsed.labels;
  const invalid = invalidLabels(labels, gameDataSnapshot);
  for (const { label, reason } of invalid) {
    console.log(`REJECTED (${reason}): ${label.entityId} ${label.term} ${label.ability}/${label.sourceField}: "${label.quote}"`);
  }
  console.log(`${labels.length - invalid.length}/${labels.length} labels valid against patch ${gameDataSnapshot.patch}`);
  if (invalid.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
