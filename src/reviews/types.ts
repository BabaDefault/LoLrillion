import type { EntityId } from "@/engine";

/** One point the reviewer raises, always with its reason. */
export interface ReviewPoint {
  /** The Entity it is about, if any (`champion:Kaisa`); a name when the Entity isn't in the registry. */
  entity?: string;
  why: string;
}

/**
 * What `/review-template` writes to `src/content/reviews/proposals/<templateId>.json`.
 * Never read by the Builder: nothing here reaches a Puzzle until it is approved.
 */
export interface ReviewProposal {
  templateId: string;
  /** The game data patch the Answer Set was reviewed on. */
  dataVersion: string;
  /** The Answer Set that was reviewed (every Entity ID, as the worklist gave it). */
  answerSet: EntityId[];
  /** Entities that look missing from the Answer Set (may not be in it, so `entity` can be a name). */
  missing: ReviewPoint[];
  /** Entities in the Answer Set whose membership is arguable. */
  disputable: ReviewPoint[];
  /** Ambiguous wording in the Prompt text or Rule, with a suggested fix. */
  wording: Array<{ why: string; suggestion?: string }>;
  /** Spellings players would type that don't resolve to the Entity yet. */
  aliases: Array<{ entity: EntityId; alias: string; why: string }>;
  /** Is this a fun Prompt? A verdict and why. */
  fun: { verdict: "fun" | "ok" | "dull"; why: string };
  /** Estimated Typicality per Entity in the Answer Set: 0 (nobody names it) to 1 (everyone's first answer). */
  typicality: Record<EntityId, { value: number; why: string }>;
  /** Too Clever candidates: seem obscure, but players pick them because they seem obscure. */
  tooClever: Array<{ entity: EntityId; why: string }>;
  /** Exactly three Gem candidates, best first. */
  gemCandidates: Array<{ entity: EntityId; why: string }>;
}

/**
 * An approved Template review: `src/content/reviews/approved/<templateId>.json`, written by
 * `npm run reviews:approve` from a proposal, edited and committed by the maintainer.
 * The only review data the Builder reads (Typicality, Too Clever set, Gem).
 */
export interface ApprovedReview {
  templateId: string;
  /** The game data patch it was approved on. */
  dataVersion: string;
  /** The Answer Set as approved, sorted. The review queue diffs the current Answer Set against it. */
  answerSet: EntityId[];
  /** Approved Typicality per Entity, 0 to 1. Entities left out use the Builder's default. */
  typicality: Record<EntityId, number>;
  /** Approved Too Clever Entities (score 15). */
  tooClever: EntityId[];
  /** The approved Gem (score 100). */
  gem: EntityId;
}

/** A Template waiting for review: never approved, or its Answer Set changed since approval. */
export interface QueueEntry {
  templateId: string;
  status: "unreviewed" | "changed";
  /** In the current Answer Set but not the approved one (everything, when unreviewed). */
  added: EntityId[];
  /** In the approved Answer Set but no longer in the current one. */
  removed: EntityId[];
}
