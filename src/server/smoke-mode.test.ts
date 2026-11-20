import { describe, expect, it } from "vitest";
import { smokeTestMode } from "./smoke-mode";

describe("smokeTestMode", () => {
  it("is off unless LOLRILLION_SMOKE_TEST is exactly 1", () => {
    expect(smokeTestMode({})).toBe(false);
    expect(smokeTestMode({ LOLRILLION_SMOKE_TEST: "" })).toBe(false);
    expect(smokeTestMode({ LOLRILLION_SMOKE_TEST: "true" })).toBe(false);
    expect(smokeTestMode({ LOLRILLION_SMOKE_TEST: "1" })).toBe(true);
  });

  it("is allowed on a Vercel preview", () => {
    expect(smokeTestMode({ LOLRILLION_SMOKE_TEST: "1", VERCEL_ENV: "preview" })).toBe(true);
  });

  it("refuses to start in Vercel production", () => {
    expect(() => smokeTestMode({ LOLRILLION_SMOKE_TEST: "1", VERCEL_ENV: "production" })).toThrow(/production/);
  });

  it("stays off in production when the variable isn't set", () => {
    expect(smokeTestMode({ VERCEL_ENV: "production" })).toBe(false);
  });
});
