import type { EntityId } from "@/engine";
import type { ApprovedReview, ReviewProposal } from "./types";

/** The most typical an approved Gem may be: the top of the 0.05-0.25 range `/review-template` prefers. */
export const GEM_MAX_TYPICALITY = 0.25;

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
 * Builder ignores picks that are no longer in the Answer Set.
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
  else problems.push(...gemObscurityProblems(review, tooClever));
  return problems;
}

/** Why the Gem is not obscure enough, judged from its approved Typicality (Familiarity may not exist). */
function gemObscurityProblems(review: ApprovedReview, tooClever: Set<string>): string[] {
  const gem = review.gem;
  const typicality = review.typicality ?? {};
  const value = typicality[gem];
  if (typeof value !== "number") return [`Gem ${gem} has no Typicality, so its obscurity can't be checked`];
  if (value > GEM_MAX_TYPICALITY) {
    return [`Gem ${gem} has Typicality ${value}, above ${GEM_MAX_TYPICALITY}: pick a rarer Entity`];
  }
  const rank = gemRank(gem, value, { answerSet: review.answerSet, typicality, tooClever });
  if (rank.inLikeliestHalf) {
    return [
      `Gem ${gem} is ${ordinal(rank.place)} of ${rank.count} by Typicality, in the likeliest half of the Answer Set (Too Clever left out): pick a rarer Entity`,
    ];
  }
  return [];
}

/**
 * Where a Gem with Typicality `value` would rank in an Answer Set by Typicality (1 = likeliest), Too
 * Clever picks and Entities without a Typicality left out, ties in the Gem's favour; and whether
 * that is in the likeliest half, which an approved Gem may not be (#18). `value` is passed apart
 * from `typicality` so callers can ask "what if its estimate were a little different?".
 */
export function gemRank(
  gem: EntityId,
  value: number,
  set: {
    answerSet: readonly EntityId[];
    typicality: Readonly<Record<EntityId, number>>;
    tooClever: ReadonlySet<EntityId>;
  },
): { place: number; count: number; inLikeliestHalf: boolean } {
  const inSet = new Set(set.answerSet);
  const ranked = Object.entries(set.typicality).filter(([id]) => id !== gem && !set.tooClever.has(id) && inSet.has(id));
  const likelier = ranked.filter(([, t]) => t >= value).length;
  const count = ranked.length + 1;
  return { place: likelier + 1, count, inLikeliestHalf: likelier < Math.floor(count / 2) };
}

export function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
}
