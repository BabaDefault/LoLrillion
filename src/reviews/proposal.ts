import type { EntityId } from "@/engine";
import type { ReviewProposal } from "./types";

export const GEM_CANDIDATES = 3;

const sameSet = (a: readonly string[], b: readonly string[]) => {
  const set = new Set(a);
  return set.size === new Set(b).size && b.every((id) => set.has(id));
};

const inUnitRange = (n: unknown) => typeof n === "number" && n >= 0 && n <= 1;

/**
 * Problems with a `/review-template` proposal against the Template's current Answer Set; empty when
 * it is complete. Checks structure and Entity IDs only; whether the judgements are right is the
 * maintainer's call.
 */
export function checkProposal(proposal: ReviewProposal, currentAnswerSet: readonly EntityId[]): string[] {
  const problems: string[] = [];
  const inSet = new Set(currentAnswerSet);

  if (!sameSet(proposal.answerSet ?? [], currentAnswerSet)) {
    problems.push("The proposal's Answer Set is not the Template's current Answer Set: re-run the worklist and review again");
  }

  const typicality = proposal.typicality ?? {};
  for (const id of currentAnswerSet) {
    const estimate = typicality[id];
    if (!estimate) problems.push(`No Typicality estimate for ${id}`);
    else if (!inUnitRange(estimate.value)) problems.push(`Typicality for ${id} must be between 0 and 1`);
    else if (!estimate.why?.trim()) problems.push(`Typicality for ${id} needs a reason`);
  }
  for (const id of Object.keys(typicality)) {
    if (!inSet.has(id)) problems.push(`Typicality given for ${id}, which is not in the Answer Set`);
  }

  const tooClever = new Set<EntityId>();
  for (const { entity } of proposal.tooClever ?? []) {
    if (!inSet.has(entity)) problems.push(`Too Clever candidate ${entity} is not in the Answer Set`);
    tooClever.add(entity);
  }

  const gems = proposal.gemCandidates ?? [];
  if (gems.length !== GEM_CANDIDATES || new Set(gems.map((g) => g.entity)).size !== gems.length) {
    problems.push(`Give exactly ${GEM_CANDIDATES} Gem candidates, all different`);
  }
  for (const { entity, why } of gems) {
    if (!inSet.has(entity)) problems.push(`Gem candidate ${entity} is not in the Answer Set`);
    else if (tooClever.has(entity)) problems.push(`Gem candidate ${entity} is also a Too Clever candidate`);
    else if (!why?.trim()) problems.push(`Gem candidate ${entity} needs a reason`);
  }

  return problems;
}
