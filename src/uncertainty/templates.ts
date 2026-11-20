import { bandAt } from "@/builder";
import type { EntityId } from "@/engine";
import { GEM_MAX_TYPICALITY, type ReviewProposal } from "@/reviews";
import { rankByUncertainty, type Ranked, type Uncertainty } from "./rank";

/** What a Template review proposal's uncertainty is judged against. */
export interface TemplateUncertaintyInputs {
  /** The current snapshot's patch, e.g. "16.24.1". */
  patch: string;
  /**
   * Per Template ID: Entities whose Answer Set membership rests on a fact checked before the current
   * snapshot, with why (e.g. a mechanics label on a champion whose ability text changed since the
   * last tagging).
   */
  staleFacts?: Readonly<Record<string, Readonly<Record<EntityId, string>>>>;
}

/** Signal weights: how much each reason adds to a Template review's uncertainty score. */
export const TEMPLATE_WEIGHTS = {
  /** Per `disputable` entry: an Answer Set member players would argue about. */
  disputable: 2,
  /** Per `missing` entry: an Entity outside the Answer Set that may belong in it. */
  missing: 2,
  /** The proposal was reviewed on an older patch than the current snapshot. */
  olderPatch: 2,
  /** Per Answer Set entry resting on a fact older than the current snapshot. */
  staleFact: 1,
  /** Per Gem candidate within `TYPICALITY_MARGIN` of `GEM_MAX_TYPICALITY`: the Gem scores 100. */
  nearGemThreshold: 2,
  /** Per pair of neighbouring answers across a band edge within `TYPICALITY_MARGIN` of each other. */
  nearBandEdge: 1,
} as const;

/** How likely a `/review-template` proposal is to need correcting, from signals code can check. */
export function templateUncertainty(proposal: ReviewProposal, inputs: TemplateUncertaintyInputs): Uncertainty {
  const reasons: string[] = [];
  let score = 0;
  const raise = (weight: number, reason: string) => {
    score += weight;
    reasons.push(reason);
  };

  for (const point of proposal.disputable ?? []) {
    raise(TEMPLATE_WEIGHTS.disputable, `disputable: ${point.entity ?? "(no entity)"} (${point.why})`);
  }
  for (const point of proposal.missing ?? []) {
    raise(TEMPLATE_WEIGHTS.missing, `missing: ${point.entity ?? "(no entity)"} (${point.why})`);
  }
  if (comparePatches(proposal.dataVersion, inputs.patch) < 0) {
    raise(TEMPLATE_WEIGHTS.olderPatch, `reviewed on patch ${proposal.dataVersion}, older than the current snapshot ${inputs.patch}`);
  }
  const staleFacts = inputs.staleFacts?.[proposal.templateId] ?? {};
  for (const id of proposal.answerSet ?? []) {
    if (staleFacts[id]) raise(TEMPLATE_WEIGHTS.staleFact, `stale fact: ${id} (${staleFacts[id]})`);
  }
  const typicality = proposal.typicality ?? {};
  for (const { entity } of proposal.gemCandidates ?? []) {
    const value = typicality[entity]?.value;
    if (typeof value === "number" && near(value, GEM_MAX_TYPICALITY)) {
      raise(
        TEMPLATE_WEIGHTS.nearGemThreshold,
        `Gem candidate ${entity} has Typicality ${value}, near the Gem threshold ${GEM_MAX_TYPICALITY}: a small change decides whether it can be the Gem`,
      );
    }
  }
  for (const [upper, lower] of closeBandEdges(proposal)) {
    raise(
      TEMPLATE_WEIGHTS.nearBandEdge,
      `near a band edge: ${upper.id} (${upper.value}, ${upper.tier}) and ${lower.id} (${lower.value}, ${lower.tier}) ` +
        `are within ${TYPICALITY_MARGIN}: a small change swaps their Tiers`,
    );
  }
  return { score, reasons };
}

/**
 * Neighbouring answers on either side of a band edge whose Typicality estimates are close. Banded
 * as the Builder would with the drafted approval: by estimated Typicality, the first Gem candidate
 * and every Too Clever candidate left out, ties sharing a band.
 */
function closeBandEdges(proposal: ReviewProposal) {
  const typicality = proposal.typicality ?? {};
  const gem = proposal.gemCandidates?.[0]?.entity;
  const tooClever = new Set((proposal.tooClever ?? []).map((c) => c.entity));
  const banded = (proposal.answerSet ?? [])
    .filter((id) => id !== gem && !tooClever.has(id) && typeof typicality[id]?.value === "number")
    .map((id) => ({ id, value: typicality[id].value }))
    .sort((a, b) => b.value - a.value || a.id.localeCompare(b.id));
  let bandStart = 0;
  const tiered = banded.map((entry, i) => {
    if (i > 0 && entry.value !== banded[i - 1].value) bandStart = i;
    return { ...entry, tier: bandAt(bandStart / banded.length) };
  });
  return tiered
    .slice(1)
    .map((lower, i) => [tiered[i], lower] as const)
    .filter(([upper, lower]) => upper.tier !== lower.tier && near(upper.value, lower.value));
}

/** How close (in Typicality) an estimate must be to a Tier boundary to count as near it. */
export const TYPICALITY_MARGIN = 0.05;

const near = (a: number, b: number) => Math.abs(a - b) <= TYPICALITY_MARGIN + 1e-9;

/** Template review proposals, most uncertain first, with reasons. */
export function reviewUncertaintyQueue(
  proposals: readonly ReviewProposal[],
  inputs: TemplateUncertaintyInputs,
): Ranked<ReviewProposal>[] {
  return rankByUncertainty(
    proposals.map((item) => ({ item, ...templateUncertainty(item, inputs) })),
    (p) => p.templateId,
  );
}

/** Numeric comparison of dotted patch versions ("16.9.1" < "16.10.1"). */
function comparePatches(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff) return diff;
  }
  return 0;
}
