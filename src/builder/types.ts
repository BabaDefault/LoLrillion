import type { GameDataSnapshot } from "@/content/game-data/snapshot";
import type { FamiliarityFile } from "@/content/familiarity/types";
import type { MechanicsLabel } from "@/labels";
import type { AnswerType, EntityId, Tier } from "@/engine";

/** An approved mechanics label (#9), from `approvedLabels` in `@/content/labels`. */
export type ApprovedLabel = MechanicsLabel;

/** Familiarity for one patch (#11): `src/content/familiarity/<snapshot patch>.json`, shares from 0 to 1. */
export type FamiliarityData = FamiliarityFile;

/**
 * The review data the Builder reads for one Template: the subset of an approved review file
 * (`ApprovedReview` in `@/reviews`, read by `readApprovedReviews`). Everything is optional:
 * a Template with no review uses default Typicality, no Too Clever answers and a default Gem.
 */
export interface TemplateReview {
  templateId: string;
  /** Approved Typicality per Entity, 0 (never comes to mind) to 1 (the first answer anyone gives). */
  typicality?: Readonly<Record<EntityId, number>>;
  /** Approved Too Clever Entities (score 15). */
  tooClever?: readonly EntityId[];
  /** The approved Gem. */
  gem?: EntityId;
}

/** Which Entities a Template's Answer Set holds. Data, so Templates can live in JSON. */
export type TemplateFilter =
  | { kind: "champion-label"; term: string }
  | { kind: "champion-name-length"; atMost: number }
  | { kind: "item-stat"; stat: string }
  /** Skins whose name has `word` as a whole word, or (with `prefix`) a word starting with it. */
  | { kind: "skin-name-word"; word: string; prefix?: boolean };

/** A reusable definition that produces a Prompt and its Answer Set from the game data. */
export interface TemplateDefinition {
  id: string;
  text: string;
  answerType: AnswerType;
  rule: string;
  filter: TemplateFilter;
}

/** Everything the Builder reads. Labels, Familiarity and reviews are optional until they exist. */
export interface BuilderInputs {
  snapshot: GameDataSnapshot;
  labels?: readonly ApprovedLabel[];
  familiarity?: FamiliarityData;
  reviews?: Readonly<Record<string, TemplateReview>>;
  /** The Builder's scoring constants; `SCORING_CONSTANTS` when absent. */
  scoring?: ScoringConstants;
}

/** The constants that turn Priors into Tiers. */
export interface ScoringConstants {
  /** How much Familiarity weighs in the Prior when it exists; Typicality is the rest. */
  familiarityWeight: number;
  /** Share of the normally-banded answers in Minion, Kill and Triple Kill; the rest is Quadra Kill. */
  bandShares: { readonly minion: number; readonly kill: number; readonly "triple-kill": number };
  /** Without an approved Gem: position from likeliest (0) to least likely (1) of the default Gem. */
  defaultGemPosition: number;
}

/**
 * Which inputs produced a Prompt's Answer Set and Tiers, so a past result can be explained after a
 * review, label or constant changes. Hashes are `sha256:<16 hex>` of canonical JSON. Server-only:
 * never served to a player.
 */
export interface PromptProvenance {
  /** The game data patch. */
  dataVersion: string;
  /** Hash of the Template's approved review, or `"unreviewed"` when defaults were used. */
  review: string;
  /** Hash of the approved labels a `champion-label` filter read, or `"unused"` for other filters. */
  labels: string;
  /** The Familiarity file used (its patch and a hash of its contents), or `"none"`. */
  familiarity: { patch: string; hash: string } | "none";
  /** Hash of the scoring constants. */
  scoring: string;
}

/** A Template turned into a Prompt with its tiered Answer Set. */
export interface BuiltPrompt {
  templateId: string;
  text: string;
  answerType: AnswerType;
  rule: string;
  answerSet: Record<EntityId, Tier>;
  /** Absent on Puzzles built before provenance was recorded; filled in when they're next rebuilt. */
  provenance?: PromptProvenance;
}
