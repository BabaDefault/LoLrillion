import { championEntityId, itemEntityId, skinEntityId } from "@/content/game-data/build-registry";
import type { EntityId } from "@/engine";
import { entitiesWithTerm } from "@/labels";
import type { BuilderInputs, TemplateDefinition, TemplateFilter } from "./types";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The Entities a Template's filter selects from the game data and approved labels. */
export function answerSetOf(template: TemplateDefinition, inputs: BuilderInputs): EntityId[] {
  return select(template.filter, inputs);
}

function select(filter: TemplateFilter, { snapshot, labels = [] }: BuilderInputs): EntityId[] {
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
      return snapshot.items.filter((i) => (i.stats[filter.stat] ?? 0) > 0).map((i) => itemEntityId(i.id));
    case "skin-name-word": {
      const tail = filter.prefix ? "" : "\\b";
      const pattern = new RegExp(`\\b${escapeRegExp(filter.word)}${tail}`, "i");
      return snapshot.skins.filter((s) => pattern.test(s.name)).map((s) => skinEntityId(s.id));
    }
  }
}
