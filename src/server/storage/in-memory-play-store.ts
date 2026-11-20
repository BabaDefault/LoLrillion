import type { EntityId, PromptPlay } from "@/engine";
import type { AttemptLogEntry, PlayKey, PlayStore } from "./play-store";

interface StoredPlay {
  key: PlayKey;
  promptIndex: number;
  play: PromptPlay;
}

export class InMemoryPlayStore implements PlayStore {
  private readonly plays = new Map<string, StoredPlay>();
  /** Answer Share counts keyed by `${puzzleDay}|${promptIndex}`. */
  private readonly answerCounts = new Map<string, Record<EntityId, number>>();
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

  async logAttempt(entry: AttemptLogEntry): Promise<void> {
    this.attempts.push(entry);
  }

  async getAnswerCounts(puzzleDay: string, promptIndex: number): Promise<Record<EntityId, number>> {
    return { ...this.answerCounts.get(`${puzzleDay}|${promptIndex}`) };
  }

  async getDayTotals(puzzleDay: string, promptCount: number): Promise<number[]> {
    const byDevice = new Map<string, { started: number; total: number }>();
    for (const { key, play } of this.plays.values()) {
      if (key.puzzleDay !== puzzleDay || key.archive) continue;
      const run = byDevice.get(key.deviceId) ?? { started: 0, total: 0 };
      run.started++;
      run.total += play.accepted?.points ?? 0;
      byDevice.set(key.deviceId, run);
    }
    return [...byDevice.values()].filter((r) => r.started >= promptCount).map((r) => r.total);
  }
}
