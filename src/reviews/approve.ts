import type { ApprovedReview, ReviewProposal } from "./types";

/**
 * Draft an approved review from a proposal: the estimated Typicality values, every Too Clever
 * candidate, the first Gem candidate, and the reviewed Answer Set (sorted). The maintainer edits
 * the draft (other Gem, fewer Too Clever picks, adjusted Typicality) before committing it.
 */
export function approveProposal(proposal: ReviewProposal): ApprovedReview {
  return {
    templateId: proposal.templateId,
    dataVersion: proposal.dataVersion,
    answerSet: [...proposal.answerSet].sort(),
    typicality: Object.fromEntries(Object.entries(proposal.typicality).map(([id, t]) => [id, t.value])),
    tooClever: proposal.tooClever.map((c) => c.entity),
    gem: proposal.gemCandidates[0]?.entity,
  };
}

/**
 * Problems in an approved review file; empty when consistent. Picks are checked against the Answer
 * Set it was approved on. A later data refresh that drops one is the review queue's concern, and the
 * Builder ignores picks that are no longer answers.
 */
export function checkApprovedReview(review: ApprovedReview): string[] {
  const problems: string[] = [];
  const inSet = new Set(review.answerSet ?? []);
  if (!inSet.size) problems.push("answerSet is empty: approve from a proposal with `npm run reviews:approve`");
  for (const [id, value] of Object.entries(review.typicality ?? {})) {
    if (!inSet.has(id)) problems.push(`Typicality for ${id}, which is not in the approved Answer Set`);
    if (!(typeof value === "number" && value >= 0 && value <= 1)) problems.push(`Typicality for ${id} must be between 0 and 1`);
  }
  const tooClever = new Set(review.tooClever ?? []);
  for (const id of tooClever) {
    if (!inSet.has(id)) problems.push(`Too Clever ${id} is not in the approved Answer Set`);
  }
  if (!review.gem) problems.push("No Gem");
  else if (!inSet.has(review.gem)) problems.push(`Gem ${review.gem} is not in the approved Answer Set`);
  else if (tooClever.has(review.gem)) problems.push(`Gem ${review.gem} is also Too Clever`);
  return problems;
}
