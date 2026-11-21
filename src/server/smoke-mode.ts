/**
 * Smoke-test mode, for the Playwright smoke test only: a fixed test Puzzle, an adjustable clock,
 * the in-memory store and the `/api/test/*` routes. On only when `LOLRILLION_SMOKE_TEST=1`, which
 * only `playwright.config.ts` sets for the server it starts. Refused (throws) in Vercel production,
 * so a stray variable there fails loudly instead of serving a fake Puzzle with a movable clock.
 */
export function smokeTestMode(env: Record<string, string | undefined>): boolean {
  if (env.LOLRILLION_SMOKE_TEST !== "1") return false;
  if (env.VERCEL_ENV === "production") {
    throw new Error("LOLRILLION_SMOKE_TEST is set in production; smoke-test mode is never allowed there");
  }
  return true;
}
