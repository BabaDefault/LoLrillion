import { readGuess, type Candidate } from "./resolve";
import { MISS_POINTS, pointsFor } from "./scoring";
import type { AnswerType, Entity, EntityId, PromptDefinition, Tier } from "./types";

/** Read window: the Prompt is visible but input is locked. */
export const READ_WINDOW_MS = 5_000;
/** Answer window: the countdown the player sees. */
export const ANSWER_WINDOW_MS = 25_000;
/** Extra time the server still accepts Attempts after the answer window, to absorb network latency. */
export const NETWORK_GRACE_MS = 2_000;

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
  | "locked" // the Prompt already has an Accepted Guess
  | "read-window" // the answer window hasn't opened yet
  | "window-closed"; // the answer window (plus grace) has closed

export interface RejectedResult {
  kind: "rejected";
  reason: RejectionReason;
}

/**
 * The Guess wasn't an exact name or Alias but is close to these Entities of the Answer Type.
 * Not an Attempt: the player confirms one (by Entity ID) or goes back to editing.
 */
export interface DidYouMeanResult {
  kind: "did-you-mean";
  candidates: Candidate[];
}

/** The Guess names an Entity of another Answer Type (e.g. a champion on a SKIN Prompt). Not an Attempt. */
export interface WrongAnswerTypeResult {
  kind: "wrong-answer-type";
  expected: AnswerType;
}

export type AttemptResult = AcceptedResult | RejectedResult | DidYouMeanResult | WrongAnswerTypeResult;

/** A player's progress on one Prompt: when its answer window opened, and the Accepted Guess, if any. */
export interface PromptPlay {
  windowOpenAt: number;
  accepted: AcceptedResult | null;
}

/** Start a Prompt at `now`: the read window runs first, then the answer window opens. */
export function openPrompt(now: number): PromptPlay {
  return { windowOpenAt: now + READ_WINDOW_MS, accepted: null };
}

/** When the answer window opens and when its visible countdown ends (grace not included). */
export function promptWindow(play: PromptPlay): { answerOpensAt: number; answerClosesAt: number } {
  return { answerOpensAt: play.windowOpenAt, answerClosesAt: play.windowOpenAt + ANSWER_WINDOW_MS };
}

function acceptsAttemptsUntil(play: PromptPlay): number {
  return promptWindow(play).answerClosesAt + NETWORK_GRACE_MS;
}

export type PromptOutcome =
  | { status: "reading" }
  | { status: "answering" }
  | { status: "accepted"; entityId: EntityId; entityName: string; tier: Tier; points: number }
  | { status: "missed"; points: number };

/** Where a started Prompt stands at `now`. A Prompt with no Accepted Guess after its window is a Miss. */
export function promptOutcome(play: PromptPlay, now: number): PromptOutcome {
  if (play.accepted) {
    const { kind: _kind, ...accepted } = play.accepted;
    return { status: "accepted", ...accepted };
  }
  if (now < play.windowOpenAt) return { status: "reading" };
  if (now < acceptsAttemptsUntil(play)) return { status: "answering" };
  return { status: "missed", points: MISS_POINTS };
}

export interface AttemptInput {
  prompt: PromptDefinition;
  entities: readonly Entity[];
  play: PromptPlay;
  guess: string;
  now: number;
}

export function submitAttempt({ prompt, entities, play, guess, now }: AttemptInput): {
  result: AttemptResult;
  play: PromptPlay;
} {
  const reject = (reason: RejectionReason) => ({ result: { kind: "rejected", reason } as const, play });
  if (play.accepted) return reject("locked");
  if (now < play.windowOpenAt) return reject("read-window");
  if (now >= acceptsAttemptsUntil(play)) return reject("window-closed");
  const reading = readGuess(guess, prompt.answerType, entities);
  if (reading.kind === "did-you-mean") {
    return { result: { kind: "did-you-mean", candidates: reading.candidates }, play };
  }
  if (reading.kind === "wrong-answer-type") {
    return { result: { kind: "wrong-answer-type", expected: prompt.answerType }, play };
  }
  if (reading.kind === "none") return reject("no-match");
  const match = reading.entity;
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
