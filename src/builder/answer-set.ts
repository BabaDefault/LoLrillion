import { championEntityId, itemEntityId, proPlayerEntityId, skinEntityId } from "@/content/game-data/build-registry";
import type { EntityId } from "@/engine";
import { entitiesWithTerm } from "@/labels";
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
    case "champion-name-length":
      return champions
        .filter((c) => c.name.replace(/[^\p{L}]/gu, "").length <= filter.atMost)
        .map((c) => championEntityId(c.id));
    case "item-stat":
      return snapshot.items
        .filter((i) => (i.stats[filter.stat] ?? 0) > 0 || tooltipStatLabels(i.description).has(TOOLTIP_STAT_LABEL[filter.stat]))
        .map((i) => itemEntityId(i.id));
    case "skin-name-word": {
      const tail = filter.prefix ? "" : "\\b";
      const pattern = new RegExp(`\\b${escapeRegExp(filter.word)}${tail}`, "i");
      return snapshot.skins.filter((s) => pattern.test(s.name)).map((s) => skinEntityId(s.id));
    }
    case "worlds-winner": {
      const winners = new Set(requireEsports(inputs).worldsWins.flatMap((w) => w.players));
      return [...winners].sort().map(proPlayerEntityId);
    }
  }
}
