import { matchGuess } from "./resolve";
import { pointsFor } from "./scoring";
import type { Entity, EntityId, PromptDefinition, Tier } from "./types";

export const READ_WINDOW_MS = 5_000;

export interface AcceptedResult {
  kind: "accepted";
  entityId: EntityId;
  entityName: string;
  tier: Tier;
  points: number;
}

export interface RejectedResult {
  kind: "rejected";
}

export type AttemptResult = AcceptedResult | RejectedResult;

/** A player's progress on one Prompt: when its answer window opened, and the Accepted Guess, if any. */
export interface PromptPlay {
  windowOpenAt: number;
  accepted: AcceptedResult | null;
}

/** Start a Prompt at `now`: the read window runs first, then the answer window opens. */
export function openPrompt(now: number): PromptPlay {
  return { windowOpenAt: now + READ_WINDOW_MS, accepted: null };
}

export interface AttemptInput {
  prompt: PromptDefinition;
  entities: readonly Entity[];
  play: PromptPlay;
  guess: string;
  now: number;
}

export function submitAttempt({ prompt, entities, play, guess }: AttemptInput): {
  result: AttemptResult;
  play: PromptPlay;
} {
  const match = matchGuess(guess, prompt.answerType, entities);
  const tier = match ? prompt.answerSet[match.id] : undefined;
  if (!match || !tier) return { result: { kind: "rejected" }, play };
  const result: AcceptedResult = {
    kind: "accepted",
    entityId: match.id,
    entityName: match.name,
    tier,
    points: pointsFor(tier),
  };
  return { result, play: { ...play, accepted: result } };
}
