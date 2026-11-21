import type { AbilitySlot } from "@/content/game-data/snapshot";

/** Which Data Dragon text a quote comes from. */
export type SourceField = "description" | "tooltip";

/**
 * One mechanics label: the Entity has the term, with an exact quote from its ability text as
 * evidence. Approved labels live in `src/content/labels/approved.json`.
 */
export interface MechanicsLabel {
  /** e.g. "champion:Kaisa". */
  entityId: string;
  /** A `MECHANICS_TERMS` id, e.g. "invisible". */
  term: string;
  ability: AbilitySlot;
  /** Word for word from the ability's `sourceField` text, after `abilityText` normalisation. */
  quote: string;
  sourceField: SourceField;
  /**
   * Set only when the ability text can't show the term but the game does (e.g. Ashe's R has
   * unlimited range, though its text never says so). The quote then just identifies the ability,
   * and this says what the game does instead. Use sparingly: the text is the default evidence.
   */
  inGame?: string;
}

export type LabelRejection =
  | "unknown-term"
  | "unknown-entity"
  | "unknown-ability"
  | "empty-quote"
  | "quote-not-found"
  | "borrowed-ability";

export type LabelValidation = { ok: true } | { ok: false; reason: LabelRejection };
