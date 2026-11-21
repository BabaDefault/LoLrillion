/**
 * Maintainer script: the review queue and the steps around `/review-template`.
 *
 *   npm run reviews:queue                       Templates to review: approvals failing today's checks first
 *                                               (needs re-approval), then never approved or Answer Set changed;
 *                                               those with a proposal first, most uncertain first, with reasons
 *   npm run reviews:worklist -- <templateId>    write the work file /review-template reads
 *   npm run reviews:validate -- <templateId>    check src/content/reviews/proposals/<templateId>.json
 *   npm run reviews:approve -- <templateId>     draft src/content/reviews/approved/<templateId>.json from
 *                                               the proposal (add --force to replace a valid approved file;
 *                                               one that fails today's checks is replaced without it)
 *
 * Files (see src/content/reviews/README.md for the formats):
 *   proposals/<templateId>.worklist.json   work file (regenerable, not committed)
 *   proposals/<templateId>.json            /review-template's proposal; never read by the Builder
 *   approved/<templateId>.json             the maintainer's approved review; the only file the Builder reads
 */
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { answerSetOf, buildPrompt, esportsVersion, labelTermsOf, isEsportsAnswerType, type BuilderInputs, type TemplateDefinition } from "../src/builder";
import { entityRegistry } from "../src/content/game-data";
import { esportsSnapshot } from "../src/content/esports";
import { gameDataSnapshot } from "../src/content/game-data/snapshot-data";
import { approvedLabels } from "../src/content/labels";
import { changedChampions, mechanicsTerm, type TaggedBaseline } from "../src/labels";
import { approveProposal, checkProposal, reviewQueue, type ReviewProposal } from "../src/reviews";
import { readApprovedReviewFiles } from "../src/reviews/files";
import { templateQueue } from "../src/uncertainty";
import { content, readJson } from "./lib/inputs";

const REVIEWS_DIR = content("reviews");
const proposalFile = (id: string) => `${REVIEWS_DIR}/proposals/${id}.json`;
const approvedFile = (id: string) => `${REVIEWS_DIR}/approved/${id}.json`;
const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";

/**
 * Templates, approved reviews and current Answer Sets. An approval that fails today's checks doesn't
 * stop the script: it comes back in `invalid` (the queue lists it as needing re-approval) and is
 * left out of the Builder inputs.
 */
async function loadInputs() {
  const templates = await readJson<TemplateDefinition[]>(content("templates/templates.json"));
  const { valid: reviews, invalid } = await readApprovedReviewFiles(REVIEWS_DIR);
  const inputs: BuilderInputs = { snapshot: gameDataSnapshot, esports: esportsSnapshot, labels: approvedLabels, reviews };
  const answerSets = Object.fromEntries(templates.map((t) => [t.id, answerSetOf(t, inputs).sort()]));
  return { templates, inputs, reviews, invalid, answerSets };
}

function template(templates: TemplateDefinition[], id: string | undefined): TemplateDefinition {
  const found = templates.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown Template "${id}". Template IDs are in src/content/templates/templates.json.`);
  return found;
}

/**
 * Answer Set entries resting on a fact older than the snapshot: kit Template members whose mechanics
 * label was last checked (`tagged.json`) before their ability text changed.
 */
async function staleFactsFor(t: TemplateDefinition, answerSet: readonly string[]): Promise<Record<string, string>> {
  const terms = labelTermsOf(t.filter);
  if (terms.length === 0) return {};
  const baseline = await readJson<TaggedBaseline>(content("labels/tagged.json"));
  if (!baseline.patch) return {};
  const changed = new Set(changedChampions(gameDataSnapshot, baseline));
  return Object.fromEntries(
    answerSet
      .filter((id) => changed.has(id))
      .map((id) => [id, `its ${terms.join(" and ")} labels were checked on ${baseline.patch}; its ability text changed since`]),
  );
}

async function queue() {
  const { templates, answerSets, reviews, invalid } = await loadInputs();
  const all = reviewQueue(answerSets, reviews, invalid);
  const describe = (e: (typeof all)[number]) => {
    const diff = e.status === "changed" ? ` +${e.added.join(" +")} -${e.removed.join(" -")}`.replace(/ [+-](?= |$)/g, "") : "";
    return `${e.status.padEnd(17)} ${e.templateId.padEnd(36)} ${answerSets[e.templateId].length} Entities${diff}`;
  };

  // Approvals that fail today's checks (e.g. a rule added since): redo them first.
  const reapprove = all.filter((e) => e.status === "needs re-approval");
  if (reapprove.length) {
    console.log("Approvals that fail today's checks (re-approve: npm run reviews:approve -- <templateId>):");
  }
  for (const e of reapprove) {
    const proposal = existsSync(proposalFile(e.templateId)) ? "proposal waiting" : "no proposal: run /review-template first";
    console.log(`     ${describe(e)} (${proposal})`);
    for (const problem of e.problems ?? []) console.log(`       - ${problem}`);
  }
  const entries = all.filter((e) => e.status !== "needs re-approval");

  // Templates with a proposal waiting: most uncertain first, so approval effort goes to likely mistakes.
  const proposals: ReviewProposal[] = [];
  const staleFacts: Record<string, Record<string, string>> = {};
  for (const e of entries) {
    if (!existsSync(proposalFile(e.templateId))) continue;
    proposals.push(await readProposal(e.templateId));
    staleFacts[e.templateId] = await staleFactsFor(template(templates, e.templateId), answerSets[e.templateId]);
  }
  const ranked = templateQueue(proposals, {
    patch: gameDataSnapshot.patch,
    esportsVersion: esportsVersion(esportsSnapshot),
    staleFacts,
  });
  if (ranked.length) console.log("Proposals to approve, most uncertain first (work top-down):");
  for (const { item, score, reasons } of ranked) {
    console.log(`${String(score).padStart(3)}  ${describe(entries.find((e) => e.templateId === item.templateId)!)}`);
    for (const reason of reasons) console.log(`       - ${reason}`);
  }

  const unproposed = entries.filter((e) => !existsSync(proposalFile(e.templateId)));
  if (unproposed.length) console.log("No proposal yet (run /review-template <templateId>):");
  for (const e of unproposed) console.log(`     ${describe(e)}`);
  console.log(
    `${all.length} of ${Object.keys(answerSets).length} Templates need review; ${Object.keys(reviews).length} approved` +
      (reapprove.length ? `, ${reapprove.length} needing re-approval.` : "."),
  );
}

async function worklist(id: string | undefined) {
  const { templates, inputs, reviews, invalid, answerSets } = await loadInputs();
  const t = template(templates, id);
  const entities = new Map(entityRegistry.map((e) => [e.id, e]));
  const inSet = new Set(answerSets[t.id]);
  const built = buildPrompt(t, inputs);
  const [entry] = reviewQueue({ [t.id]: answerSets[t.id] }, reviews, invalid);
  const terms = labelTermsOf(t.filter).flatMap((id) => mechanicsTerm(id) ?? []);

  const work = {
    templateId: t.id,
    dataVersion: built.provenance!.dataVersion,
    text: t.text,
    answerType: t.answerType,
    rule: t.rule,
    filter: t.filter,
    terms: terms.map((term) => ({ id: term.id, definition: term.definition, excludes: term.excludes })),
    queue: entry?.status === "unreviewed" ? { status: entry.status } : (entry ?? { status: "approved, unchanged" }),
    approved: reviews[t.id] ?? invalid[t.id]?.review ?? null,
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
  console.log(`${t.id}: ${work.answerSet.length} Entities on ${work.dataVersion} -> ${file}`);
}

async function readProposal(id: string): Promise<ReviewProposal> {
  if (!existsSync(proposalFile(id))) throw new Error(`No proposal at ${proposalFile(id)}: run /review-template first.`);
  return readJson<ReviewProposal>(proposalFile(id));
}

async function validate(id: string | undefined) {
  const { templates, answerSets, invalid } = await loadInputs();
  const t = template(templates, id);
  for (const other of Object.keys(invalid).filter((other) => other !== t.id)) {
    console.log(`NOTE: ${approvedFile(other)} needs re-approval (npm run reviews:queue lists why).`);
  }
  const approval = invalid[t.id]?.problems ?? [];
  for (const p of approval) console.log(`APPROVAL PROBLEM: ${p}`);
  if (approval.length) console.log(`${approvedFile(t.id)} fails today's checks: re-approve it with npm run reviews:approve -- ${t.id}`);
  const problems = checkProposal(await readProposal(t.id), answerSets[t.id]);
  for (const p of problems) console.log(`PROBLEM: ${p}`);
  console.log(problems.length ? `${problems.length} problems in ${proposalFile(t.id)}` : `${proposalFile(t.id)} is complete.`);
  if (problems.length || approval.length) process.exit(1);
}

async function approve(id: string | undefined) {
  const { templates, answerSets, invalid } = await loadInputs();
  const t = template(templates, id);
  const proposal = await readProposal(t.id);
  const problems = checkProposal(proposal, answerSets[t.id]);
  if (problems.length) throw new Error(`Fix the proposal first (npm run reviews:validate -- ${t.id}):\n${problems.join("\n")}`);
  // An approval that fails today's checks can't reach a Puzzle anyway, so it is replaced without --force.
  const replacingInvalid = Boolean(invalid[t.id]);
  if (existsSync(approvedFile(t.id)) && !replacingInvalid && !process.argv.includes("--force")) {
    throw new Error(`${approvedFile(t.id)} exists; pass --force to replace it.`);
  }
  if (replacingInvalid) console.log(`Replacing ${approvedFile(t.id)}, which failed today's checks.`);
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
