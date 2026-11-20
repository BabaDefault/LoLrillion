import { createHash } from "node:crypto";
import type { BuilderInputs, BuiltPrompt, PromptProvenance, ScoringConstants, TemplateDefinition } from "./types";

/**
 * Which inputs produced a Prompt's Answer Set and Tiers. Hashes are of canonical JSON (sorted
 * keys), so formatting or key order in a content file never changes them. Server-only.
 */
export function provenanceOf(template: TemplateDefinition, inputs: BuilderInputs, scoring: ScoringConstants): PromptProvenance {
  const review = inputs.reviews?.[template.id];
  const { familiarity } = inputs;
  return {
    dataVersion: inputs.snapshot.patch,
    review: review ? contentHash(review) : "unreviewed",
    labels: template.filter.kind === "champion-label" ? contentHash(labelsUsed(template.filter.term, inputs)) : "unused",
    familiarity: familiarity ? { patch: familiarity.patch, hash: contentHash(familiarity) } : "none",
    scoring: contentHash(scoring),
  };
}

/** How a stored Prompt compares with the same Template rebuilt from today's inputs. */
export interface PromptExplanation {
  /** `same`: identical Answer Set, Tiers and provenance. `no-provenance`: built before it was recorded. */
  status: "same" | "changed" | "no-provenance";
  /** The provenance fields that differ (empty without stored provenance). */
  changedInputs: (keyof PromptProvenance)[];
  /** Whether the rebuild gives a different Answer Set or different Tiers. */
  tiersChanged: boolean;
}

/** Compare a stored Prompt with a rebuild of its Template, naming the inputs that changed. */
export function explainPrompt(stored: BuiltPrompt, rebuilt: BuiltPrompt): PromptExplanation {
  const tiersChanged = canonical(stored.answerSet) !== canonical(rebuilt.answerSet);
  const before = stored.provenance;
  const after = rebuilt.provenance;
  if (!before || !after) return { status: "no-provenance", changedInputs: [], tiersChanged };
  const changedInputs = PROVENANCE_FIELDS.filter((k) => canonical(before[k]) !== canonical(after[k]));
  const same = !tiersChanged && changedInputs.length === 0;
  return { status: same ? "same" : "changed", changedInputs, tiersChanged };
}

const PROVENANCE_FIELDS: readonly (keyof PromptProvenance)[] = ["dataVersion", "review", "labels", "familiarity", "scoring"];

/** The approved labels a `champion-label` filter reads: those with its term, in a stable order. */
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
