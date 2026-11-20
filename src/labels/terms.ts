/**
 * The shared definitions of the mechanics terms that kit-based Templates filter on. The keyword
 * pre-label script, the `/tag-patch` skill and the Rules shown with Prompts all use these.
 *
 * Standard scope for every term: the champion's own base kit on the current patch. Stolen or
 * copied abilities don't count (see `BORROWED_ABILITIES`).
 */
export interface MechanicsTerm {
  id: string;
  /** Short player-facing name, e.g. "Invisible". */
  name: string;
  /** What counts. Written so it can be shown as a Prompt's Rule. */
  definition: string;
  /** Borderline cases that do NOT count, for labellers. */
  excludes: string;
  /** Ability-text keywords the pre-label script looks for. Suggestions only. */
  keywords: RegExp;
}

export const MECHANICS_TERMS = [
  {
    id: "invisible",
    name: "Invisible",
    definition:
      "One of the champion's own abilities makes them Invisible or Camouflaged, even if only after an upgrade or evolution (e.g. Kai'Sa's evolved Supercharge).",
    excludes:
      "Ghosted, untargetable, stasis, brush, or hiding a cast without the champion turning Invisible/Camouflaged.",
    keywords: /\b(invisib(?:le|ility)|camouflag(?:e|ed))\b/gi,
  },
  {
    id: "dash",
    name: "Dash",
    definition:
      "One of the champion's own abilities moves them quickly across the ground or through the air to a location or target: dashes, leaps, lunges and hops all count.",
    excludes: "Blinks and teleports (instant relocation), Flash, and Move Speed boosts.",
    keywords: /\b(dash(?:es|ing|ed)?|leap(?:s|ing|ed)?|lunge(?:s|d)?|hop(?:s|ping)?)\b/gi,
  },
  {
    id: "pull",
    name: "Pull",
    definition:
      "One of the champion's own abilities forcibly moves an enemy toward the champion or toward a point (hooks, pulls, drags).",
    excludes:
      "Pulling the champion themselves to a target (that's a dash), knock-backs or tosses in any direction, and effects that only draw back a curse or projectile without moving the enemy.",
    keywords: /\b(pull(?:s|ing|ed)?|drag(?:s|ging|ged)?|hook(?:s|ed)?|yank(?:s|ed)?)\b/gi,
  },
  {
    id: "stun",
    name: "Stun",
    definition: "One of the champion's own abilities Stuns an enemy, including conditional stuns (e.g. into a wall).",
    excludes: "Roots, snares, sleeps, charms, fears, taunts, suppressions and knock-ups.",
    keywords: /\bstun(?:s|ned|ning)?\b/gi,
  },
  {
    id: "knock-up",
    name: "Knock-up",
    definition: "One of the champion's own abilities Knocks Up (airborne in place or lifted) an enemy.",
    excludes: "Knock-backs and knock-asides, pulls, and the champion leaping into the air themselves.",
    keywords: /\bknock(?:s|ing|ed)?[ -]up\b/gi,
  },
  {
    id: "global-ult",
    name: "Global ultimate",
    definition:
      "The champion's own ultimate (R) can reach any point on the map: unlimited range or map-wide effect.",
    excludes: "Long but limited range ults, and ults the champion steals or copies from someone else.",
    keywords: /\b(global(?:ly)?|anywhere on the map|unlimited range|all (?:enemy|allied) champions|every enemy champion)\b/gi,
  },
] as const satisfies readonly MechanicsTerm[];

export type MechanicsTermId = (typeof MECHANICS_TERMS)[number]["id"];

export function mechanicsTerm(id: string): MechanicsTerm | undefined {
  return MECHANICS_TERMS.find((t) => t.id === id);
}

/**
 * Abilities whose effects are borrowed from other champions, so they never count as evidence for a
 * label: Sylas steals ultimates, Viego possesses champions, Neeko disguises as them.
 */
export const BORROWED_ABILITIES: readonly { entityId: string; ability: string; why: string }[] = [
  { entityId: "champion:Sylas", ability: "R", why: "Hijack casts a stolen enemy ultimate." },
  { entityId: "champion:Viego", ability: "P", why: "Possession borrows the dead enemy's abilities." },
  { entityId: "champion:Neeko", ability: "P", why: "Inherent Glamour copies another unit's look." },
];
