import type { GameDataSnapshot } from "@/content/game-data/snapshot";
import { BORROWED_ABILITIES, mechanicsTerm } from "./terms";
import { abilityText, findChampion, plainText } from "./text";
import type { LabelValidation, MechanicsLabel } from "./types";

/**
 * Check a label against the snapshot it claims to quote: the term is defined, the ability is the
 * champion's own, and the quote appears word for word (case-sensitive) in that ability's text.
 */
export function validateLabel(label: MechanicsLabel, snapshot: GameDataSnapshot): LabelValidation {
  if (!mechanicsTerm(label.term)) return { ok: false, reason: "unknown-term" };
  const quote = plainText(label.quote);
  if (quote === "") return { ok: false, reason: "empty-quote" };
  const champion = findChampion(snapshot, label.entityId);
  if (!champion) return { ok: false, reason: "unknown-entity" };
  if (BORROWED_ABILITIES.some((b) => b.entityId === label.entityId && b.ability === label.ability)) {
    return { ok: false, reason: "borrowed-ability" };
  }
  const ability = champion.abilities.find((a) => a.slot === label.ability);
  if (!ability) return { ok: false, reason: "unknown-ability" };
  const text = abilityText(ability, label.sourceField);
  if (text === undefined || !text.includes(quote)) return { ok: false, reason: "quote-not-found" };
  return { ok: true };
}

/** Every label that fails validation, with why. Empty means all labels are valid. */
export function invalidLabels(
  labels: readonly MechanicsLabel[],
  snapshot: GameDataSnapshot,
): { label: MechanicsLabel; reason: string }[] {
  return labels.flatMap((label) => {
    const result = validateLabel(label, snapshot);
    return result.ok ? [] : [{ label, reason: result.reason }];
  });
}
