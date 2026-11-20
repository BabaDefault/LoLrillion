/** The kind of Entity a Prompt accepts. Pro Player / Team arrive in v1.1. */
export type AnswerType = "champion" | "item" | "skin";

export type EntityId = string;

/** One canonical champion, item or skin, with a stable identity and its Aliases. */
export interface Entity {
  id: EntityId;
  name: string;
  answerType: AnswerType;
  aliases: readonly string[];
}

/** One of the six fixed rarity bands. `pentakill` is the Gem. */
export type Tier = "minion" | "too-clever" | "kill" | "triple-kill" | "quadra-kill" | "pentakill";

/** One player-facing question, with the Answer Set (Entity → Tier) that is server-only data. */
export interface PromptDefinition {
  text: string;
  answerType: AnswerType;
  rule: string;
  answerSet: Readonly<Record<EntityId, Tier>>;
}

/** The fixed set of seven Prompts for one Puzzle Day. */
export interface Puzzle {
  prompts: readonly PromptDefinition[];
}
