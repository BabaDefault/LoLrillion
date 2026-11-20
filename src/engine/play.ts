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
  | "not-offered" // a confirmed Entity ID that was never offered as a "Did you mean" candidate
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

/**
 * The latest window-open time whose answer window (plus grace) has closed by `now`: a Prompt
 * opened at or before it is Accepted or Missed. For stores that filter finished runs in a query.
 */
export function closedWindowsOpenedBy(now: number): number {
  return now - ANSWER_WINDOW_MS - NETWORK_GRACE_MS;
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

export interface AttemptOutcome {
  result: AttemptResult;
  play: PromptPlay;
}

function rejected(play: PromptPlay, reason: RejectionReason): AttemptOutcome {
  return { result: { kind: "rejected", reason }, play };
}

/** Why the Prompt can't take an Attempt right now, if it can't. */
function closedReason(play: PromptPlay, now: number): RejectionReason | null {
  if (play.accepted) return "locked";
  if (now < play.windowOpenAt) return "read-window";
  if (now >= acceptsAttemptsUntil(play)) return "window-closed";
  return null;
}

/** Score a matched Entity against the Answer Set, locking the Prompt if it's Accepted. */
function attemptEntity(prompt: PromptDefinition, play: PromptPlay, match: Entity): AttemptOutcome {
  const tier = prompt.answerSet[match.id];
  if (!tier) return rejected(play, "not-in-answer-set");
  const result: AcceptedResult = {
    kind: "accepted",
    entityId: match.id,
    entityName: match.name,
    tier,
    points: pointsFor(tier),
  };
  return { result, play: { ...play, accepted: result } };
}

/**
 * Submit a typed Guess. A near-miss returns `did-you-mean` and a Guess naming another Answer
 * Type returns `wrong-answer-type`; neither is an Attempt, so the PromptPlay is unchanged.
 */
export function submitAttempt({ prompt, entities, play, guess, now }: AttemptInput): AttemptOutcome {
  const closed = closedReason(play, now);
  if (closed) return rejected(play, closed);
  const reading = readGuess(guess, prompt.answerType, entities);
  if (reading.kind === "did-you-mean") {
    return { result: { kind: "did-you-mean", candidates: reading.candidates }, play };
  }
  if (reading.kind === "wrong-answer-type") {
    return { result: { kind: "wrong-answer-type", expected: prompt.answerType }, play };
  }
  if (reading.kind === "none") return rejected(play, "no-match");
  return attemptEntity(prompt, play, reading.entity);
}

export interface ConfirmInput {
  prompt: PromptDefinition;
  entities: readonly Entity[];
  play: PromptPlay;
  /** The Entity the player picked from a "Did you mean" popup. */
  entityId: EntityId;
  /** Every Entity ID offered as a candidate for this PromptPlay so far. */
  offered: readonly EntityId[];
  now: number;
}

/** Answer "Yes" to a "Did you mean": an Attempt with an explicit Entity, which must have been offered. */
export function confirmSuggestion({ prompt, entities, play, entityId, offered, now }: ConfirmInput): AttemptOutcome {
  const closed = closedReason(play, now);
  if (closed) return rejected(play, closed);
  const match = offered.includes(entityId)
    ? entities.find((e) => e.id === entityId && e.answerType === prompt.answerType)
    : undefined;
  if (!match) return rejected(play, "not-offered");
  return attemptEntity(prompt, play, match);
}
