/** The kind of Entity a Prompt accepts. A Team Answer Type isn't needed yet (#17). */
export type AnswerType = "champion" | "item" | "skin" | "pro-player";

/** How an Answer Type reads in player-facing text, e.g. "pro player" (badges upper-case it). */
export const ANSWER_TYPE_LABEL: Readonly<Record<AnswerType, string>> = {
  champion: "champion",
  item: "item",
  skin: "skin",
  "pro-player": "pro player",
};

/** Answer Types about pro play: at most one such Prompt per Puzzle (many players don't follow it). */
export const ESPORTS_ANSWER_TYPES: ReadonlySet<AnswerType> = new Set(["pro-player"]);

export type EntityId = string;

/** One canonical champion, item, skin or pro player, with a stable identity and its Aliases. */
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
