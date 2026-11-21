import type { GeneratedPuzzle } from "@/builder";
import type { AnswerType, Entity, EntityId, Tier } from "@/engine";
import { unmatchedGuessReport, type UnmatchedGuess } from "@/reviews";
import type { AttemptLogEntry } from "./storage/play-store";

/** Tiers from rarest to most common, as the dashboard lists them. */
const TIER_ORDER: readonly Tier[] = ["pentakill", "quadra-kill", "triple-kill", "kill", "too-clever", "minion"];

/** One answer in an Answer Set, with how many players locked it in. */
export interface AdminAnswer {
  entityId: EntityId;
  name: string;
  /** Distinct players whose Accepted Guess it was on the day (counted runs). */
  live: number;
  /** Distinct players whose Accepted Guess it was in an archive run (incl. beta play-ahead). */
  early: number;
}

/** One Prompt of a day, with its whole Answer Set and what players typed. */
export interface AdminPrompt {
  index: number;
  templateId: string;
  text: string;
  rule: string;
  answerType: AnswerType;
  /** The Answer Set grouped by Tier, rarest first; Tiers with no answers are left out. */
  tiers: Array<{ tier: Tier; answers: AdminAnswer[] }>;
  /** Distinct players who made at least one Attempt on this Prompt, live and early. */
  players: { live: number; early: number };
  /** Guesses Rejected as answers (no match, or not in the Answer Set), most frequent first. */
  rejected: UnmatchedGuess[];
}

/**
 * Everything the admin dashboard shows for one Puzzle Day: each Prompt's full Answer Set with
 * how often each answer was locked in, plus the Rejected Guesses that hint at missing answers.
 * Reveals Answer Sets, so only ever render it behind the admin key.
 */
export function adminDay(
  puzzle: GeneratedPuzzle,
  entities: readonly Entity[],
  attempts: readonly AttemptLogEntry[],
): AdminPrompt[] {
  const names = new Map(entities.map((e) => [e.id, e.name]));
  const rejectedByTemplate = new Map(
    unmatchedGuessReport(
      [puzzle],
      entities,
      attempts.map((a) => ({
        playerId: a.deviceId,
        puzzleDay: a.puzzleDay,
        promptIndex: a.promptIndex,
        guess: a.guess,
        result: a.result.kind,
        reason: a.result.kind === "rejected" ? a.result.reason : null,
        confirmedEntityId: a.confirmedEntityId ?? null,
      })),
    ).map((r) => [r.templateId, r.guesses]),
  );

  return puzzle.prompts.map((prompt, index) => {
    const mine = attempts.filter((a) => a.puzzleDay === puzzle.puzzleDay && a.promptIndex === index);
    const players = { live: new Set<string>(), early: new Set<string>() };
    const chose = new Map<EntityId, { live: Set<string>; early: Set<string> }>();
    for (const a of mine) {
      const run = a.archive ? "early" : "live";
      players[run].add(a.deviceId);
      if (a.result.kind !== "accepted") continue;
      const tally = chose.get(a.result.entityId) ?? { live: new Set(), early: new Set() };
      tally[run].add(a.deviceId);
      chose.set(a.result.entityId, tally);
    }

    const tiers = TIER_ORDER.map((tier) => ({
      tier,
      answers: Object.entries(prompt.answerSet)
        .filter(([, t]) => t === tier)
        .map(([entityId]) => ({
          entityId,
          name: names.get(entityId) ?? entityId,
          live: chose.get(entityId)?.live.size ?? 0,
          early: chose.get(entityId)?.early.size ?? 0,
        }))
        .sort((a, b) => b.live + b.early - (a.live + a.early) || a.name.localeCompare(b.name)),
    })).filter((t) => t.answers.length > 0);

    return {
      index,
      templateId: prompt.templateId,
      text: prompt.text,
      rule: prompt.rule,
      answerType: prompt.answerType,
      tiers,
      players: { live: players.live.size, early: players.early.size },
      rejected: rejectedByTemplate.get(prompt.templateId) ?? [],
    };
  });
}
