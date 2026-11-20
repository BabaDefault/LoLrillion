import {
  dayTitle,
  openPrompt,
  percentileBetterThan,
  personalStats,
  promptWindow,
  puzzleDayOf,
  puzzleProgress,
  scoreDistribution,
  submitAttempt as engineSubmitAttempt,
  TIER_POINTS,
  confirmSuggestion as engineConfirmSuggestion,
  type AnswerType,
  type AttemptOutcome,
  type AttemptResult,
  type DayTitle,
  type EntityId,
  type FinishedGame,
  type PersonalStats,
  type ScoreDistribution,
  type PromptPlay,
  type PromptProgress,
  type Tier,
} from "@/engine";
import type { Clock } from "./clock";
import type { ArchiveDay, PuzzleSource } from "./puzzle-source";
import type { AnswerCountSource } from "./storage/answer-counts";
import type { PlayKey, PlayStore } from "./storage/play-store";

/** An archive request for a day that isn't a past Puzzle Day with a Puzzle (today, the future, or none). */
export class ArchiveUnavailableError extends Error {
  constructor(readonly puzzleDay: string) {
    super(`No archived Puzzle for ${puzzleDay}`);
    this.name = "ArchiveUnavailableError";
  }
}

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
  | { status: "accepted"; entityId: EntityId; entityName: string; tier: Tier; points: number }
  | { status: "missed"; points: number };

export interface PuzzleStateView {
  puzzleDay: string;
  /** An archive run of a past Puzzle: never counted on leaderboards or in Answer Share. */
  archive: boolean;
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
  /** The player's result; null when viewing a past day they haven't finished. */
  result: PromptResultView | null;
  answerSet: AnswerSetEntryView[];
}

/**
 * The end screen. It reveals the Answer Sets, so for today it is only available once all Prompts
 * are finished; a past day's results can be viewed without playing it (`played: false`).
 */
export interface PuzzleResultsView {
  puzzleDay: string;
  puzzleNumber: number;
  /** An archive run: compared against the day's counted players, but never counted itself. */
  archive: boolean;
  /** False when viewing a past day this player hasn't finished: no total, title or percentile of theirs. */
  played: boolean;
  total: number | null;
  maxTotal: number;
  dayTitle: DayTitle | null;
  /**
   * Players who finished the day's Puzzle (counted plays only): including this one for a
   * counted run, excluding it for an archive run.
   */
  playerCount: number;
  /** "Better than X% of the day's players"; null when not played. */
  percentile: number | null;
  /** The day's score-distribution curve, with this player's bin marked. */
  distribution: ScoreDistribution;
  prompts: PromptRevealView[];
}

export type ResultsResponse = { ok: true; results: PuzzleResultsView } | { ok: false; error: "not-finished" };

export type AttemptResponse =
  | { ok: true; result: AttemptResult; state: PuzzleStateView }
  | { ok: false; error: "not-current-prompt" | "prompt-not-started"; state: PuzzleStateView };

/** Bins in the end screen's score-distribution curve. */
export const DISTRIBUTION_BINS = 10;

export interface GameServiceDeps {
  clock: Clock;
  store: PlayStore;
  puzzles: PuzzleSource;
  /** Answer Share counts for the end screen; the store's own counts when omitted. */
  answerCounts?: AnswerCountSource;
}

/**
 * Every method acts on today's counted run, or, given `archiveDay` (a past Puzzle Day), on an
 * archive run of that day's Puzzle with the same rules. An `archiveDay` that is today, in the
 * future, or has no Puzzle throws ArchiveUnavailableError.
 */
export interface GameService {
  getState(deviceId: string, archiveDay?: string): Promise<PuzzleStateView>;
  /** Start the current Prompt (records its window-open time). Idempotent. */
  startPrompt(deviceId: string, archiveDay?: string): Promise<PuzzleStateView>;
  submitAttempt(deviceId: string, promptIndex: number, guess: string, archiveDay?: string): Promise<AttemptResponse>;
  /** "Yes" on a "Did you mean": rejected unless the Entity was offered for this Prompt. */
  confirmSuggestion(
    deviceId: string,
    promptIndex: number,
    entityId: string,
    archiveDay?: string,
  ): Promise<AttemptResponse>;
  /**
   * The end-screen reveal, including Answer Sets, Answer Share, percentile and the distribution
   * curve. Today's is refused until all Prompts are finished; a past day's (`archiveDay`) is
   * always available, without the player's own score when they haven't finished it.
   */
  getResults(deviceId: string, archiveDay?: string): Promise<ResultsResponse>;
  /** Personal stats over this device's finished games, live and archive. */
  getStats(deviceId: string): Promise<PersonalStats>;
  /** Past Puzzle Days that can be played in archive mode (never today or later), newest first. */
  listArchive(deviceId: string): Promise<ArchiveEntryView[]>;
}

/** A past Puzzle in the archive list. */
export interface ArchiveEntryView extends ArchiveDay {
  /** This device has finished that day's Puzzle (live or in the archive). */
  finished: boolean;
}

function toResultView(o: PromptProgress): PromptResultView | null {
  if (o.status === "accepted") {
    return { status: "accepted", entityId: o.entityId, entityName: o.entityName, tier: o.tier, points: o.points };
  }
  if (o.status === "missed") return { status: "missed", points: o.points };
  return null;
}

export function createGameService({
  clock,
  store,
  puzzles,
  answerCounts = store,
}: GameServiceDeps): GameService {
  /**
   * The run a request acts on: today's counted run, or with `archiveDay` an archive run of that
   * past Puzzle. A past day the device already finished live shows that run instead (read-only),
   * so a day can't be replayed for a better score.
   */
  async function load(deviceId: string, archiveDay?: string) {
    const now = clock.now();
    if (archiveDay === undefined) {
      const daily = await puzzles.forDay(puzzleDayOf(now));
      const key: PlayKey = { deviceId, puzzleDay: daily.puzzleDay };
      const promptCount = daily.puzzle.prompts.length;
      const plays = await store.getPromptPlays(key, promptCount);
      return { now, daily, key, promptCount, plays };
    }
    // Only a past day with a generated Puzzle is in the archive.
    const daily = archiveDay < puzzleDayOf(now) ? await puzzles.forDay(archiveDay) : null;
    if (!daily?.generated) throw new ArchiveUnavailableError(archiveDay);
    const promptCount = daily.puzzle.prompts.length;
    const liveKey: PlayKey = { deviceId, puzzleDay: daily.puzzleDay };
    const livePlays = await store.getPromptPlays(liveKey, promptCount);
    if (puzzleProgress(promptCount, livePlays, now).finished) {
      return { now, daily, key: liveKey, promptCount, plays: livePlays };
    }
    const key: PlayKey = { deviceId, puzzleDay: daily.puzzleDay, archive: true };
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
      archive: ctx.key.archive ?? false,
      promptCount,
      serverNow: now,
      current,
      results: progress.outcomes.map(toResultView),
      finished: progress.finished,
      total: progress.finished ? progress.total : null,
    };
  }

  return {
    async getState(deviceId, archiveDay) {
      const ctx = await load(deviceId, archiveDay);
      return view(ctx, ctx.plays);
    },

    async startPrompt(deviceId, archiveDay) {
      const ctx = await load(deviceId, archiveDay);
      const { currentIndex } = puzzleProgress(ctx.promptCount, ctx.plays, ctx.now);
      if (currentIndex === null || ctx.plays[currentIndex]) return view(ctx, ctx.plays);
      const stored = await store.createPromptPlay(ctx.key, currentIndex, openPrompt(ctx.now));
      const plays = ctx.plays.slice();
      plays[currentIndex] = stored;
      return view(ctx, plays);
    },

    submitAttempt(deviceId, promptIndex, guess, archiveDay) {
      return attempt(deviceId, archiveDay, promptIndex, guess, (ctx, play) =>
        engineSubmitAttempt({
          prompt: ctx.daily.puzzle.prompts[promptIndex],
          entities: ctx.daily.entities,
          play,
          guess,
          now: ctx.now,
        }),
      );
    },

    confirmSuggestion(deviceId, promptIndex, entityId, archiveDay) {
      return attempt(deviceId, archiveDay, promptIndex, entityId, async (ctx, play) =>
        engineConfirmSuggestion({
          prompt: ctx.daily.puzzle.prompts[promptIndex],
          entities: ctx.daily.entities,
          play,
          entityId,
          offered: await store.getOfferedCandidates(ctx.key, promptIndex),
          now: ctx.now,
        }),
      );
    },

    async getResults(deviceId, archiveDay) {
      const { now, daily, key, promptCount, plays } = await load(deviceId, archiveDay);
      const progress = puzzleProgress(promptCount, plays, now);
      // A past day's results may be viewed without playing it; today's only once finished.
      if (!progress.finished && archiveDay === undefined) return { ok: false, error: "not-finished" };
      const played = progress.finished;

      const [counts, dayTotals] = await Promise.all([
        answerCounts.getAnswerCounts(daily.puzzleDay, promptCount),
        store.getDayTotals(daily.puzzleDay, promptCount, now),
      ]);
      const maxTotal = promptCount * TIER_POINTS.pentakill;
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
        const result = played ? (toResultView(progress.outcomes[i]) ?? { status: "missed", points: 0 }) : null;
        return { text: prompt.text, answerType: prompt.answerType, result, answerSet };
      });
      const archive = key.archive ?? false;
      // An archive run isn't among the day's counted totals; compare it as if it were.
      const compared = archive && played ? [...dayTotals, progress.total] : dayTotals;
      const total = played ? progress.total : null;
      return {
        ok: true,
        results: {
          puzzleDay: daily.puzzleDay,
          puzzleNumber: daily.puzzleNumber,
          archive,
          played,
          total,
          maxTotal,
          dayTitle: total === null ? null : dayTitle(total),
          playerCount: dayTotals.length,
          percentile: total === null ? null : percentileBetterThan(total, compared),
          distribution: scoreDistribution(compared, { maxTotal, binCount: DISTRIBUTION_BINS }, total),
          prompts,
        },
      };
    },

    async getStats(deviceId) {
      return personalStats(await finishedGames(deviceId, clock.now()));
    },

    async listArchive(deviceId) {
      const now = clock.now();
      const [days, games] = await Promise.all([puzzles.pastDays(now), finishedGames(deviceId, now)]);
      const finished = new Set(games.map((g) => g.puzzleDay));
      return days.map((day) => ({ ...day, finished: finished.has(day.puzzleDay) }));
    },
  };

  /** This device's finished runs (live and archive), each with its Prompts' Tiers. */
  async function finishedGames(deviceId: string, now: number): Promise<FinishedGame[]> {
    const runs = new Map<string, { puzzleDay: string; plays: PromptPlay[] }>();
    for (const p of await store.getDevicePlays(deviceId)) {
      const id = `${p.puzzleDay}|${p.archive}`;
      const run = runs.get(id) ?? { puzzleDay: p.puzzleDay, plays: [] };
      run.plays[p.promptIndex] = p.play;
      runs.set(id, run);
    }
    const games: FinishedGame[] = [];
    for (const run of runs.values()) {
      const daily = await puzzles.forDay(run.puzzleDay);
      const progress = puzzleProgress(daily.puzzle.prompts.length, run.plays, now);
      if (!progress.finished) continue;
      games.push({
        puzzleDay: run.puzzleDay,
        results: progress.outcomes.map((o) => (o.status === "accepted" ? o.tier : null)),
      });
    }
    return games;
  }

  /** Run one engine step against the current, started Prompt, then persist and log it. */
  async function attempt(
    deviceId: string,
    archiveDay: string | undefined,
    promptIndex: number,
    logged: string,
    step: (ctx: Awaited<ReturnType<typeof load>>, play: PromptPlay) => AttemptOutcome | Promise<AttemptOutcome>,
  ): Promise<AttemptResponse> {
    const ctx = await load(deviceId, archiveDay);
    const { currentIndex } = puzzleProgress(ctx.promptCount, ctx.plays, ctx.now);
    if (currentIndex !== promptIndex) {
      return { ok: false, error: "not-current-prompt", state: view(ctx, ctx.plays) };
    }
    const play = ctx.plays[promptIndex];
    if (!play) return { ok: false, error: "prompt-not-started", state: view(ctx, ctx.plays) };

    const outcome = await step(ctx, play);
    if (outcome.result.kind === "did-you-mean") {
      await store.addOfferedCandidates(
        ctx.key,
        promptIndex,
        outcome.result.candidates.map((c) => c.id),
      );
    }
    if (outcome.play !== play) await store.updatePromptPlay(ctx.key, promptIndex, outcome.play);
    await store.logAttempt({ ...ctx.key, promptIndex, guess: logged, result: outcome.result, at: ctx.now });

    const plays = ctx.plays.slice();
    plays[promptIndex] = outcome.play;
    return { ok: true, result: outcome.result, state: view(ctx, plays) };
  }
}
