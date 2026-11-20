import type { GameDataSnapshot } from "@/content/game-data/snapshot";
import { championEntityId, itemEntityId, skinEntityId } from "@/content/game-data/build-registry";
import type { EntityId, Tier } from "@/engine";
import { answerSetOf } from "./answer-set";
import { provenanceOf } from "./provenance";
import type { BuilderInputs, BuiltPrompt, FamiliarityData, ScoringConstants, TemplateDefinition } from "./types";

/** How much Familiarity weighs in the Prior when it exists; Typicality is the rest. */
export const FAMILIARITY_WEIGHT = 0.5;

/**
 * Share of the normally-banded answers (not the Gem or Too Clever), from likeliest down, in each band.
 * Whatever is left after Minion, Kill and Triple Kill is Quadra Kill.
 */
export const BAND_SHARES = { minion: 0.3, kill: 0.3, "triple-kill": 0.25 } as const;

/** Without an approved Gem: position from likeliest (0) to least likely (1) of the default Gem. */
export const DEFAULT_GEM_POSITION = 0.8;

/** The scoring constants the Builder uses unless `BuilderInputs.scoring` overrides them. */
export const SCORING_CONSTANTS: ScoringConstants = { FAMILIARITY_WEIGHT, BAND_SHARES, DEFAULT_GEM_POSITION };

/**
 * Build one Prompt: the Template's Answer Set, with a Tier per Entity from the Prior and the
 * approved review, and the provenance of the inputs that produced them.
 */
export function buildPrompt(template: TemplateDefinition, inputs: BuilderInputs): BuiltPrompt {
  const scoring = inputs.scoring ?? SCORING_CONSTANTS;
  const entities = answerSetOf(template, inputs);
  const review = inputs.reviews?.[template.id];
  const prior = priorOf(entities, inputs, review?.typicality ?? {}, scoring.FAMILIARITY_WEIGHT);
  // Likeliest first; Entity ID keeps the order deterministic.
  const byPrior = [...entities].sort((a, b) => prior.get(b)! - prior.get(a)! || a.localeCompare(b));

  const inSet = new Set(entities);
  const tooClever = new Set((review?.tooClever ?? []).filter((id) => inSet.has(id)));
  // The approved Gem, unless a patch dropped it from the set. Otherwise a rare but reachable answer
  // (Krillion: "something at least a few of you actually get"), not the deepest cut.
  const candidates = byPrior.filter((id) => !tooClever.has(id));
  const gem =
    review?.gem && inSet.has(review.gem) && !tooClever.has(review.gem)
      ? review.gem
      : candidates[Math.floor((candidates.length - 1) * scoring.DEFAULT_GEM_POSITION)];

  const answerSet: Record<EntityId, Tier> = {};
  const banded = byPrior.filter((id) => id !== gem && !tooClever.has(id));
  let bandStart = 0;
  banded.forEach((id, i) => {
    // Equal Priors share a band: band by the first position of the tie.
    if (i > 0 && prior.get(id) !== prior.get(banded[i - 1])) bandStart = i;
    answerSet[id] = bandAt(bandStart / banded.length, scoring.BAND_SHARES);
  });
  for (const id of tooClever) answerSet[id] = "too-clever";
  if (gem) answerSet[gem] = "pentakill";

  return {
    templateId: template.id,
    text: template.text,
    answerType: template.answerType,
    rule: template.rule,
    answerSet,
    provenance: provenanceOf(template, inputs, scoring),
  };
}

/** The Tier at a position among the normally-banded answers, from likeliest (0) to least likely (1). */
export function bandAt(position: number, shares: ScoringConstants["BAND_SHARES"] = BAND_SHARES): Tier {
  let edge = shares.minion;
  if (position < edge) return "minion";
  if (position < (edge += shares.kill)) return "kill";
  if (position < (edge += shares["triple-kill"])) return "triple-kill";
  return "quadra-kill";
}

/**
 * Prior per Entity: Typicality (approved, else a default), blended with Familiarity normalized over
 * the Answer Set when Familiarity data exists. Champion pick rate only breaks ties.
 */
function priorOf(
  entities: readonly EntityId[],
  inputs: BuilderInputs,
  approved: Readonly<Record<EntityId, number>>,
  familiarityWeight: number,
): Map<EntityId, number> {
  const defaults = defaultTypicality(entities, inputs.snapshot);
  const typicality = (id: EntityId) => approved[id] ?? defaults.get(id) ?? 0;
  const familiarity = inputs.familiarity ? familiarityRanks(entities, inputs.familiarity, inputs.snapshot) : undefined;

  return new Map(
    entities.map((id) => {
      const blended = familiarity
        ? familiarityWeight * familiarity.rank.get(id)! + (1 - familiarityWeight) * typicality(id)
        : typicality(id);
      return [id, blended + (familiarity?.tiebreak.get(id) ?? 0)];
    }),
  );
}

/** Rank percentile in [0, 1] (1 = highest value); equal values share a rank. */
function rankPercentiles(values: Map<EntityId, number>): Map<EntityId, number> {
  const sorted = [...new Set(values.values())].sort((a, b) => a - b);
  const top = Math.max(sorted.length - 1, 1);
  return new Map([...values].map(([id, v]) => [id, sorted.indexOf(v) / top]));
}

function familiarityRanks(entities: readonly EntityId[], data: FamiliarityData, snapshot: GameDataSnapshot) {
  const skinChampion = new Map(snapshot.skins.map((s) => [skinEntityId(s.id), championEntityId(s.championId)]));
  const raw = new Map<EntityId, number>();
  const tiebreak = new Map<EntityId, number>();
  for (const id of entities) {
    // A skin is as familiar as its champion.
    const champion = data.champions[skinChampion.get(id) ?? id];
    raw.set(id, champion?.mastery ?? data.items[id]?.buildRate ?? 0);
    tiebreak.set(id, (champion?.pickRate ?? 0) * 1e-6);
  }
  return { rank: rankPercentiles(raw), tiebreak };
}

const SKIN_RARITY_WEIGHT: Record<string, number> = {
  kTranscendent: 6,
  kUltimate: 5,
  kExalted: 4,
  kMythic: 3,
  kLegendary: 3,
  kEpic: 2,
  kRare: 1,
  kNoRarity: 0,
};

/**
 * Placeholder Typicality until a Template's review is approved, so the pipeline runs end-to-end.
 * Crude proxies: older champions (lower key), pricier items, and skins of a rarer tier on an older
 * champion come to mind first. Small tie-breakers keep big Answer Sets from collapsing into one band.
 */
function defaultTypicality(entities: readonly EntityId[], snapshot: GameDataSnapshot): Map<EntityId, number> {
  const championKey = new Map(snapshot.champions.map((c) => [c.id, c.key]));
  const signal = new Map<EntityId, number>();
  for (const c of snapshot.champions) signal.set(championEntityId(c.id), -c.key);
  for (const i of snapshot.items) signal.set(itemEntityId(i.id), i.goldTotal - Number(i.id) / 1e6);
  for (const s of snapshot.skins) {
    const rarity = SKIN_RARITY_WEIGHT[s.rarity] ?? 0;
    signal.set(skinEntityId(s.id), rarity * 1e4 - (championKey.get(s.championId) ?? 9999) - (s.id % 1000) / 1e3);
  }
  return rankPercentiles(new Map(entities.map((id) => [id, signal.get(id) ?? 0])));
}
