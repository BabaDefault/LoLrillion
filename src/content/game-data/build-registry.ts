import { normalizeGuess, type Entity, type EntityId } from "@/engine";
import type { EsportsSnapshot } from "@/content/esports/snapshot";
import type { GameDataSnapshot } from "./snapshot";

/** Hand-curated nicknames per Entity ID (e.g. `{"champion:MissFortune": ["MF"]}`). */
export type Nicknames = Readonly<Record<EntityId, readonly string[]>>;

/**
 * Entity IDs are namespaced by Answer Type: `champion:<DDragon id>`, `item:<Riot id>`, `skin:<Riot id>`,
 * `pro-player:<Leaguepedia player page>`.
 */
export const championEntityId = (ddragonId: string): EntityId => `champion:${ddragonId}`;
export const itemEntityId = (riotId: string): EntityId => `item:${riotId}`;
export const skinEntityId = (riotId: number): EntityId => `skin:${riotId}`;
export const proPlayerEntityId = (leaguepediaPage: string): EntityId => `pro-player:${leaguepediaPage}`;

/**
 * Build the Entity registry from a game data snapshot and (when given) the esports snapshot, with
 * Aliases from internal names (`MonkeyKing`), pro players' former IGNs, and the curated `nicknames`
 * (Data Dragon item `colloq` is too noisy to use). Pure.
 *
 * An Alias must resolve to exactly one Entity, so any Alias that normalizes to another Entity's name,
 * or that two Entities of the same Answer Type share, is dropped. Aliases that normalize to the
 * Entity's own name (e.g. "Kai Sa" for Kai'Sa) are dropped as redundant: matching already ignores them.
 */
export function buildRegistry(snapshot: GameDataSnapshot, nicknames: Nicknames, esports?: EsportsSnapshot): Entity[] {
  const candidates: Entity[] = [
    ...snapshot.champions.map((c) => ({
      id: championEntityId(c.id),
      name: c.name,
      answerType: "champion" as const,
      aliases: [c.id],
    })),
    ...snapshot.items.map((i) => ({
      id: itemEntityId(i.id),
      name: i.name,
      answerType: "item" as const,
      aliases: [],
    })),
    ...snapshot.skins.map((s) => ({
      id: skinEntityId(s.id),
      name: s.name,
      answerType: "skin" as const,
      aliases: [],
    })),
    ...(esports?.players ?? []).map((p) => ({
      id: proPlayerEntityId(p.id),
      name: p.name,
      answerType: "pro-player" as const,
      aliases: p.formerNames,
    })),
  ].map((e) => ({ ...e, aliases: [...e.aliases, ...(nicknames[e.id] ?? [])] }));

  // How many Entities of each Answer Type claim a normalized name or Alias.
  const claims = new Map<string, number>();
  for (const e of candidates) {
    const keys = new Set([e.name, ...e.aliases].map(normalizeGuess));
    for (const key of keys) {
      const claim = `${e.answerType}|${key}`;
      claims.set(claim, (claims.get(claim) ?? 0) + 1);
    }
  }

  return candidates.map((e) => {
    const seen = new Set([normalizeGuess(e.name)]);
    const aliases = e.aliases.filter((alias) => {
      const key = normalizeGuess(alias);
      if (key === "" || seen.has(key)) return false;
      seen.add(key);
      return claims.get(`${e.answerType}|${key}`) === 1;
    });
    return { ...e, aliases };
  });
}
