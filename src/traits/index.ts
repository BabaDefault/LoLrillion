/**
 * Curated traits: facts about an Entity that no game-data field or ability text shows, so they are
 * judged by hand (an AI proposes, a reviewer approves) and stored with a reason. Visual traits are
 * judged on the champion's base skin. Lore-only traits (regions, Yordles, royalty) stay out: see #22.
 * Approved traits live in `src/content/traits/approved.json`; the Builder's `trait` filter reads them.
 */
import type { AnswerType } from "@/engine";

export interface TraitDefinition {
  id: string;
  /** The Answer Type the trait applies to. */
  answerType: AnswerType;
  /** What counts. Written so it can be shown as a Prompt's Rule. */
  definition: string;
  /** Borderline cases that do NOT count. */
  excludes: string;
}

/** One approved trait: the Entity has it, and `why` says what a player would check to confirm it. */
export interface ApprovedTrait {
  /** e.g. "champion:Corki" or "item:3222". */
  entityId: string;
  trait: string;
  why: string;
}

export const TRAITS = [
  {
    id: "named-after-person",
    answerType: "item",
    definition:
      "The item's name contains the name of a person or character from League's world, usually as a possessive. Roles, creature types, groups (a giant, a warden) and places don't count.",
    excludes:
      "Possessives of a role, creature type or group rather than a named individual (Giant's Belt, Warden's Mail, Guardian's Horn), and named places or objects.",
  },
  {
    id: "one-syllable-name",
    answerType: "champion",
    definition: "The champion's official name is said as a single syllable in standard English pronunciation.",
    excludes: "Names with two or more syllables in their usual pronunciation, even if short (Zoe, Ahri, Ekko).",
  },
  {
    id: "rides-mount",
    answerType: "champion",
    definition:
      "The champion gets around riding something that carries them: a mount, steed, mech or aircraft, an ally, or the terrain itself.",
    excludes:
      "Companions that walk beside them (Annie's Tibbers, Ivern's Daisy), transformations, and being carried only during a single cast (a dash, a knock-up).",
  },
  {
    id: "masked",
    answerType: "champion",
    definition: "On their base skin the champion's face is covered by a mask, helmet or visor. Blindfolds don't count.",
    excludes: "Headbands, hoods, hats or crowns that leave the face visible, face paint, and masks on other skins.",
  },
  {
    id: "non-humanoid",
    answerType: "champion",
    definition:
      "On their base skin the champion is not humanoid: a beast, monster, bird, construct or creature without a human-like body plan (two arms, two legs, upright).",
    excludes:
      "Humanoids with animal features who stand upright (Ahri, Rengar, Warwick), Yordles, armoured or undead humans, and humans riding a creature.",
  },
  {
    id: "uses-gun",
    answerType: "champion",
    definition: "On their base skin the champion fights with a gun or firearm: pistols, rifles, cannons, shotguns, rocket launchers.",
    excludes: "Bows and crossbows, magic, thrown weapons, and guns used only by a different skin.",
  },
  {
    id: "floats",
    answerType: "champion",
    definition: "On their base skin the champion floats, hovers or flies instead of walking on the ground.",
    excludes:
      "Champions who only leave the ground during an ability (dashes, leaps), and riders of a walking mount.",
  },
] as const satisfies readonly TraitDefinition[];

export type TraitId = (typeof TRAITS)[number]["id"];

export function traitDefinition(id: string): TraitDefinition | undefined {
  return TRAITS.find((t) => t.id === id);
}

/** Entity IDs with `trait`, each once, in file order. */
export function entitiesWithTrait(traits: readonly ApprovedTrait[], trait: string): string[] {
  return [...new Set(traits.filter((t) => t.trait === trait).map((t) => t.entityId))];
}
