import { describe, expect, it } from "vitest";
import { AdjustableClock } from "./clock";

/** A fake wall clock for the AdjustableClock to run on. */
function wall(start: number) {
  let t = start;
  return { now: () => t, tick: (ms: number) => (t += ms) };
}

describe("AdjustableClock", () => {
  it("starts at the given time and keeps running with real time", () => {
    const real = wall(1_000);
    const clock = new AdjustableClock(50_000, real.now);
    expect(clock.now()).toBe(50_000);
    real.tick(250);
    expect(clock.now()).toBe(50_250);
  });

  it("jumps forward without waiting", () => {
    const real = wall(1_000);
    const clock = new AdjustableClock(50_000, real.now);
    clock.advance(30_000);
    expect(clock.now()).toBe(80_000);
    real.tick(10);
    expect(clock.now()).toBe(80_010);
  });

  it("can be set to a new time", () => {
    const real = wall(1_000);
    const clock = new AdjustableClock(50_000, real.now);
    clock.advance(5_000);
    clock.set(7_000);
    expect(clock.now()).toBe(7_000);
  });
});
