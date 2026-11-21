import { championEntityId, itemEntityId, proPlayerEntityId, skinEntityId } from "@/content/game-data/build-registry";
import type { EntityId } from "@/engine";
import { entitiesWithTerm } from "@/labels";
import { entitiesWithTrait } from "@/traits";
import { requireEsports } from "./esports";
import type { BuilderInputs, TemplateDefinition, TemplateFilter } from "./types";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * How an item tooltip's `<stats>` block names each stat key. Data Dragon's `stats` map leaves out some
 * stats the tooltip lists (Yun Tal Wildarrows' Critical Strike Chance), so the `item-stat` filter reads
 * both. Keys without a `Mod` suffix are tooltip-only: Data Dragon has no stats-map key for them (Ability
 * Haste, Lethality, Heal and Shield Power) or splits them (flat and percent Move Speed).
 */
const TOOLTIP_STAT_LABEL: Readonly<Record<string, string>> = {
  FlatArmorMod: "Armor",
  FlatSpellBlockMod: "Magic Resist",
  FlatMagicDamageMod: "Ability Power",
  FlatPhysicalDamageMod: "Attack Damage",
  FlatHPPoolMod: "Health",
  FlatMPPoolMod: "Mana",
  PercentAttackSpeedMod: "Attack Speed",
  FlatCritChanceMod: "Critical Strike Chance",
  MoveSpeed: "Move Speed",
  AbilityHaste: "Ability Haste",
  Lethality: "Lethality",
  HealShieldPower: "Heal and Shield Power",
};

/** The stat names in an item description's `<stats>` block, e.g. "Critical Strike Chance" from "<attention>0%</attention> Critical Strike Chance". */
function tooltipStatLabels(description: string): Set<string> {
  const block = /<stats>([\s\S]*?)<\/stats>/.exec(description)?.[1] ?? "";
  return new Set(
    block
      .split(/<br\s*\/?>/)
      .map((line) => line.replace(/<attention>[^<]*<\/attention>/g, "").replace(/<[^>]+>/g, "").trim())
      .filter(Boolean),
  );
}

/**
 * Base attack range from which a champion counts as ranged. Riot's melee champions sit at 125-250 and
 * its ranged ones from 300 (Rakan) up. Transforming champions count by their base form (Data Dragon's
 * range): Kayle, Gnar and Jayce are melee, Nidalee and Elise ranged.
 */
export const RANGED_ATTACK_RANGE = 300;

/** The mechanics terms a filter reads, in order (nested `all` filters included). */
export function labelTermsOf(filter: TemplateFilter): string[] {
  if (filter.kind === "champion-label") return [filter.term];
  if (filter.kind === "all") return filter.of.flatMap(labelTermsOf);
  return [];
}

/** The curated traits a filter reads, in order (nested `all` filters included). */
export function traitIdsOf(filter: TemplateFilter): string[] {
  if (filter.kind === "trait") return [filter.trait];
  if (filter.kind === "all") return filter.of.flatMap(traitIdsOf);
  return [];
}

/** The Entities a Template's filter selects from the game data and approved labels. */
export function answerSetOf(template: TemplateDefinition, inputs: BuilderInputs): EntityId[] {
  return select(template.filter, inputs);
}

function select(filter: TemplateFilter, inputs: BuilderInputs): EntityId[] {
  const { snapshot, labels = [] } = inputs;
  const champions = snapshot.champions;
  switch (filter.kind) {
    case "champion-label": {
      const labelled = new Set(entitiesWithTerm(labels, filter.term));
      return champions.map((c) => championEntityId(c.id)).filter((id) => labelled.has(id));
    }
    case "champion-name-length": {
      const { atMost = Infinity, atLeast = 0 } = filter;
      return champions
        .filter((c) => {
          const letters = c.name.replace(/[^\p{L}]/gu, "").length;
          return letters <= atMost && letters >= atLeast;
        })
        .map((c) => championEntityId(c.id));
    }
    case "champion-name-pattern": {
      const pattern = new RegExp(filter.pattern, filter.flags);
      return champions.filter((c) => pattern.test(c.name)).map((c) => championEntityId(c.id));
    }
    case "trait": {
      const traited = new Set(entitiesWithTrait(inputs.traits ?? [], filter.trait));
      const current = [...champions.map((c) => championEntityId(c.id)), ...snapshot.items.map((i) => itemEntityId(i.id))];
      return current.filter((id) => traited.has(id));
    }
    case "item-stat":
      return snapshot.items
        .filter((i) => (i.stats[filter.stat] ?? 0) > 0 || tooltipStatLabels(i.description).has(TOOLTIP_STAT_LABEL[filter.stat]))
        .map((i) => itemEntityId(i.id));
    case "champion-range":
      return champions
        .filter((c) => c.attackRange >= RANGED_ATTACK_RANGE === filter.ranged)
        .map((c) => championEntityId(c.id));
    case "item-builds-from":
      return snapshot.items.filter((i) => i.from.includes(filter.item)).map((i) => itemEntityId(i.id));
    case "all": {
      const [first, ...rest] = filter.of.map((f) => select(f, inputs));
      if (!first) throw new Error(`An "all" filter needs at least one sub-filter.`);
      const others = rest.map((ids) => new Set(ids));
      return first.filter((id) => others.every((set) => set.has(id)));
    }
    case "skin-name-word": {
      const tail = filter.prefix ? "" : "\\b";
      const pattern = new RegExp(`\\b${escapeRegExp(filter.word)}${tail}`, "i");
      return snapshot.skins.filter((s) => pattern.test(s.name)).map((s) => skinEntityId(s.id));
    }
    case "champion-skin-count": {
      const { atMost = Infinity, atLeast = 0 } = filter;
      const counts = new Map<string, number>();
      for (const s of snapshot.skins) {
        if (isReissue(s.name)) continue;
        counts.set(s.championId, (counts.get(s.championId) ?? 0) + 1);
      }
      return champions
        .filter((c) => {
          const n = counts.get(c.id) ?? 0;
          return n <= atMost && n >= atLeast;
        })
        .map((c) => championEntityId(c.id));
    }
    case "champion-skin-name-word": {
      const pattern = new RegExp(`\\b${escapeRegExp(filter.word)}\\b`, "i");
      const owners = new Set(snapshot.skins.filter((s) => pattern.test(s.name)).map((s) => s.championId));
      return champions.filter((c) => owners.has(c.id)).map((c) => championEntityId(c.id));
    }
    case "worlds-winner": {
      const winners = new Set(requireEsports(inputs).worldsWins.flatMap((w) => w.players));
      return [...winners].sort().map(proPlayerEntityId);
    }
  }
}

/**
 * A skin entry that re-issues another skin rather than adding a new one: dated re-releases such as
 * "Prestige K/DA Ahri (2022)" and model updates such as "Goth Annie Modern". Skin counts skip them.
 */
function isReissue(skinName: string): boolean {
  return /\(\d{4}\)$/.test(skinName) || / Modern$/.test(skinName);
}
