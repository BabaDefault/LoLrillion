import type { EntityId, PromptPlay } from "@/engine";
import type { AnswerCounts } from "./answer-counts";
import type { AttemptLogEntry, DevicePlay, PlayKey, PlayStore } from "./play-store";

interface StoredPlay {
  key: PlayKey;
  promptIndex: number;
  play: PromptPlay;
}

export class InMemoryPlayStore implements PlayStore {
  private readonly plays = new Map<string, StoredPlay>();
  /** Answer Share counts keyed by `${puzzleDay}|${promptIndex}`. */
  private readonly answerCounts = new Map<string, Record<EntityId, number>>();
  private readonly offered = new Map<string, Set<EntityId>>();
  readonly attempts: AttemptLogEntry[] = [];

  private id(key: PlayKey, promptIndex: number): string {
    return `${key.deviceId}|${key.puzzleDay}|${promptIndex}|${key.archive ? "archive" : "live"}`;
  }

  async getPromptPlays(key: PlayKey, promptCount: number): Promise<Array<PromptPlay | null>> {
    return Array.from({ length: promptCount }, (_, i) => this.plays.get(this.id(key, i))?.play ?? null);
  }

  async createPromptPlay(key: PlayKey, promptIndex: number, play: PromptPlay): Promise<PromptPlay> {
    const id = this.id(key, promptIndex);
    const existing = this.plays.get(id);
    if (existing) return existing.play;
    this.plays.set(id, { key, promptIndex, play });
    return play;
  }

  async updatePromptPlay(key: PlayKey, promptIndex: number, play: PromptPlay): Promise<void> {
    const id = this.id(key, promptIndex);
    const before = this.plays.get(id)?.play;
    this.plays.set(id, { key, promptIndex, play });
    if (play.accepted && !before?.accepted && !key.archive) {
      const countsKey = `${key.puzzleDay}|${promptIndex}`;
      const counts = this.answerCounts.get(countsKey) ?? {};
      counts[play.accepted.entityId] = (counts[play.accepted.entityId] ?? 0) + 1;
      this.answerCounts.set(countsKey, counts);
    }
  }

  async addOfferedCandidates(key: PlayKey, promptIndex: number, entityIds: readonly EntityId[]): Promise<void> {
    const id = this.id(key, promptIndex);
    const offered = this.offered.get(id) ?? new Set<EntityId>();
    for (const entityId of entityIds) offered.add(entityId);
    this.offered.set(id, offered);
  }

  async getOfferedCandidates(key: PlayKey, promptIndex: number): Promise<EntityId[]> {
    return [...(this.offered.get(this.id(key, promptIndex)) ?? [])];
  }

  async logAttempt(entry: AttemptLogEntry): Promise<void> {
    this.attempts.push(entry);
  }

  async getAnswerCounts(puzzleDay: string, promptCount: number): Promise<AnswerCounts> {
    const players = new Set<string>();
    for (const { key } of this.plays.values()) {
      if (key.puzzleDay === puzzleDay && !key.archive) players.add(key.deviceId);
    }
    return {
      players: players.size,
      byPrompt: Array.from({ length: promptCount }, (_, i) => ({
        ...this.answerCounts.get(`${puzzleDay}|${i}`),
      })),
    };
  }

  async getDevicePlays(deviceId: string): Promise<DevicePlay[]> {
    return [...this.plays.values()]
      .filter(({ key }) => key.deviceId === deviceId)
      .map(({ key, promptIndex, play }) => ({
        puzzleDay: key.puzzleDay,
        archive: key.archive ?? false,
        promptIndex,
        play,
      }));
  }

  async getDayTotals(puzzleDay: string, promptCount: number): Promise<number[]> {
    return (await this.getDayRuns(puzzleDay, promptCount)).map((r) => r.total);
  }

  /** Each device's total for the day, for counted runs that have started all `promptCount` Prompts. */
  async getDayRuns(puzzleDay: string, promptCount: number): Promise<Array<{ deviceId: string; total: number }>> {
    const byDevice = new Map<string, { started: number; total: number }>();
    for (const { key, play } of this.plays.values()) {
      if (key.puzzleDay !== puzzleDay || key.archive) continue;
      const run = byDevice.get(key.deviceId) ?? { started: 0, total: 0 };
      run.started++;
      run.total += play.accepted?.points ?? 0;
      byDevice.set(key.deviceId, run);
    }
    return [...byDevice.entries()]
      .filter(([, r]) => r.started >= promptCount)
      .map(([deviceId, r]) => ({ deviceId, total: r.total }));
  }
}
