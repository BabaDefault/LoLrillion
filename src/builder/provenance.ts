import { createHash } from "node:crypto";
import { labelTermsOf, traitIdsOf } from "./answer-set";
import { esportsVersion, isEsportsAnswerType, requireEsports } from "./esports";
import type { BuilderInputs, BuiltPrompt, PromptProvenance, ScoringConstants, TemplateDefinition } from "./types";

/**
 * Which inputs produced a Prompt's Answer Set and Tiers. Hashes are of canonical JSON (sorted
 * keys), so formatting or key order in a content file never changes them. Server-only.
 */
export function provenanceOf(template: TemplateDefinition, inputs: BuilderInputs, scoring: ScoringConstants): PromptProvenance {
  const review = inputs.reviews?.[template.id];
  const common = {
    review: review ? contentHash(review) : "unreviewed",
    labels: curatedFactsHash(labelTermsOf(template.filter), traitIdsOf(template.filter), inputs),
    scoring: contentHash(scoring),
  };
  if (isEsportsAnswerType(template.answerType)) {
    // Esports Answer Sets and Familiarity both come from the esports snapshot.
    const esports = requireEsports(inputs);
    const version = esportsVersion(esports);
    return { ...common, dataVersion: version, familiarity: { patch: version, hash: contentHash(esports) } };
  }
  const { familiarity } = inputs;
  return {
    ...common,
    dataVersion: inputs.snapshot.patch,
    familiarity: familiarity ? { patch: familiarity.patch, hash: contentHash(familiarity) } : "none",
  };
}

/** How a stored Prompt compares with the same Template rebuilt from today's inputs. */
export interface PromptExplanation {
  /** `same`: identical Answer Set, Tiers and provenance. `no-provenance`: built before it was recorded. */
  status: "same" | "changed" | "no-provenance";
  /** The provenance fields that differ (empty without stored provenance). */
  changedInputs: (keyof PromptProvenance)[];
  /** Whether the rebuild gives a different Answer Set or different Tiers. */
  answerSetOrTiersChanged: boolean;
}

/** Compare a stored Prompt with a rebuild of its Template, naming the inputs that changed. */
export function explainPrompt(stored: BuiltPrompt, rebuilt: BuiltPrompt): PromptExplanation {
  const answerSetOrTiersChanged = canonical(stored.answerSet) !== canonical(rebuilt.answerSet);
  const before = stored.provenance;
  const after = rebuilt.provenance;
  if (!before || !after) return { status: "no-provenance", changedInputs: [], answerSetOrTiersChanged };
  const changedInputs = PROVENANCE_FIELDS.filter((k) => canonical(before[k]) !== canonical(after[k]));
  const same = !answerSetOrTiersChanged && changedInputs.length === 0;
  return { status: same ? "same" : "changed", changedInputs, answerSetOrTiersChanged };
}

const PROVENANCE_FIELDS: readonly (keyof PromptProvenance)[] = ["dataVersion", "review", "labels", "familiarity", "scoring"];

/**
 * The approved labels a filter reads, those with its terms in a stable order. One term hashes its labels
 * alone (as before combined filters), several hash the list per term.
 */
function labelsHash(terms: readonly string[], inputs: BuilderInputs): string {
  if (terms.length === 0) return "unused";
  if (terms.length === 1) return contentHash(labelsUsed(terms[0], inputs));
  return contentHash(terms.map((term) => labelsUsed(term, inputs)));
}

/**
 * The hand-approved facts a filter reads: its mechanics labels and its curated traits. Filters that read
 * only labels hash exactly as before traits existed; one trait alone hashes its traits list.
 */
function curatedFactsHash(terms: readonly string[], traitIds: readonly string[], inputs: BuilderInputs): string {
  if (traitIds.length === 0) return labelsHash(terms, inputs);
  if (terms.length === 0 && traitIds.length === 1) return contentHash(traitsUsed(traitIds[0], inputs));
  return contentHash({
    labels: terms.map((term) => labelsUsed(term, inputs)),
    traits: traitIds.map((id) => traitsUsed(id, inputs)),
  });
}

function traitsUsed(trait: string, { traits = [] }: BuilderInputs): string[] {
  return traits
    .filter((t) => t.trait === trait)
    .map(canonical)
    .sort();
}

function labelsUsed(term: string, { labels = [] }: BuilderInputs): string[] {
  return labels
    .filter((l) => l.term === term)
    .map(canonical)
    .sort();
}

/** `sha256:` and the first 16 hex digits of the SHA-256 of `value`'s canonical JSON. */
export function contentHash(value: unknown): string {
  return `sha256:${createHash("sha256").update(canonical(value)).digest("hex").slice(0, 16)}`;
}

function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((k) => [k, sortKeys(record[k])]),
    );
  }
  return value;
}
