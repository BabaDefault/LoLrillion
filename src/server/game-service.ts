import {
  openPrompt,
  promptWindow,
  puzzleProgress,
  submitAttempt as engineSubmitAttempt,
  type AnswerType,
  type AttemptResult,
  type PromptPlay,
  type PromptProgress,
} from "@/engine";
import type { Clock } from "./clock";
import type { PuzzleSource } from "./puzzle-source";
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
  | { status: "accepted"; entityName: string; tier: string; points: number }
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

export type AttemptResponse =
  | { ok: true; result: AttemptResult; state: PuzzleStateView }
  | { ok: false; error: "not-current-prompt" | "prompt-not-started"; state: PuzzleStateView };

export interface GameServiceDeps {
  clock: Clock;
  store: PlayStore;
  puzzles: PuzzleSource;
}

export interface GameService {
  getState(deviceId: string): Promise<PuzzleStateView>;
  /** Start the current Prompt (records its window-open time). Idempotent. */
  startPrompt(deviceId: string): Promise<PuzzleStateView>;
  submitAttempt(deviceId: string, promptIndex: number, guess: string): Promise<AttemptResponse>;
}

function toResultView(o: PromptProgress): PromptResultView | null {
  if (o.status === "accepted") {
    return { status: "accepted", entityName: o.entityName, tier: o.tier, points: o.points };
  }
  if (o.status === "missed") return { status: "missed", points: o.points };
  return null;
}

export function createGameService({ clock, store, puzzles }: GameServiceDeps): GameService {
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
  };
}
