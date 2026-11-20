import type { GameDataSnapshot } from "@/content/game-data/snapshot";
import { championEntityId } from "@/content/game-data/build-registry";
import { BORROWED_ABILITIES, MECHANICS_TERMS } from "./terms";
import { abilityText } from "./text";
import type { MechanicsLabel, SourceField } from "./types";

/** A keyword match proposed as a label. A suggestion only: a reviewer decides. */
export interface LabelSuggestion extends MechanicsLabel {
  /** The exact word(s) the keyword matched. */
  matched: string;
}

const FIELDS: readonly SourceField[] = ["description", "tooltip"];

/**
 * Scan ability text for each term's keywords. Each suggestion quotes the whole sentence the keyword
 * matched in, so its quote passes `validateLabel`. Pass `entityIds` to scan only some champions.
 */
export function prelabel(snapshot: GameDataSnapshot, entityIds?: readonly string[]): LabelSuggestion[] {
  const wanted = entityIds && new Set(entityIds);
  const suggestions: LabelSuggestion[] = [];
  for (const champion of snapshot.champions) {
    const entityId = championEntityId(champion.id);
    if (wanted && !wanted.has(entityId)) continue;
    for (const ability of champion.abilities) {
      if (BORROWED_ABILITIES.some((b) => b.entityId === entityId && b.ability === ability.slot)) continue;
      for (const sourceField of FIELDS) {
        const text = abilityText(ability, sourceField);
        if (!text) continue;
        for (const sentence of text.split(/(?<=[.!?])\s+/)) {
          for (const term of MECHANICS_TERMS) {
            const match = sentence.match(new RegExp(term.keywords.source, "i"));
            if (match) {
              suggestions.push({
                entityId,
                term: term.id,
                ability: ability.slot,
                sourceField,
                matched: match[0],
                quote: sentence,
              });
            }
          }
        }
      }
    }
  }
  return suggestions;
}
