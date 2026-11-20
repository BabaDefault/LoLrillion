/** Source of "now" in epoch milliseconds. Injected so tests (and later Playwright) can control time. */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => Date.now() };

/**
 * A clock that runs with real time from a chosen start, and can jump. The Playwright smoke test
 * uses it (through `/api/test/clock`) to skip the read and answer windows instead of waiting.
 */
export class AdjustableClock implements Clock {
  private offset = 0;
  constructor(start: number, private readonly realNow: () => number = Date.now) {
    this.set(start);
  }
  now(): number {
    return this.realNow() + this.offset;
  }
  set(ms: number): void {
    this.offset = ms - this.realNow();
  }
  advance(ms: number): void {
    this.offset += ms;
  }
}

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
