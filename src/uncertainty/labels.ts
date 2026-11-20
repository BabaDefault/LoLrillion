import type { GameDataSnapshot } from "@/content/game-data/snapshot";
import { mechanicsTerm, prelabel, validateLabel, type LabelRejection, type MechanicsLabel } from "@/labels";
import { rankByUncertainty, uncertaintyTally, type Ranked, type Uncertainty } from "./rank";

/** What a label's uncertainty is judged against. */
export interface LabelUncertaintyInputs {
  /** The snapshot the labels quote (the current patch). */
  snapshot: GameDataSnapshot;
  /** Entity IDs whose ability text changed since the last tagging (`changedChampions`). */
  changed: readonly string[];
}

/** Signal weights: how much each reason adds to a label's uncertainty score. */
export const LABEL_WEIGHTS = {
  /** The keyword pre-labeller found nothing for this term on this Entity: the AI judged it alone. */
  noKeywordEvidence: 3,
  /** The quote itself doesn't name the mechanic. */
  quoteWithoutKeyword: 2,
  /** The term has a look-alike mechanic labellers confuse it with. */
  borderlineTerm: 1,
  /** The short description is vaguer than the tooltip. */
  descriptionQuote: 1,
  /** The Entity's ability text changed this patch. */
  abilityTextChanged: 1,
} as const;

/**
 * How likely a proposed label is to be wrong, from signals code can check (never the AI's own
 * confidence). Assumes the label passes the quote validator; `labelQueue` rejects those that don't.
 */
export function labelUncertainty(label: MechanicsLabel, inputs: LabelUncertaintyInputs): Uncertainty {
  const { raise, result } = uncertaintyTally();

  const term = mechanicsTerm(label.term);
  if (!prelabel(inputs.snapshot, [label.entityId]).some((s) => s.term === label.term)) {
    raise(LABEL_WEIGHTS.noKeywordEvidence, `no keyword evidence: the pre-labeller found no ${label.term} keyword for ${label.entityId}`);
  }
  if (term && !new RegExp(term.keywords.source, "i").test(label.quote)) {
    raise(LABEL_WEIGHTS.quoteWithoutKeyword, `the quote has no ${label.term} keyword`);
  }
  if (term?.borderline) {
    raise(LABEL_WEIGHTS.borderlineTerm, `${label.term} is a borderline term: ${term.borderline}`);
  }
  if (label.sourceField === "description") {
    raise(LABEL_WEIGHTS.descriptionQuote, "quoted from the short description, not the tooltip");
  }
  if (inputs.changed.includes(label.entityId)) {
    raise(LABEL_WEIGHTS.abilityTextChanged, `${label.entityId}'s ability text changed this patch`);
  }
  return result();
}

/**
 * The label review queue: proposed labels most uncertain first, with reasons. Labels whose quote
 * fails the validator are rejected outright, never ranked.
 */
export function labelQueue(
  labels: readonly MechanicsLabel[],
  inputs: LabelUncertaintyInputs,
): { queue: Ranked<MechanicsLabel>[]; rejected: { label: MechanicsLabel; reason: LabelRejection }[] } {
  const valid: Ranked<MechanicsLabel>[] = [];
  const rejected: { label: MechanicsLabel; reason: LabelRejection }[] = [];
  for (const label of labels) {
    const check = validateLabel(label, inputs.snapshot);
    if (check.ok) valid.push({ item: label, ...labelUncertainty(label, inputs) });
    else rejected.push({ label, reason: check.reason });
  }
  return { queue: rankByUncertainty(valid, (l) => `${l.entityId} ${l.term}`), rejected };
}
