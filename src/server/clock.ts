/** Source of "now" in epoch milliseconds. Injected so tests (and later Playwright) can control time. */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

/** A clock that only moves when told to. */
export class ManualClock implements Clock {
  constructor(private current: number) {}
  now(): number {
    return this.current;
  }
  set(ms: number): void {
    this.current = ms;
  }
  advance(ms: number): void {
    this.current += ms;
  }
}
