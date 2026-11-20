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
}

/** A Template turned into a Prompt with its tiered Answer Set. */
export interface BuiltPrompt {
  templateId: string;
  text: string;
  answerType: AnswerType;
  rule: string;
  answerSet: Record<EntityId, Tier>;
}
