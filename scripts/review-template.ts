/**
 * Maintainer script: the review queue and the steps around `/review-template`.
 *
 *   npm run reviews:queue                       Templates to review: never approved, or Answer Set changed
 *   npm run reviews:worklist -- <templateId>    write the work file /review-template reads
 *   npm run reviews:validate -- <templateId>    check src/content/reviews/proposals/<templateId>.json
 *   npm run reviews:approve -- <templateId>     draft src/content/reviews/approved/<templateId>.json from
 *                                               the proposal (add --force to replace an approved file)
 *
 * Files (see src/content/reviews/README.md for the formats):
 *   proposals/<templateId>.worklist.json   work file (regenerable, not committed)
 *   proposals/<templateId>.json            /review-template's proposal; never read by the Builder
 *   approved/<templateId>.json             the maintainer's approved review; the only file the Builder reads
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { answerSetOf, buildPrompt, type BuilderInputs, type TemplateDefinition } from "../src/builder";
import { entityRegistry } from "../src/content/game-data";
import { gameDataSnapshot } from "../src/content/game-data/snapshot-data";
import { approvedLabels } from "../src/content/labels";
import { mechanicsTerm } from "../src/labels";
import { approveProposal, checkProposal, reviewQueue, type ReviewProposal } from "../src/reviews";
import { readApprovedReviews } from "../src/reviews/files";

const content = (path: string) => fileURLToPath(new URL(`../src/content/${path}`, import.meta.url));
const REVIEWS_DIR = content("reviews");
const proposalFile = (id: string) => `${REVIEWS_DIR}/proposals/${id}.json`;
const approvedFile = (id: string) => `${REVIEWS_DIR}/approved/${id}.json`;
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";

async function loadInputs() {
  const templates = JSON.parse(await readFile(content("templates/templates.json"), "utf8")) as TemplateDefinition[];
  const reviews = await readApprovedReviews(REVIEWS_DIR);
  const inputs: BuilderInputs = { snapshot: gameDataSnapshot, labels: approvedLabels, reviews };
  const answerSets = Object.fromEntries(templates.map((t) => [t.id, answerSetOf(t, inputs).sort()]));
  return { templates, inputs, reviews, answerSets };
}

function template(templates: TemplateDefinition[], id: string | undefined): TemplateDefinition {
  const found = templates.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown Template "${id}". Template IDs are in src/content/templates/templates.json.`);
  return found;
}

async function queue() {
  const { answerSets, reviews } = await loadInputs();
  const entries = reviewQueue(answerSets, reviews);
  for (const e of entries) {
    const diff = e.status === "changed" ? ` +${e.added.join(" +")} -${e.removed.join(" -")}`.replace(/ [+-](?= |$)/g, "") : "";
    console.log(`${e.status.padEnd(10)} ${e.templateId.padEnd(36)} ${answerSets[e.templateId].length} answers${diff}`);
  }
  console.log(`${entries.length} of ${Object.keys(answerSets).length} Templates need review; ${Object.keys(reviews).length} approved.`);
}

async function worklist(id: string | undefined) {
  const { templates, inputs, reviews, answerSets } = await loadInputs();
  const t = template(templates, id);
  const entities = new Map(entityRegistry.map((e) => [e.id, e]));
  const inSet = new Set(answerSets[t.id]);
  const built = buildPrompt(t, inputs);
  const [entry] = reviewQueue({ [t.id]: answerSets[t.id] }, reviews);
  const term = t.filter.kind === "champion-label" ? mechanicsTerm(t.filter.term) : undefined;

  const work = {
    templateId: t.id,
    dataVersion: gameDataSnapshot.patch,
    text: t.text,
    answerType: t.answerType,
    rule: t.rule,
    filter: t.filter,
    term: term && { id: term.id, definition: term.definition, excludes: term.excludes },
    queue: entry?.status === "changed" ? entry : { status: entry?.status ?? "approved, unchanged" },
    approved: reviews[t.id] ?? null,
    answerSet: answerSets[t.id].map((entity) => ({
      entity,
      name: entities.get(entity)?.name,
      aliases: entities.get(entity)?.aliases ?? [],
      currentTier: built.answerSet[entity],
    })),
    notInAnswerSet: entityRegistry.filter((e) => e.answerType === t.answerType && !inSet.has(e.id)).map((e) => e.name),
  };
  await mkdir(`${REVIEWS_DIR}/proposals`, { recursive: true });
  const file = `${REVIEWS_DIR}/proposals/${t.id}.worklist.json`;
  await writeFile(file, json(work));
  console.log(`${t.id}: ${work.answerSet.length} answers on patch ${work.dataVersion} -> ${file}`);
}

async function readProposal(id: string): Promise<ReviewProposal> {
  if (!existsSync(proposalFile(id))) throw new Error(`No proposal at ${proposalFile(id)}: run /review-template first.`);
  return JSON.parse(await readFile(proposalFile(id), "utf8")) as ReviewProposal;
}

async function validate(id: string | undefined) {
  const { templates, answerSets } = await loadInputs();
  const t = template(templates, id);
  const problems = checkProposal(await readProposal(t.id), answerSets[t.id]);
  for (const p of problems) console.log(`PROBLEM: ${p}`);
  console.log(problems.length ? `${problems.length} problems in ${proposalFile(t.id)}` : `${proposalFile(t.id)} is complete.`);
  if (problems.length) process.exit(1);
}

async function approve(id: string | undefined) {
  const { templates, answerSets } = await loadInputs();
  const t = template(templates, id);
  const proposal = await readProposal(t.id);
  const problems = checkProposal(proposal, answerSets[t.id]);
  if (problems.length) throw new Error(`Fix the proposal first (npm run reviews:validate -- ${t.id}):\n${problems.join("\n")}`);
  if (existsSync(approvedFile(t.id)) && !process.argv.includes("--force")) {
    throw new Error(`${approvedFile(t.id)} exists; pass --force to replace it.`);
  }
  await mkdir(`${REVIEWS_DIR}/approved`, { recursive: true });
  await writeFile(approvedFile(t.id), json(approveProposal(proposal)));
  console.log(
    `Drafted ${approvedFile(t.id)} (Gem = first candidate, every Too Clever candidate). ` +
      "Edit it, then commit it and run npm test and npm run puzzles:build.",
  );
}

async function main() {
  const [command, id] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  switch (command) {
    case "queue":
      return queue();
    case "worklist":
      return worklist(id);
    case "validate":
      return validate(id);
    case "approve":
      return approve(id);
    default:
      throw new Error("Usage: tsx scripts/review-template.ts queue | worklist <id> | validate <id> | approve <id> [--force]");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
