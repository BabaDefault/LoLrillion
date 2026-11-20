import type { EntityId, PromptPlay } from "@/engine";
import type { AttemptLogEntry, PlayKey, PlayStore } from "./play-store";

export class InMemoryPlayStore implements PlayStore {
  private readonly plays = new Map<string, PromptPlay>();
  private readonly offered = new Map<string, Set<EntityId>>();
  readonly attempts: AttemptLogEntry[] = [];

  private id(key: PlayKey, promptIndex: number): string {
    return `${key.deviceId}|${key.puzzleDay}|${promptIndex}`;
  }

  async getPromptPlays(key: PlayKey, promptCount: number): Promise<Array<PromptPlay | null>> {
    return Array.from({ length: promptCount }, (_, i) => this.plays.get(this.id(key, i)) ?? null);
  }

  async createPromptPlay(key: PlayKey, promptIndex: number, play: PromptPlay): Promise<PromptPlay> {
    const id = this.id(key, promptIndex);
    const existing = this.plays.get(id);
    if (existing) return existing;
    this.plays.set(id, play);
    return play;
  }

  async updatePromptPlay(key: PlayKey, promptIndex: number, play: PromptPlay): Promise<void> {
    this.plays.set(this.id(key, promptIndex), play);
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
}
