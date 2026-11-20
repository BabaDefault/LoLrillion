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

/** Why an Attempt was Rejected. Useful for logging unmatched Guesses. */
export type RejectionReason =
  | "no-match" // the Guess matched no Entity of the Prompt's Answer Type
  | "not-in-answer-set" // it matched an Entity, but that Entity isn't valid for this Prompt
  | "locked"; // the Prompt already has an Accepted Guess

export interface RejectedResult {
  kind: "rejected";
  reason: RejectionReason;
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
  const reject = (reason: RejectionReason) => ({ result: { kind: "rejected", reason } as const, play });
  if (play.accepted) return reject("locked");
  const match = matchGuess(guess, prompt.answerType, entities);
  if (!match) return reject("no-match");
  const tier = prompt.answerSet[match.id];
  if (!tier) return reject("not-in-answer-set");
  const result: AcceptedResult = {
    kind: "accepted",
    entityId: match.id,
    entityName: match.name,
    tier,
    points: pointsFor(tier),
  };
  return { result, play: { ...play, accepted: result } };
}
