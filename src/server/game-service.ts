import {
  dayTitle,
  openPrompt,
  promptWindow,
  puzzleProgress,
  submitAttempt as engineSubmitAttempt,
  TIER_POINTS,
  type AnswerType,
  type AttemptResult,
  type DayTitle,
  type EntityId,
  type PromptPlay,
  type PromptProgress,
  type Tier,
} from "@/engine";
import type { Clock } from "./clock";
import type { PuzzleSource } from "./puzzle-source";
import { noAnswerCounts, type AnswerCountSource } from "./storage/answer-counts";
import type { PlayStore } from "./storage/play-store";

/**
 * What the client sees of the current Prompt. Never includes the Answer Set, and the Prompt
 * itself is withheld until the player starts it (so it can't be read ahead of the read window).
 */
export type CurrentPromptView =
  | { index: number; status: "not-started" }
  | {
      index: number;
      status: "reading" | "answering";
      text: string;
      answerType: AnswerType;
      rule: string;
      answerOpensAt: number;
      answerClosesAt: number;
    };

/** A finished Prompt's result as the client sees it. */
export type PromptResultView =
  | { status: "accepted"; entityName: string; tier: Tier; points: number }
  | { status: "missed"; points: number };

export interface PuzzleStateView {
  puzzleDay: string;
  promptCount: number;
  /** Server time when this view was built, so the client can correct for clock skew. */
  serverNow: number;
  current: CurrentPromptView | null;
  results: Array<PromptResultView | null>;
  finished: boolean;
  /** The daily total, only once the Puzzle is finished. */
  total: number | null;
}

/** One Entity of a revealed Answer Set, with its Answer Share among today's players. */
export interface AnswerSetEntryView {
  entityId: EntityId;
  name: string;
  tier: Tier;
  points: number;
  /** True for the Gem (the Pentakill Entity). */
  gem: boolean;
  /** How many of today's players chose it. */
  count: number;
  /** Answer Share: count / today's players, from 0 to 1 (0 when there are no players yet). */
  share: number;
}

export interface PromptRevealView {
  text: string;
  answerType: AnswerType;
  result: PromptResultView;
  answerSet: AnswerSetEntryView[];
}

/** The end screen: only available once all Prompts are finished, since it reveals the Answer Sets. */
export interface PuzzleResultsView {
  puzzleDay: string;
  puzzleNumber: number;
  total: number;
  maxTotal: number;
  dayTitle: DayTitle;
  prompts: PromptRevealView[];
}

export type ResultsResponse = { ok: true; results: PuzzleResultsView } | { ok: false; error: "not-finished" };

export type AttemptResponse =
  | { ok: true; result: AttemptResult; state: PuzzleStateView }
  | { ok: false; error: "not-current-prompt" | "prompt-not-started"; state: PuzzleStateView };

export interface GameServiceDeps {
  clock: Clock;
  store: PlayStore;
  puzzles: PuzzleSource;
  /** Answer Share counts for the end screen; all zero when omitted. */
  answerCounts?: AnswerCountSource;
}

export interface GameService {
  getState(deviceId: string): Promise<PuzzleStateView>;
  /** Start the current Prompt (records its window-open time). Idempotent. */
  startPrompt(deviceId: string): Promise<PuzzleStateView>;
  submitAttempt(deviceId: string, promptIndex: number, guess: string): Promise<AttemptResponse>;
  /** The end-screen reveal, including Answer Sets; refused until all Prompts are finished. */
  getResults(deviceId: string): Promise<ResultsResponse>;
}

function toResultView(o: PromptProgress): PromptResultView | null {
  if (o.status === "accepted") {
    return { status: "accepted", entityName: o.entityName, tier: o.tier, points: o.points };
  }
  if (o.status === "missed") return { status: "missed", points: o.points };
  return null;
}

export function createGameService({
  clock,
  store,
  puzzles,
  answerCounts = noAnswerCounts,
}: GameServiceDeps): GameService {
  async function load(deviceId: string) {
    const now = clock.now();
    const daily = await puzzles.current(now);
    const key = { deviceId, puzzleDay: daily.puzzleDay };
    const promptCount = daily.puzzle.prompts.length;
    const plays = await store.getPromptPlays(key, promptCount);
    return { now, daily, key, promptCount, plays };
  }

  function view(ctx: Awaited<ReturnType<typeof load>>, plays: Array<PromptPlay | null>): PuzzleStateView {
    const { now, daily, promptCount } = ctx;
    const progress = puzzleProgress(promptCount, plays, now);
    let current: CurrentPromptView | null = null;
    if (progress.currentIndex !== null) {
      const i = progress.currentIndex;
      const play = plays[i];
      const status = progress.outcomes[i].status;
      if (!play || (status !== "reading" && status !== "answering")) {
        current = { index: i, status: "not-started" };
      } else {
        const prompt = daily.puzzle.prompts[i];
        current = {
          index: i,
          status,
          text: prompt.text,
          answerType: prompt.answerType,
          rule: prompt.rule,
          ...promptWindow(play),
        };
      }
    }
    return {
      puzzleDay: daily.puzzleDay,
      promptCount,
      serverNow: now,
      current,
      results: progress.outcomes.map(toResultView),
      finished: progress.finished,
      total: progress.finished ? progress.total : null,
    };
  }

  return {
    async getState(deviceId) {
      const ctx = await load(deviceId);
      return view(ctx, ctx.plays);
    },

    async startPrompt(deviceId) {
      const ctx = await load(deviceId);
      const { currentIndex } = puzzleProgress(ctx.promptCount, ctx.plays, ctx.now);
      if (currentIndex === null || ctx.plays[currentIndex]) return view(ctx, ctx.plays);
      const stored = await store.createPromptPlay(ctx.key, currentIndex, openPrompt(ctx.now));
      const plays = ctx.plays.slice();
      plays[currentIndex] = stored;
      return view(ctx, plays);
    },

    async submitAttempt(deviceId, promptIndex, guess) {
      const ctx = await load(deviceId);
      const { currentIndex } = puzzleProgress(ctx.promptCount, ctx.plays, ctx.now);
      if (currentIndex !== promptIndex) {
        return { ok: false, error: "not-current-prompt", state: view(ctx, ctx.plays) };
      }
      const play = ctx.plays[promptIndex];
      if (!play) return { ok: false, error: "prompt-not-started", state: view(ctx, ctx.plays) };

      const outcome = engineSubmitAttempt({
        prompt: ctx.daily.puzzle.prompts[promptIndex],
        entities: ctx.daily.entities,
        play,
        guess,
        now: ctx.now,
      });
      if (outcome.play !== play) await store.updatePromptPlay(ctx.key, promptIndex, outcome.play);
      await store.logAttempt({ ...ctx.key, promptIndex, guess, result: outcome.result, at: ctx.now });

      const plays = ctx.plays.slice();
      plays[promptIndex] = outcome.play;
      return { ok: true, result: outcome.result, state: view(ctx, plays) };
    },

    async getResults(deviceId) {
      const { now, daily, promptCount, plays } = await load(deviceId);
      const progress = puzzleProgress(promptCount, plays, now);
      if (!progress.finished) return { ok: false, error: "not-finished" };

      const counts = await answerCounts.getAnswerCounts(daily.puzzleDay, promptCount);
      const names = new Map(daily.entities.map((e) => [e.id, e.name]));
      const prompts = daily.puzzle.prompts.map((prompt, i): PromptRevealView => {
        const promptCounts = counts.byPrompt[i] ?? {};
        const answerSet = Object.entries(prompt.answerSet).map(([entityId, tier]): AnswerSetEntryView => {
          const count = promptCounts[entityId] ?? 0;
          return {
            entityId,
            name: names.get(entityId) ?? entityId,
            tier,
            points: TIER_POINTS[tier],
            gem: tier === "pentakill",
            count,
            share: counts.players > 0 ? count / counts.players : 0,
          };
        });
        // A finished Puzzle has every Prompt Accepted or Missed.
        const result = toResultView(progress.outcomes[i]) ?? { status: "missed", points: 0 };
        return { text: prompt.text, answerType: prompt.answerType, result, answerSet };
      });
      return {
        ok: true,
        results: {
          puzzleDay: daily.puzzleDay,
          puzzleNumber: daily.puzzleNumber,
          total: progress.total,
          maxTotal: promptCount * TIER_POINTS.pentakill,
          dayTitle: dayTitle(progress.total),
          prompts,
        },
      };
    },
  };
}
