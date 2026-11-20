/**
 * Mechanics labels: shared term definitions, the quote validator, keyword pre-labelling, the
 * changed-champions check for `/tag-patch`, and Answer Set queries over approved labels.
 * Pure: everything takes the snapshot or labels as arguments.
 */
export { BORROWED_ABILITIES, MECHANICS_TERMS, mechanicsTerm } from "./terms";
export type { MechanicsTerm, MechanicsTermId } from "./terms";
export { abilityText, plainText } from "./text";
export { invalidLabels, validateLabel } from "./validate";
export type { LabelRejection, LabelValidation, MechanicsLabel, SourceField } from "./types";
export { prelabel } from "./prelabel";
export type { LabelSuggestion } from "./prelabel";
export { changedChampions, taggedBaseline } from "./changes";
export type { TaggedBaseline } from "./changes";
