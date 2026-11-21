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
  /**
   * Set when the term sits next to a look-alike mechanic that labellers often confuse it with
   * (e.g. dash vs blink). Labels for it rank higher in the label review queue.
   */
  borderline?: string;
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
    borderline: "dash vs blink or teleport",
  },
  {
    id: "pull",
    name: "Pull",
    definition:
      "One of the champion's own abilities forcibly moves an enemy toward the champion or toward a point (hooks, pulls, drags).",
    excludes:
      "Pulling the champion themselves to a target (that's a dash), knock-backs or tosses in any direction, and effects that only draw back a curse or projectile without moving the enemy.",
    keywords: /\b(pull(?:s|ing|ed)?|drag(?:s|ging|ged)?|hook(?:s|ed)?|yank(?:s|ed)?)\b/gi,
    borderline: "pull vs knock-back, or a self-pull (a dash)",
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
    borderline: "knock-up vs knock-back",
  },
  {
    id: "global-ult",
    name: "Global ultimate",
    definition:
      "The champion's own ultimate (R) can reach any point on the map: unlimited range or map-wide effect.",
    excludes: "Long but limited range ults, and ults the champion steals or copies from someone else.",
    keywords: /\b(global(?:ly)?|anywhere on the map|unlimited range|all (?:enemy|allied) champions|every enemy champion)\b/gi,
  },
  {
    id: "infinite-scaling",
    name: "Infinite scaling",
    definition:
      "One of the champion's own abilities grants permanent stacks with no maximum that keep increasing a stat or damage for the rest of the game.",
    excludes:
      "Stacks that cap or are lost on death, temporary stacks, item or rune stacks (Mejai's, Dark Seal, Conqueror), and once-per-game upgrades with a fixed end (Kai'Sa's evolutions).",
    keywords: /\b(permanent(?:ly)?|no (?:maximum|cap|limit)|unlimited|stack(?:s|ing)?)\b/gi,
  },
  {
    id: "zero-damage-ult",
    name: "Zero-damage ultimate",
    definition:
      "Casting the champion's own ultimate (R) never damages an enemy by itself: it only crowd-controls, buffs, heals, shields, moves, transforms or empowers their next attacks or abilities. Damage dealt by a unit the ultimate summons counts as damage.",
    excludes:
      "Ultimates that deal any damage, including through a unit they summon (Yorick's Maiden, Ivern's Daisy, Annie's Tibbers, Elise's Spiderlings) or a hit they themselves cause (a damaging knock-back or landing).",
    keywords: /\b(transform(?:s|ing)?|empower(?:s|ed)?|untargetable|invulnerab(?:le|ility)|stasis|revive(?:s)?|teleport(?:s)?)\b/gi,
    borderline: "no damage at all vs damage through a summoned unit",
  },
  {
    id: "three-hit",
    name: "Three-hit effect",
    definition:
      "One of the champion's own abilities triggers an effect on every third attack, hit or cast, or when three hits or stacks land on the same target. Items and runes don't count.",
    excludes:
      "Items and runes (Kraken Slayer, Electrocute), counts other than three (four-shot or five-stack effects), and empowering each of the next three attacks with nothing special on the third.",
    keywords: /\b(third|three|3 (?:hits|stacks|attacks)|3rd)\b/gi,
  },
  {
    id: "true-sight",
    name: "True Sight",
    definition:
      "One of the champion's own abilities reveals enemies even while they are Invisible or Camouflaged (True Sight, or revealing a target through stealth).",
    excludes: "Plain vision or reveal that stealthed enemies avoid, wards and trinkets, and Control Wards.",
    keywords: /\b(true sight|reveal(?:s|ed|ing)?)\b/gi,
  },
  {
    id: "terrain",
    name: "Wall enemies can't cross",
    definition:
      "One of the champion's own abilities creates terrain or a barrier enemies can't walk through: an impassable wall, pillar, ring or arena. Walls that only slow, stun or damage enemies walking through don't count.",
    excludes: "Walls that only slow, stun or damage enemies who walk through them (Thresh's The Box, Irelia's Vanguard's Edge, Veigar's Event Horizon, Aurora's Between Worlds), projectile walls (Yasuo's Wind Wall), and dashing over terrain.",
    keywords: /\b(terrain|impassable|wall|pillar|arena)\b/gi,
  },
  {
    id: "untargetable",
    name: "Untargetable",
    definition:
      "One of the champion's own abilities makes them Untargetable, even briefly or only mid-cast, including Stasis. Invisibility and invulnerability don't count.",
    excludes: "Invisibility, Camouflage, invulnerability while still targetable (Kayle's ult, Taric's ult), and spell shields.",
    keywords: /\b(untargetable|stasis)\b/gi,
    borderline: "untargetable vs invulnerable or invisible",
  },
  {
    id: "takedown-reset",
    name: "Reset on takedown",
    definition:
      "One of the champion's own abilities has its cooldown reset, refunded or reduced, or can be recast, when the champion gets a takedown (kill or assist) on an enemy champion.",
    excludes: "Resets on killing minions or monsters only, refunds on hitting (not killing) a target, and item effects.",
    keywords: /\b(takedowns?|kills? (?:or assists?|an enemy champion)|reset(?:s)?|refund(?:s|ed)?)\b/gi,
  },
  {
    id: "non-mana-resource",
    name: "Non-Mana resource",
    definition:
      "The champion's resource bar is something other than Mana (Energy, Fury and the like). Champions with no resource bar don't count.",
    excludes:
      "Manaless champions with no resource bar (Garen, Riven, Katarina), champions who only pay Health (Dr. Mundo, Zac), and secondary stack counters next to a Mana bar.",
    keywords: /\b(energy|fury|rage|heat|ferocity|flow|grit|bloodthirst|courage|frenzy)\b/gi,
  },
  {
    id: "death-defy",
    name: "Cheats or outlasts death",
    definition:
      "One of the champion's own abilities lets them keep acting after dying, or stops or reverses their own death. Invulnerability alone and items don't count.",
    excludes:
      "Invulnerability that doesn't stop death by itself (Kayle's, Taric's ultimates), revives on allies only, Guardian Angel and other items, and respawn timers.",
    keywords: /\b(after (?:dying|death)|upon (?:dying|death)|on death|revive(?:s|d)?|reborn|rebirth|cannot die|can't die|instead of dying|prevent(?:s|ing)? (?:their|his|her) death)\b/gi,
    borderline: "cheating death vs plain invulnerability",
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
